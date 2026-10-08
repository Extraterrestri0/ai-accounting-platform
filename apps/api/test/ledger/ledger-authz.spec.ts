/**
 * Authorization regression tests for the ledger write API (Finding C — previously the
 * controller had no permission decorators, so any authenticated user, incl. a read-only
 * viewer, could POST /ledger/entries). These prove both halves:
 *   1) the role→permission matrix withholds ledger.post / ledger.reverse from viewers, and
 *   2) the controller actually carries @RequirePermission on every route, so the global
 *      RbacGuard enforces it (UI hints are never the boundary — Invariant 9).
 */
import 'reflect-metadata';
import { PERMISSIONS, resolveEffectivePermissions } from '../../src/modules/identity/domain/roles';
import { PERMISSION_KEY } from '../../src/modules/identity/api/require-permission.decorator';
import { LedgerController } from '../../src/modules/ledger/api/ledger.controller';

const can = (companyRole: any, perm: string) => resolveEffectivePermissions({ companyRole }).has(perm as any);

describe('ledger permission matrix', () => {
  it('viewer can read the ledger but cannot post or reverse', () => {
    expect(can('viewer', PERMISSIONS.LEDGER_READ)).toBe(true);
    expect(can('viewer', PERMISSIONS.LEDGER_POST)).toBe(false);
    expect(can('viewer', PERMISSIONS.LEDGER_REVERSE)).toBe(false);
  });

  it('approver (segregation of duties) cannot post or reverse directly', () => {
    expect(can('approver', PERMISSIONS.LEDGER_POST)).toBe(false);
    expect(can('approver', PERMISSIONS.LEDGER_REVERSE)).toBe(false);
  });

  it('accountant and owner can post and reverse', () => {
    for (const role of ['accountant', 'owner']) {
      expect(can(role, PERMISSIONS.LEDGER_POST)).toBe(true);
      expect(can(role, PERMISSIONS.LEDGER_REVERSE)).toBe(true);
    }
  });

  it('a principal with no company role has no ledger write access', () => {
    expect(can(undefined, PERMISSIONS.LEDGER_POST)).toBe(false);
    expect(can(undefined, PERMISSIONS.LEDGER_READ)).toBe(false);
  });
});

describe('ledger controller is guarded (decorators present → RbacGuard enforces)', () => {
  const required = (method: Function) => Reflect.getMetadata(PERMISSION_KEY, method);

  it('POST / requires ledger.post', () => {
    expect(required(LedgerController.prototype.post)).toBe(PERMISSIONS.LEDGER_POST);
  });
  it('POST /:id/reverse requires ledger.reverse', () => {
    expect(required(LedgerController.prototype.reverse)).toBe(PERMISSIONS.LEDGER_REVERSE);
  });
  it('GET routes require ledger.read', () => {
    expect(required(LedgerController.prototype.get)).toBe(PERMISSIONS.LEDGER_READ);
    expect(required(LedgerController.prototype.list)).toBe(PERMISSIONS.LEDGER_READ);
  });

  it('no ledger write route is left without a permission (regression guard for Finding C)', () => {
    for (const m of ['post', 'reverse', 'get', 'list'] as const) {
      expect(required(LedgerController.prototype[m])).toBeDefined();
    }
  });
});
