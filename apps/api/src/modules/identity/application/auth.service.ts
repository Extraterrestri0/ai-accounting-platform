import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../platform';
import { PasswordHasher } from '../infrastructure/password.hasher';
import { TotpService } from '../infrastructure/totp.service';
import { TokenService } from '../infrastructure/token.service';
import { UserAuthRepository } from '../infrastructure/user-auth.repository';
import { SessionRepository } from '../infrastructure/session.repository';
import { AccountLockedError, EmailTakenError, InvalidCredentialsError, MfaInvalidError } from '../domain/errors';
import type { IAuthService, LoginResult } from './auth.service.interface';

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;
const REFRESH_DAYS = 30;
const MFA_PREFIX = 'mfa:';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly hasher: PasswordHasher,
    private readonly totp: TotpService,
    private readonly tokens: TokenService,
    private readonly users: UserAuthRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findForLogin(email); // pre-auth, no tenant context
    if (!user || !user.passwordHash || user.status !== 'active') {
      await this.hasher.hash(password); // constant work to blunt user-enumeration timing
      throw new InvalidCredentialsError();
    }
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) throw new AccountLockedError();

    if (!(await this.hasher.verify(user.passwordHash, password))) {
      await this.users.recordFailedAttempt(user.tenantId, user.id, LOCK_THRESHOLD, LOCK_MINUTES);
      throw new InvalidCredentialsError();
    }

    if (user.mfaEnabled) {
      const mfaToken = this.tokens.signAccess({ sub: `${MFA_PREFIX}${user.id}`, tid: user.tenantId });
      return { status: 'mfa_required', mfaToken };
    }
    return this.issueSession(user.tenantId, user.id);
  }

  async register(email: string, password: string, companyName: string): Promise<LoginResult> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.users.findForLogin(normalized);
    if (existing) throw new EmailTakenError();
    const passwordHash = await this.hasher.hash(password);
    const { tenantId, userId } = await this.users.register(normalized, passwordHash, companyName);
    return this.issueSession(tenantId, userId);
  }

  async loginWithGoogle(email: string, name: string): Promise<LoginResult> {
    const { tenantId, userId } = await this.users.oauthUpsert(email.trim().toLowerCase(), name || email.split('@')[0]);
    return this.issueSession(tenantId, userId);
  }

  async verifyMfa(mfaToken: string, code: string): Promise<LoginResult> {
    const claims = this.tokens.verifyAccess(mfaToken);
    if (!claims || !claims.sub.startsWith(MFA_PREFIX)) throw new MfaInvalidError();
    const userId = claims.sub.slice(MFA_PREFIX.length);
    const tenantId = claims.tid;
    const secret = await this.users.getMfaSecret(tenantId, userId); // tenant-scoped read (RLS)
    if (!secret || !this.totp.verify(secret, code)) throw new MfaInvalidError();
    return this.issueSession(tenantId, userId);
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const { tenantId } = this.ctx.currentOrThrow();
    const session = await this.sessions.findActiveByHash(this.tokens.hashRefresh(refreshToken));
    if (!session) throw new InvalidCredentialsError();
    await this.sessions.revoke(session.id); // rotation
    return this.issueSession(tenantId, session.userId);
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.sessions.findActiveByHash(this.tokens.hashRefresh(refreshToken));
    if (session) await this.sessions.revoke(session.id);
  }

  private async issueSession(tenantId: string, userId: string): Promise<LoginResult> {
    await this.users.recordSuccessfulLogin(tenantId, userId);
    const accessToken = this.tokens.signAccess({ sub: userId, tid: tenantId });
    const { token, hash } = this.tokens.newRefreshToken();
    const expires = new Date(Date.now() + REFRESH_DAYS * 86_400_000);
    await this.ctx.run({ tenantId, userId }, () => this.sessions.create(tenantId, userId, hash, expires));
    return { status: 'authenticated', accessToken, refreshToken: token };
  }
}
