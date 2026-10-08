/**
 * Input-validation regression tests for the ledger write DTOs (Finding D — previously the
 * DTOs were bare interfaces, so the global ValidationPipe validated nothing on the one
 * endpoint that moves money). These exercise the real class-validator metadata the pipe uses.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PostEntryDto, ReverseEntryDto } from '../../src/modules/ledger/api/dto/post-entry.dto';

const UUID_A = 'a0000000-0000-0000-0000-000000000602';
const UUID_B = 'a0000000-0000-0000-0000-000000000401';
const validBody = () => ({
  postingDate: '2026-09-30',
  description: 'Approved purchase',
  currency: 'EUR',
  lines: [
    { accountId: UUID_A, direction: 'debit', amount: '190.00' },
    { accountId: UUID_B, direction: 'credit', amount: '190.00' },
  ],
});

const errorsFor = (body: unknown) =>
  validateSync(plainToInstance(PostEntryDto, body), { whitelist: true });

describe('PostEntryDto validation', () => {
  it('accepts a well-formed balanced-shape body', () => {
    expect(errorsFor(validBody())).toHaveLength(0);
  });

  it('rejects a non-ISO posting date', () => {
    expect(errorsFor({ ...validBody(), postingDate: '30/09/2026' }).length).toBeGreaterThan(0);
    expect(errorsFor({ ...validBody(), postingDate: 'today' }).length).toBeGreaterThan(0);
  });

  it('rejects fewer than two lines', () => {
    const b = validBody(); b.lines = [b.lines[0]];
    expect(errorsFor(b).length).toBeGreaterThan(0);
  });

  it('rejects a bad direction', () => {
    const b = validBody(); (b.lines[0] as any).direction = 'dr';
    expect(errorsFor(b).length).toBeGreaterThan(0);
  });

  it('rejects negative, zero-scale, float and non-numeric amounts', () => {
    for (const amount of ['-190.00', '190', '190.5', '190.005', 'abc', '']) {
      const b = validBody(); (b.lines[0] as any).amount = amount;
      expect(errorsFor(b).length).toBeGreaterThan(0);
    }
  });

  it('rejects a non-UUID account id', () => {
    const b = validBody(); (b.lines[0] as any).accountId = '602';
    expect(errorsFor(b).length).toBeGreaterThan(0);
  });

  it('rejects a bad currency code', () => {
    expect(errorsFor({ ...validBody(), currency: 'EURO' }).length).toBeGreaterThan(0);
  });

  it('strips unknown properties under whitelist (no injection of extra fields)', () => {
    const inst = plainToInstance(PostEntryDto, { ...validBody(), tenantId: 'x', status: 'posted' } as any);
    expect(validateSync(inst, { whitelist: true })).toHaveLength(0);
    expect((inst as any).tenantId).toBeUndefined();
    expect((inst as any).status).toBeUndefined();
  });
});

describe('ReverseEntryDto validation', () => {
  it('requires a reason string', () => {
    expect(validateSync(plainToInstance(ReverseEntryDto, {}))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(ReverseEntryDto, { reason: 'duplicate' }))).toHaveLength(0);
  });
});
