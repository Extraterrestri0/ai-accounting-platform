import { PERMISSIONS, resolveEffectivePermissions } from '../../src/modules/identity/domain/roles';

const has = (companyRole: any, perm: string) => resolveEffectivePermissions({ companyRole }).has(perm as any);

describe('SAF-T permission boundaries (SAFT_READ vs SAFT_GENERATE)', () => {
  it('owner has both read and generate', () => {
    expect(has('owner', PERMISSIONS.SAFT_READ)).toBe(true);
    expect(has('owner', PERMISSIONS.SAFT_GENERATE)).toBe(true);
  });

  it('accountant has both read and generate', () => {
    expect(has('accountant', PERMISSIONS.SAFT_READ)).toBe(true);
    expect(has('accountant', PERMISSIONS.SAFT_GENERATE)).toBe(true);
  });

  it('approver can READ but NOT generate', () => {
    expect(has('approver', PERMISSIONS.SAFT_READ)).toBe(true);
    expect(has('approver', PERMISSIONS.SAFT_GENERATE)).toBe(false);
  });

  it('viewer (read-only) can READ but NOT generate', () => {
    expect(has('viewer', PERMISSIONS.SAFT_READ)).toBe(true);
    expect(has('viewer', PERMISSIONS.SAFT_GENERATE)).toBe(false);
  });

  it('a principal with no company role has neither', () => {
    expect(has(undefined, PERMISSIONS.SAFT_READ)).toBe(false);
    expect(has(undefined, PERMISSIONS.SAFT_GENERATE)).toBe(false);
  });
});
