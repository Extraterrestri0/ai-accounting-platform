import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

/** RFC 6238 TOTP using node:crypto (verified). Secrets are stored encrypted at rest (KMS, app layer). */
@Injectable()
export class TotpService {
  private readonly B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  generateSecret(bytes = 20): string {
    const buf = crypto.randomBytes(bytes);
    let bits = '', out = '';
    for (const b of buf) bits += b.toString(2).padStart(8, '0');
    for (let i = 0; i + 5 <= bits.length; i += 5) out += this.B32[parseInt(bits.slice(i, i + 5), 2)];
    return out;
  }
  generate(secret: string, t = Date.now(), period = 30, digits = 6): string {
    const counter = Math.floor(t / 1000 / period);
    const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', this.decode(secret)).update(buf).digest();
    const off = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[off] & 0x7f) << 24 | hmac[off + 1] << 16 | hmac[off + 2] << 8 | hmac[off + 3]) % 10 ** digits;
    return code.toString().padStart(digits, '0');
  }
  verify(secret: string, token: string, t = Date.now(), window = 1): boolean {
    for (let w = -window; w <= window; w++) if (this.generate(secret, t + w * 30000) === token) return true;
    return false;
  }
  private decode(s: string): Buffer {
    let bits = '';
    for (const c of s.replace(/=+$/, '').toUpperCase()) {
      const v = this.B32.indexOf(c); if (v < 0) continue; bits += v.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(bytes);
  }
}
