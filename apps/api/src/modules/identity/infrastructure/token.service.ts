import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'node:crypto';

export interface AccessClaims { sub: string; tid: string; }

/**
 * Access tokens: short-lived signed JWTs (secret from the vault via env).
 * Refresh tokens: opaque random strings; only their SHA-256 hash is persisted.
 */
@Injectable()
export class TokenService {
  private readonly secret = process.env.AUTH_JWT_SECRET ?? 'dev-only-not-for-prod';
  private readonly issuer = 'accounting-platform';
  private readonly accessTtl = process.env.AUTH_ACCESS_TTL ?? '15m';

  signAccess(claims: AccessClaims): string {
    const opts: jwt.SignOptions = { expiresIn: this.accessTtl as jwt.SignOptions['expiresIn'], issuer: this.issuer };
    return jwt.sign(claims, this.secret, opts);
  }
  verifyAccess(token: string): AccessClaims | null {
    try {
      const d = jwt.verify(token, this.secret, { issuer: this.issuer }) as jwt.JwtPayload;
      if (typeof d.sub === 'string' && typeof d.tid === 'string') return { sub: d.sub, tid: d.tid };
      return null;
    } catch { return null; }
  }
  newRefreshToken(): { token: string; hash: string } {
    const token = crypto.randomBytes(32).toString('base64url');
    return { token, hash: this.hashRefresh(token) };
  }
  hashRefresh(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
