import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, HeadBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageService, UploadTarget } from '../application/storage.port';

/**
 * Production object storage — AWS S3, or MinIO via STORAGE_ENDPOINT (path-style).
 * Uses the configured bucket/region/credentials, issues presigned PUT/GET URLs, and applies
 * Object-Lock (WORM) retention on finalize. Bucket existence is validated at startup.
 */
@Injectable()
export class S3ObjectStorage implements StorageService, OnModuleInit {
  private readonly log = new Logger('S3Storage');
  private readonly bucket = process.env.STORAGE_BUCKET ?? '';
  private readonly retainDays = Number(process.env.STORAGE_RETAIN_DAYS ?? 3650);
  private readonly client = new S3Client({
    region: process.env.STORAGE_REGION ?? 'eu-central-1',
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    forcePathStyle: !!process.env.STORAGE_ENDPOINT,
    credentials: process.env.STORAGE_ACCESS_KEY ? { accessKeyId: process.env.STORAGE_ACCESS_KEY, secretAccessKey: process.env.STORAGE_SECRET_KEY ?? '' } : undefined,
  });

  async onModuleInit(): Promise<void> {
    if (!this.bucket) throw new Error('STORAGE_BUCKET is required.');
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    this.log.log(`bucket "${this.bucket}" reachable (region ${process.env.STORAGE_REGION})`);
  }

  async createUploadTarget(storageKey: string, contentType: string): Promise<UploadTarget> {
    const url = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, ContentType: contentType }), { expiresIn: 900 });
    return { url, method: 'PUT', headers: { 'content-type': contentType }, storageKey };
  }

  async headObject(storageKey: string): Promise<{ exists: boolean; sizeBytes: number }> {
    try { const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey })); return { exists: true, sizeBytes: r.ContentLength ?? 0 }; }
    catch { return { exists: false, sizeBytes: 0 }; }
  }

  async readPrefix(storageKey: string, n: number): Promise<Buffer> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey, Range: `bytes=0-${Math.max(0, n - 1)}` }));
    return this.toBuffer(r.Body);
  }

  async readObject(storageKey: string): Promise<Buffer> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    return this.toBuffer(r.Body);
  }

  /** WORM: set Object-Lock COMPLIANCE retention so the object cannot be altered/deleted until expiry. */
  async finalizeObject(storageKey: string): Promise<void> {
    const retainUntil = new Date(Date.now() + this.retainDays * 24 * 60 * 60 * 1000);
    const head = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    const body = await this.toBuffer(head.Body);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: body, ObjectLockMode: 'COMPLIANCE', ObjectLockRetainUntilDate: retainUntil }));
  }

  async getDownloadUrl(storageKey: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }), { expiresIn: ttlSeconds });
  }
  /** Permanent delete (purge). Note: Object-Lock COMPLIANCE retention may block this until expiry. */
  async deleteObject(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  private async toBuffer(body: unknown): Promise<Buffer> {
    const b = body as { transformToByteArray(): Promise<Uint8Array> };
    return Buffer.from(await b.transformToByteArray());
  }
}
