import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { StorageService, UploadTarget } from '../application/storage.port';

/**
 * DEV storage adapter — local filesystem simulating object storage with WORM.
 * Production swaps in an S3 adapter (EU region, Object-Lock retention, presigned URLs);
 * the StorageService contract is identical so no caller changes.
 */
@Injectable()
export class LocalObjectStorage implements StorageService {
  private readonly root = process.env.DOC_STORAGE_DIR ?? '/tmp/doc-storage';
  private locked = new Set<string>();

  private full(key: string): string { return path.join(this.root, key); }

  async createUploadTarget(storageKey: string, contentType: string): Promise<UploadTarget> {
    await fs.mkdir(path.dirname(this.full(storageKey)), { recursive: true });
    // In prod this is a presigned S3 PUT URL; in dev a local upload route handles the bytes.
    return { url: `/dev-storage/${encodeURIComponent(storageKey)}`, method: 'PUT', headers: { 'content-type': contentType }, storageKey };
  }
  /** Dev helper used by the dev upload route / tests to place bytes. */
  async put(storageKey: string, data: Buffer): Promise<void> {
    if (this.locked.has(storageKey)) throw new Error('Object is immutable (WORM) — overwrite denied.');
    await fs.mkdir(path.dirname(this.full(storageKey)), { recursive: true });
    await fs.writeFile(this.full(storageKey), data);
  }
  async headObject(storageKey: string): Promise<{ exists: boolean; sizeBytes: number }> {
    try { const s = await fs.stat(this.full(storageKey)); return { exists: true, sizeBytes: s.size }; }
    catch { return { exists: false, sizeBytes: 0 }; }
  }
  async readPrefix(storageKey: string, n: number): Promise<Buffer> {
    const fh = await fs.open(this.full(storageKey), 'r');
    try { const buf = Buffer.alloc(n); const { bytesRead } = await fh.read(buf, 0, n, 0); return buf.subarray(0, bytesRead); }
    finally { await fh.close(); }
  }
  async readObject(storageKey: string): Promise<Buffer> { return fs.readFile(this.full(storageKey)); }
  async finalizeObject(storageKey: string): Promise<void> { this.locked.add(storageKey); } // WORM lock
  async getDownloadUrl(storageKey: string, ttlSeconds: number): Promise<string> {
    const exp = Date.now() + ttlSeconds * 1000;
    const sig = crypto.createHash('sha256').update(storageKey + exp).digest('hex').slice(0, 16);
    return `/dev-storage/${encodeURIComponent(storageKey)}?exp=${exp}&sig=${sig}`;
  }
}
