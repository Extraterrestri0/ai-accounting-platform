import { IdentityService } from '../../src/modules/identity/application/identity.service';

/**
 * Unit tests for the user profile/avatar service. The service validates the avatar
 * and always targets the user's OWN row (userId from the request context) — proving
 * no cross-user/cross-tenant write path exists.
 */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function makeService(initial: { avatarUrl: string | null } = { avatarUrl: null }) {
  const store = { ...initial };
  const ctx: any = { currentOrThrow: () => ({ tenantId: 'T1', userId: 'U1' }) };
  const users: any = {
    getProfile: jest.fn(async () => ({ email: 'user@demo.bg', avatarUrl: store.avatarUrl })),
    setAvatar: jest.fn(async (_userId: string, value: string | null) => { store.avatarUrl = value; }),
  };
  return { svc: new IdentityService(ctx, users), users };
}

describe('IdentityService.getMe', () => {
  it('returns the profile for the user in context', async () => {
    const { svc } = makeService({ avatarUrl: PNG });
    await expect(svc.getMe()).resolves.toEqual({ userId: 'U1', tenantId: 'T1', email: 'user@demo.bg', avatarUrl: PNG });
  });
});

describe('IdentityService.setAvatar', () => {
  it('accepts a valid image data URL and writes it to the current user', async () => {
    const { svc, users } = makeService();
    const me = await svc.setAvatar(PNG);
    expect(users.setAvatar).toHaveBeenCalledWith('U1', PNG); // own user only
    expect(me.avatarUrl).toBe(PNG);
  });

  it('rejects a non-image data URL', async () => {
    const { svc, users } = makeService();
    await expect(svc.setAvatar('data:text/plain;base64,aGVsbG8=')).rejects.toThrow();
    expect(users.setAvatar).not.toHaveBeenCalled();
  });

  it('rejects an oversized image (> ~512 KB)', async () => {
    const { svc } = makeService();
    const big = 'data:image/png;base64,' + 'A'.repeat(800_000);
    await expect(svc.setAvatar(big)).rejects.toThrow();
  });

  it('accepts png/jpeg/webp/gif mime types', async () => {
    for (const mime of ['png', 'jpeg', 'jpg', 'webp', 'gif']) {
      const { svc } = makeService();
      await expect(svc.setAvatar(`data:image/${mime};base64,AAAA`)).resolves.toBeDefined();
    }
  });
});

describe('IdentityService.removeAvatar', () => {
  it('clears the avatar for the current user', async () => {
    const { svc, users } = makeService({ avatarUrl: PNG });
    const me = await svc.removeAvatar();
    expect(users.setAvatar).toHaveBeenCalledWith('U1', null);
    expect(me.avatarUrl).toBeNull();
  });
});
