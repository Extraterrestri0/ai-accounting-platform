/**
 * AuthService.register unit tests (no DB). Cover the service-level contract:
 * email normalization, duplicate rejection before any write, delegation of the
 * tenant+user+membership+company provisioning to the repository (the atomic
 * SECURITY DEFINER function), and that a session is issued on success.
 */
import { AuthService } from '../../src/modules/identity/application/auth.service';
import { EmailTakenError } from '../../src/modules/identity/domain/errors';

const makeService = (over: Partial<Record<string, any>> = {}) => {
  const users = {
    findForLogin: jest.fn().mockResolvedValue(null),
    register: jest.fn().mockResolvedValue({ tenantId: 'T1', userId: 'U1' }),
    recordSuccessfulLogin: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
  const hasher = { hash: jest.fn().mockResolvedValue('argon2id-hash'), verify: jest.fn() };
  const tokens = {
    signAccess: jest.fn().mockReturnValue('access.jwt'),
    newRefreshToken: jest.fn().mockReturnValue({ token: 'refresh-token', hash: 'refresh-hash' }),
  };
  const sessions = { create: jest.fn().mockResolvedValue(undefined) };
  const ctx = { run: jest.fn((_holder: unknown, fn: () => unknown) => fn()) };
  const svc = new AuthService(
    ctx as any, hasher as any, {} as any, tokens as any, users as any, sessions as any,
  );
  return { svc, users, hasher, tokens, sessions, ctx };
};

describe('AuthService.register', () => {
  it('provisions the account and returns an authenticated session', async () => {
    const { svc, users, hasher, sessions } = makeService();

    const result = await svc.register('  New@Example.COM ', 'pw-at-least-8', 'Акме ООД');

    // password hashed, then membership/company provisioning delegated to the
    // atomic register_account function via the repository — with a normalized email.
    expect(hasher.hash).toHaveBeenCalledWith('pw-at-least-8');
    expect(users.register).toHaveBeenCalledWith('new@example.com', 'argon2id-hash', 'Акме ООД');
    expect(sessions.create).toHaveBeenCalledTimes(1); // session issued for the new tenant/user
    expect(result).toEqual({
      status: 'authenticated', accessToken: 'access.jwt', refreshToken: 'refresh-token',
    });
  });

  it('rejects a duplicate email before hashing or writing anything', async () => {
    const { svc, users, hasher } = makeService({
      findForLogin: jest.fn().mockResolvedValue({ id: 'existing-user' }),
    });

    await expect(svc.register('dupe@example.com', 'pw-at-least-8', 'X'))
      .rejects.toBeInstanceOf(EmailTakenError);

    expect(hasher.hash).not.toHaveBeenCalled();
    expect(users.register).not.toHaveBeenCalled();
  });
});
