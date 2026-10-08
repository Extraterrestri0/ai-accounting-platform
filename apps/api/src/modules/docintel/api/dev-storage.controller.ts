import { Controller, Get, Inject, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { STORAGE_SERVICE, type StorageService } from '../application/storage.port';
import { verifyStorageSignature } from '../infrastructure/signed-url';

/**
 * DEV-ONLY local object storage transport. In production the client uploads
 * directly to a presigned S3 URL and previews via a signed S3 GET — this controller
 * is never hit. With STORAGE_DRIVER=local it receives the raw bytes (PUT) and
 * serves them back to the sandboxed viewer (GET, signed URL, no auth required).
 */
interface LocalStorage extends StorageService {
  put(storageKey: string, data: Buffer): Promise<void>;
}

const TYPES: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', xml: 'application/xml',
};

@Controller('dev-storage')
export class DevStorageController {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  private keyFrom(req: Request): string {
    const raw = (req.params as Record<string, string>)['0'] ?? '';
    return decodeURIComponent(raw.split('?')[0]);
  }

  /** Receive uploaded bytes (authorized: middleware requires a valid session + company). */
  @Put('*')
  async put(@Req() req: Request): Promise<{ ok: true; bytes: number }> {
    const key = this.keyFrom(req);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const data = Buffer.concat(chunks);
    await (this.storage as LocalStorage).put(key, data);
    return { ok: true, bytes: data.length };
  }

  /**
   * Serve bytes for the viewer. This route is excluded from the auth middleware so the
   * sandboxed <iframe>/<img> can load it without a bearer token, so the HMAC signature in
   * the URL (exp+sig, issued by getDownloadUrl) is the access control: an unsigned, forged,
   * or expired request gets 404 (same shape as a missing object — no key-existence oracle).
   * Path traversal is additionally refused by the storage adapter.
   */
  @Get('*')
  async get(@Req() req: Request, @Res() res: Response): Promise<void> {
    const key = this.keyFrom(req);
    const query = (req.query ?? {}) as Record<string, string | undefined>;
    if (!verifyStorageSignature(key, query.exp, query.sig)) {
      res.status(404).json({ statusCode: 404, message: 'Object not found' });
      return;
    }
    try {
      const buf = await this.storage.readObject(key);
      const ext = key.split('.').pop()?.toLowerCase() ?? '';
      res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
      res.setHeader('Content-Disposition', 'inline');
      res.send(buf);
    } catch {
      res.status(404).json({ statusCode: 404, message: 'Object not found' });
    }
  }
}
