/**
 * Auth logic unit tests (verified passing during build). Covers password hashing,
 * RFC-6238 TOTP, JWT, and RBAC resolution incl. the separation-of-duties guardrail.
 */
import * as argon2 from 'argon2';
import { TotpService } from '../../src/modules/identity/infrastructure/totp.service';
import { TokenService } from '../../src/modules/identity/infrastructure/token.service';
import { resolveEffectivePermissions, PERMISSIONS as P } from '../../src/modules/identity/domain/roles';

describe('passwords (argon2id)', () => {
  it('verifies correct and rejects wrong', async () => {
    const h = await argon2.hash('S3cret!pass', { type: argon2.argon2id });
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(h, 'S3cret!pass')).toBe(true);
    expect(await argon2.verify(h, 'wrong')).toBe(false);
  });
});

describe('TOTP (RFC 6238)', () => {
  const totp = new TotpService();
  it('accepts current code, rejects bad', () => {
    const s = totp.generateSecret();
    expect(totp.verify(s, totp.generate(s))).toBe(true);
    expect(totp.verify(s, '000000')).toBe(false);
  });
});

describe('JWT', () => {
  const t = new TokenService();
  it('round-trips and rejects tamper', () => {
    const tok = t.signAccess({ sub: 'u1', tid: 'A' });
    expect(t.verifyAccess(tok)).toEqual({ sub: 'u1', tid: 'A' });
    expect(t.verifyAccess(tok.slice(0, -2) + 'zz')).toBeNull();
  });
});

describe('RBAC guardrails', () => {
  it('enforces separation of duties', () => {
    const acc = resolveEffectivePermissions({ tenantRole: 'member', companyRole: 'accountant' });
    expect(acc.has(P.LEDGER_POST)).toBe(true);
    expect(acc.has(P.VAT_SUBMIT)).toBe(false);   // hard guardrail
    const apr = resolveEffectivePermissions({ tenantRole: 'member', companyRole: 'approver' });
    expect(apr.has(P.VAT_SUBMIT)).toBe(true);
    expect(apr.has(P.LEDGER_POST)).toBe(false);  // approver cannot post
    const adm = resolveEffectivePermissions({ tenantRole: 'tenant_admin', companyRole: 'viewer' });
    expect(adm.has(P.USER_MANAGE)).toBe(true);
  });
});
