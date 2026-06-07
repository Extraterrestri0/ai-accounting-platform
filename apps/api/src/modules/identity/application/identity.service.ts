import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../platform';
import { UserAuthRepository } from '../infrastructure/user-auth.repository';
import type { IIdentityService, UserProfile } from './identity.service.interface';

const MAX_AVATAR_CHARS = 700_000; // ~512 KB binary as a base64 data URL
const AVATAR_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * Identity application service — the authenticated user's own profile + avatar.
 * All reads/writes run under the request's tenant context (RLS) and target the user's
 * OWN row only (userId from the signed token) — no cross-tenant or cross-user access.
 */
@Injectable()
export class IdentityService implements IIdentityService {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly users: UserAuthRepository,
  ) {}

  async getMe(): Promise<UserProfile> {
    const { tenantId, userId } = this.ctx.currentOrThrow();
    const p = await this.users.getProfile(userId);
    return { userId, tenantId, email: p.email, avatarUrl: p.avatarUrl };
  }

  async setAvatar(dataUrl: string): Promise<UserProfile> {
    const value = (dataUrl ?? '').trim();
    if (!AVATAR_DATA_URL.test(value)) {
      throw new BadRequestException('Avatar must be a PNG/JPEG/WebP/GIF image (data URL).');
    }
    if (value.length > MAX_AVATAR_CHARS) {
      throw new BadRequestException('Avatar is too large (max ~512 KB). Use a smaller image.');
    }
    const { userId } = this.ctx.currentOrThrow();
    await this.users.setAvatar(userId, value);
    return this.getMe();
  }

  async removeAvatar(): Promise<UserProfile> {
    const { userId } = this.ctx.currentOrThrow();
    await this.users.setAvatar(userId, null);
    return this.getMe();
  }
}
