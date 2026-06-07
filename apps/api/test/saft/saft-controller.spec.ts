import 'reflect-metadata';
import { BadRequestException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { SaftController } from '../../src/modules/saft/api/saft.controller';
import { PERMISSION_KEY } from '../../src/modules/identity/api/require-permission.decorator';
import { PERMISSIONS } from '../../src/modules/identity/domain/roles';

const UUID = '00000000-0000-0000-0000-000000000001';
const resMock = () => { const r: any = { status: jest.fn(() => r) }; return r; };

function make(over: any = {}) {
  const exports: any = {
    generateExport: jest.fn(async (y: number, m: number) => ({ id: UUID, year: y, month: m, status: 'generated', generatedAt: 'now' })),
    requestExport: jest.fn(async (y: number, m: number) => ({ id: UUID, year: y, month: m, status: 'queued', generatedAt: 'now' })),
    listExports: jest.fn(async () => []),
    getExport: jest.fn(async () => null),
    getExportDataset: jest.fn(async () => null),
    ...over.exports,
  };
  const validation: any = { validatePeriod: jest.fn(async () => ({ ok: true, errors: [], warnings: [], info: [], counts: { errors: 0, warnings: 0, info: 0 } })), ...over.validation };
  const flags: any = { saftXmlEnabled: jest.fn(() => over.flag ?? false) };
  return { ctrl: new SaftController(exports, validation, flags), exports, validation, flags };
}

describe('SaftController — POST /exports feature flag (SAFT_XML_ENABLED)', () => {
  it('flag OFF → v1 synchronous generateExport (no enqueue, no 202)', async () => {
    const { ctrl, exports } = make({ flag: false });
    const res = resMock();
    const rec = await ctrl.generate({ year: 2026, month: 5 } as any, res);
    expect(exports.generateExport).toHaveBeenCalledWith(2026, 5);
    expect(exports.requestExport).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(202);
    expect(rec.status).toBe('generated');
  });

  it('flag ON → async requestExport + 202 Accepted', async () => {
    const { ctrl, exports } = make({ flag: true });
    const res = resMock();
    const rec = await ctrl.generate({ year: 2026, month: 5 } as any, res);
    expect(exports.requestExport).toHaveBeenCalledWith(2026, 5);
    expect(exports.generateExport).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(rec.status).toBe('queued');
  });

  it('rejects an invalid month regardless of flag (before enqueue/build)', async () => {
    const off = make({ flag: false });
    await expect(off.ctrl.generate({ year: 2026, month: 13 } as any, resMock())).rejects.toBeInstanceOf(BadRequestException);
    const on = make({ flag: true });
    await expect(on.ctrl.generate({ year: 2026, month: 0 } as any, resMock())).rejects.toBeInstanceOf(BadRequestException);
    expect(on.exports.requestExport).not.toHaveBeenCalled();
  });
});

describe('SaftController — reads', () => {
  it('GET exports/:id throws 404 when the export does not exist', async () => {
    const { ctrl } = make({ exports: { getExport: jest.fn(async () => null) } });
    await expect(ctrl.get(UUID)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('GET exports/:id/dataset throws 404 when the dataset does not exist', async () => {
    const { ctrl } = make({ exports: { getExportDataset: jest.fn(async () => null) } });
    await expect(ctrl.dataset(UUID)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('returns the record/dataset when present', async () => {
    const rec = { id: UUID, year: 2026, month: 5, status: 'completed', generatedAt: 'now' };
    const ds = { header: {}, counts: {} };
    const { ctrl } = make({ exports: { getExport: jest.fn(async () => rec), getExportDataset: jest.fn(async () => ds) } });
    expect(await ctrl.get(UUID)).toBe(rec);
    expect(await ctrl.dataset(UUID)).toBe(ds);
  });
  it('validate parses + delegates and rejects an invalid month', () => {
    const { ctrl, validation } = make();
    ctrl.validate('2026', '5');
    expect(validation.validatePeriod).toHaveBeenCalledWith(2026, 5);
    expect(() => ctrl.validate('2026', '0')).toThrow(BadRequestException);
  });
});

describe('SaftController — malformed UUID (ParseUUIDPipe)', () => {
  const pipe = new ParseUUIDPipe();
  const meta: any = { type: 'param', data: 'id' };
  it('rejects a non-UUID id with 400', async () => {
    await expect(pipe.transform('not-a-uuid', meta)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('passes a valid UUID through', async () => {
    await expect(pipe.transform(UUID, meta)).resolves.toBe(UUID);
  });
});

describe('SaftController — permission boundaries unchanged (SAFT_READ vs SAFT_GENERATE)', () => {
  const perm = (m: keyof SaftController) => Reflect.getMetadata(PERMISSION_KEY, SaftController.prototype[m] as any);
  it('generation (POST) still requires SAFT_GENERATE', () => {
    expect(perm('generate')).toBe(PERMISSIONS.SAFT_GENERATE);
  });
  it('all reads still require only SAFT_READ', () => {
    expect(perm('list')).toBe(PERMISSIONS.SAFT_READ);
    expect(perm('get')).toBe(PERMISSIONS.SAFT_READ);
    expect(perm('dataset')).toBe(PERMISSIONS.SAFT_READ);
    expect(perm('validate')).toBe(PERMISSIONS.SAFT_READ);
  });
});
