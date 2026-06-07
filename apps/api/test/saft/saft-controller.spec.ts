import 'reflect-metadata';
import { BadRequestException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { SaftController } from '../../src/modules/saft/api/saft.controller';
import { PERMISSION_KEY } from '../../src/modules/identity/api/require-permission.decorator';
import { PERMISSIONS } from '../../src/modules/identity/domain/roles';

const UUID = '00000000-0000-0000-0000-000000000001';

function make(over: any = {}) {
  const exports: any = {
    generateExport: jest.fn(async (y: number, m: number) => ({ id: UUID, year: y, month: m, status: 'generated', generatedAt: 'now' })),
    listExports: jest.fn(async () => []),
    getExport: jest.fn(async () => null),
    getExportDataset: jest.fn(async () => null),
    ...over.exports,
  };
  const validation: any = { validatePeriod: jest.fn(async () => ({ ok: true, errors: [], warnings: [], info: [], counts: { errors: 0, warnings: 0, info: 0 } })), ...over.validation };
  return { ctrl: new SaftController(exports, validation), exports, validation };
}

describe('SaftController (Task: SAF-T v1)', () => {
  describe('not-found semantics (M5)', () => {
    it('GET exports/:id throws 404 when the export does not exist', async () => {
      const { ctrl } = make({ exports: { getExport: jest.fn(async () => null) } });
      await expect(ctrl.get(UUID)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('GET exports/:id/dataset throws 404 when the dataset does not exist', async () => {
      const { ctrl } = make({ exports: { getExportDataset: jest.fn(async () => null) } });
      await expect(ctrl.dataset(UUID)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('returns the record/dataset when present', async () => {
      const rec = { id: UUID, year: 2026, month: 5, status: 'generated', generatedAt: 'now' };
      const ds = { header: {}, counts: {} };
      const { ctrl } = make({ exports: { getExport: jest.fn(async () => rec), getExportDataset: jest.fn(async () => ds) } });
      expect(await ctrl.get(UUID)).toBe(rec);
      expect(await ctrl.dataset(UUID)).toBe(ds);
    });
  });

  describe('malformed UUID (M4) — ParseUUIDPipe contract', () => {
    const pipe = new ParseUUIDPipe();
    const meta: any = { type: 'param', data: 'id' };
    it('rejects a non-UUID id with 400 (before reaching the DB)', async () => {
      await expect(pipe.transform('not-a-uuid', meta)).rejects.toBeInstanceOf(BadRequestException);
      await expect(pipe.transform('123', meta)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('passes a valid UUID through unchanged', async () => {
      await expect(pipe.transform(UUID, meta)).resolves.toBe(UUID);
    });
  });

  describe('input validation', () => {
    it('rejects an invalid month on generate and validate', () => {
      const { ctrl } = make();
      expect(() => ctrl.generate({ year: 2026, month: 13 } as any)).toThrow(BadRequestException);
      expect(() => ctrl.validate('2026', '0')).toThrow(BadRequestException);
    });
    it('parses and delegates valid year/month', () => {
      const { ctrl, exports, validation } = make();
      ctrl.generate({ year: 2026, month: 5 } as any);
      expect(exports.generateExport).toHaveBeenCalledWith(2026, 5);
      ctrl.validate('2026', '5');
      expect(validation.validatePeriod).toHaveBeenCalledWith(2026, 5);
    });
  });

  describe('permission boundaries (SAFT_READ vs SAFT_GENERATE)', () => {
    const perm = (m: keyof SaftController) => Reflect.getMetadata(PERMISSION_KEY, SaftController.prototype[m] as any);
    it('generation (POST) requires SAFT_GENERATE', () => {
      expect(perm('generate')).toBe(PERMISSIONS.SAFT_GENERATE);
    });
    it('all reads (list/get/dataset/validate) require only SAFT_READ', () => {
      expect(perm('list')).toBe(PERMISSIONS.SAFT_READ);
      expect(perm('get')).toBe(PERMISSIONS.SAFT_READ);
      expect(perm('dataset')).toBe(PERMISSIONS.SAFT_READ);
      expect(perm('validate')).toBe(PERMISSIONS.SAFT_READ);
    });
  });
});
