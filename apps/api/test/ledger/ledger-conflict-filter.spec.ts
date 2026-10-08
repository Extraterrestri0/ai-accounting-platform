import { LedgerConflictFilter } from '../../src/modules/ledger/api/ledger-error.filter';
import { AlreadyReversedError, EntryNotFoundError, SettlementReversalNotAllowedError } from '../../src/modules/ledger/domain/errors';

/** Narrow HTTP mapping for the reversal endpoint: only the expected accounting conflicts → 409. */
describe('LedgerConflictFilter', () => {
  const run = (err: Error) => {
    const json = jest.fn(); const status = jest.fn(() => ({ json }));
    const host: any = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
    new LedgerConflictFilter().catch(err as AlreadyReversedError, host);
    return { status, body: json.mock.calls[0][0] };
  };

  it.each([new AlreadyReversedError('e1'), new SettlementReversalNotAllowedError('e1')])('maps %p to 409 with a user-safe body', (err) => {
    const { status, body } = run(err);
    expect(status).toHaveBeenCalledWith(409);
    expect(body).toEqual({ statusCode: 409, error: err.name, message: err.message });
    expect(JSON.stringify(body)).not.toMatch(/23505|uq_reversal_target|duplicate key/);
  });

  it('catches ONLY those two classes (anything else keeps its existing handling, e.g. 500)', () => {
    const caught = Reflect.getMetadata('__filterCatchExceptions__', LedgerConflictFilter) as unknown[];
    expect(caught).toEqual([AlreadyReversedError, SettlementReversalNotAllowedError]);
    expect(caught).not.toContain(EntryNotFoundError);
    expect(caught).not.toContain(Error);
  });
});
