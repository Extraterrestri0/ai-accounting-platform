import { Injectable } from '@nestjs/common';
import type { StorageHealthProbe } from './health.service';

/** Dev probe — local object storage is always reachable. Prod binds an S3/MinIO probe (headBucket). */
@Injectable()
export class LocalStorageProbe implements StorageHealthProbe {
  async ping(): Promise<{ ok: boolean; detail?: string }> { return { ok: true, detail: 'local' }; }
}
