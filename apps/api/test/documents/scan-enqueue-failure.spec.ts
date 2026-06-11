import { ServiceUnavailableException } from '@nestjs/common';
import { DocumentService } from '../../src/modules/docintel/application/document.service';
import { InvalidDocumentStateError } from '../../src/modules/docintel/domain/errors';

/**
 * When the scan/extract queue is unreachable (Redis down), finalizeUpload must NOT leave the
 * document silently stuck in 'scanning': it persists the upload, then on enqueue failure marks
 * the document recoverable-'failed' and surfaces a 503. requeueScan drives the retry.
 */
const SCOPE = { tenantId: 't1', companyId: 'c1', userId: 'u1' };
const PDF_PREFIX = Buffer.from('%PDF-1.7'); // magic bytes → detectFileType → 'pdf'

function build(overrides: { enqueue?: jest.Mock; getStatus?: string } = {}) {
  const enqueue = overrides.enqueue ?? jest.fn().mockResolvedValue(undefined);
  const setStatus = jest.fn().mockImplementation((_db, id: string, status: string) => ({ id, status }));
  const repo = {
    getById: jest.fn().mockResolvedValue({ id: 'd1', status: overrides.getStatus ?? 'pending_upload', storageKey: 't1/c1/d1/inv.pdf' }),
    nextVersionNo: jest.fn().mockResolvedValue(1),
    addVersion: jest.fn().mockResolvedValue(undefined),
    upsertMetadata: jest.fn().mockResolvedValue(undefined),
    setStatus,
  };
  const storage = {
    headObject: jest.fn().mockResolvedValue({ exists: true, sizeBytes: 1024 }),
    readPrefix: jest.fn().mockResolvedValue(PDF_PREFIX),
    finalizeObject: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { append: jest.fn().mockResolvedValue(undefined) };
  const ctx = { currentOrThrow: () => SCOPE } as any;
  const db = { run: async (cb: (c: unknown) => unknown) => cb({}) } as any;
  const svc = new DocumentService(ctx, db, repo as any, storage as any, { enqueue } as any, audit as any);
  return { svc, repo, enqueue, setStatus, storage, audit };
}

describe('DocumentService — scan enqueue failure (Redis down)', () => {
  it('finalizeUpload persists then succeeds when the queue is reachable', async () => {
    const { svc, enqueue, setStatus } = build();
    const res = await svc.finalizeUpload('d1', { checksumSha256: 'abc' });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('scanning');
    expect(setStatus.mock.calls.map((c) => c[2])).toEqual(['scanning']); // never marked failed
  });

  it('marks the document recoverable-failed and throws 503 when enqueue fails', async () => {
    const enqueue = jest.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379'));
    const { svc, setStatus, audit } = build({ enqueue });
    await expect(svc.finalizeUpload('d1', { checksumSha256: 'abc' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    const statuses = setStatus.mock.calls.map((c) => c[2]);
    expect(statuses).toEqual(['scanning', 'failed']); // committed scanning, then flipped to failed
    expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'document.scan_enqueue_failed' }));
  });

  it('requeueScan re-enqueues and returns to scanning', async () => {
    const { svc, enqueue, setStatus } = build({ getStatus: 'failed' });
    const res = await svc.requeueScan('d1');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('scanning');
    expect(setStatus.mock.calls.map((c) => c[2])).toEqual(['scanning']);
  });

  it('requeueScan surfaces 503 when the queue is still down', async () => {
    const enqueue = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { svc } = build({ enqueue, getStatus: 'scanning' });
    await expect(svc.requeueScan('d1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('requeueScan rejects documents that are not scanning/failed', async () => {
    const { svc } = build({ getStatus: 'ready' });
    await expect(svc.requeueScan('d1')).rejects.toBeInstanceOf(InvalidDocumentStateError);
  });
});
