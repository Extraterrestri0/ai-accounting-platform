/**
 * Object-storage abstraction. Prod adapter = AWS S3 (EU, Object-Lock/WORM, presigned URLs);
 * dev adapter = local filesystem simulating immutability. The DB stores keys + checksums only.
 */
export interface UploadTarget { url: string; method: 'PUT'; headers: Record<string, string>; storageKey: string; }

export interface StorageService {
  /** Allocate a key + a target the client uploads bytes to (presigned PUT in prod). */
  createUploadTarget(storageKey: string, contentType: string): Promise<UploadTarget>;
  /**
   * Server-side write of bytes (e.g. worker-generated SAF-T XML). Optionally applies WORM
   * (Object-Lock) retention on write. Returns the stored size and, if locked, the retention end.
   */
  putObject(storageKey: string, body: Buffer, contentType: string, opts?: { worm?: boolean; retainDays?: number }): Promise<{ sizeBytes: number; retainUntil?: string }>;
  /** Confirm the object exists and return its size (HEAD). */
  headObject(storageKey: string): Promise<{ exists: boolean; sizeBytes: number }>;
  /** Read the first N bytes (for server-side magic-byte validation). */
  readPrefix(storageKey: string, n: number): Promise<Buffer>;
  /** Read the full object (used by the OCR/extraction pipeline). */
  readObject(storageKey: string): Promise<Buffer>;
  /** Apply WORM/Object-Lock retention — the object becomes immutable. */
  finalizeObject(storageKey: string): Promise<void>;
  /** Short-lived signed GET URL for the sandboxed viewer. */
  getDownloadUrl(storageKey: string, ttlSeconds: number): Promise<string>;
  /** Permanently remove the object bytes (document purge / permanent delete). */
  deleteObject(storageKey: string): Promise<void>;
}
export const STORAGE_SERVICE = Symbol('DocIntel.StorageService');
