import { detectFileType, extensionOf, isAllowedExtension, MAX_UPLOAD_BYTES } from '../../src/modules/docintel/domain/validation/file-type';
import { LocalObjectStorage } from '../../src/modules/docintel/infrastructure/local-object-storage';

describe('file-type magic-byte detection', () => {
  it('accepts each supported type and rejects others', () => {
    expect(detectFileType(Buffer.from('%PDF-1.7'))).toBe('pdf');
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(detectFileType(Buffer.from([0x49, 0x49, 0x2a, 0x00]))).toBe('tiff');
    expect(detectFileType(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))).toBe('tiff');
    expect(detectFileType(Buffer.from('<?xml version="1.0"?>'))).toBe('xml');
    expect(detectFileType(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();      // .exe (MZ)
    expect(detectFileType(Buffer.from('not a known file'))).toBeNull();
  });
  it('validates extensions and a sane size cap', () => {
    expect(isAllowedExtension(extensionOf('Invoice.PDF'))).toBe(true);
    expect(isAllowedExtension(extensionOf('a.tiff'))).toBe(true);
    expect(isAllowedExtension(extensionOf('malware.exe'))).toBe(false);
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('local object storage (WORM)', () => {
  const dir = `/tmp/doc-storage-test-${Date.now()}`;
  beforeAll(() => { process.env.DOC_STORAGE_DIR = dir; });
  it('stores, reads prefix, locks (immutable), and signs time-limited URLs', async () => {
    const s = new LocalObjectStorage();
    const key = 't/c/d1/invoice.pdf';
    await s.put(key, Buffer.from('%PDF-1.7 hello'));
    const head = await s.headObject(key);
    expect(head.exists).toBe(true);
    expect((await s.readPrefix(key, 5)).toString()).toBe('%PDF-');
    await s.finalizeObject(key);                                   // WORM lock
    await expect(s.put(key, Buffer.from('tampered'))).rejects.toThrow(/immutable/i); // overwrite denied
    const url = await s.getDownloadUrl(key, 300);
    expect(url).toMatch(/exp=\d+&sig=[0-9a-f]{16}/);
  });
});
