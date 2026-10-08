import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { JobContextRunner } from '../../src/platform/database/job-context.runner';
import { startConsumers } from '../../src/worker/consumers';
import { SaftQueueMonitor } from '../../src/modules/health/application/saft-queue.monitor';
import { LEDGER_SERVICE, type ILedgerService } from '../../src/modules/ledger';
import { SAFT_EXPORT_SERVICE, type ISaftExportService } from '../../src/modules/saft';
import { STORAGE_SERVICE, type StorageService } from '../../src/modules/docintel';

/**
 * SAF-T v2 end-to-end (real services · live Postgres · local storage · optional Redis).
 * Exercises the full pipeline behind SAFT_XML_ENABLED: requestExport → process → render →
 * XSD harness → storage write → artifact row → signed download → audit, plus sha256 integrity,
 * idempotency, and cross-tenant RLS. Run via scripts/e2e.sh (STORAGE_DRIVER=local).
 */
process.env.SAFT_XML_ENABLED = 'true';
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? 'local';

const A = '11111111-1111-1111-1111-111111111111';
const CA = 'c1111111-1111-1111-1111-111111111111';
const U = 'eeeeeeee-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const CB = 'c2222222-2222-2222-2222-222222222222';
const UB = 'eeeeeeee-2222-2222-2222-222222222222';
const ACC = { exp: 'a0000000-0000-0000-0000-000000000602', vatIn: 'a0000000-0000-0000-0000-000000004531', pay: 'a0000000-0000-0000-0000-000000000401' };

let pass = 0; let fail = 0;
const ok = (cond: boolean, msg: string): void => { console.log(`${cond ? '  ✓ PASS' : '  ✗ FAIL'}: ${msg}`); cond ? pass++ : fail++; };
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const runner = app.get(JobContextRunner);
  const saft = app.get<ISaftExportService>(SAFT_EXPORT_SERVICE);
  const ledger = app.get<ILedgerService>(LEDGER_SERVICE);
  const storage = app.get<StorageService>(STORAGE_SERVICE);
  const monitor = app.get(SaftQueueMonitor);
  const owner = new Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.MIGRATION_USER, password: process.env.MIGRATION_PASSWORD, database: process.env.PGDATABASE });

  const human = { tenantId: A, userId: U, companyId: CA };
  const now = new Date(); const Y = now.getFullYear(); const M = now.getMonth() + 1; const TODAY = now.toISOString().slice(0, 10);
  console.log('\n=== SAF-T v2 E2E (real services · live PostgreSQL) ===\n');

  // 0) migrations 0035/0036 present
  const mig = await owner.query("SELECT filename FROM schema_migrations WHERE filename IN ('0035_saft_export_v2.up.sql','0036_saft_dataquality.up.sql')");
  ok(mig.rowCount === 2, 'migrations 0035 + 0036 applied');

  // 1) seed a posted purchase (real LedgerService — source_type 'review')
  await runner.run(human, async () => {
    await ledger.postEntry({ postingDate: TODAY, description: 'Approved purchase (saft v2 e2e)', sourceType: 'review', currency: 'EUR',
      lines: [{ accountId: ACC.exp, direction: 'debit', amount: '200.00' }, { accountId: ACC.vatIn, direction: 'debit', amount: '40.00' }, { accountId: ACC.pay, direction: 'credit', amount: '240.00' }] });
  });

  // 2) request export (async v2) → queued
  let exportId = '';
  await runner.run(human, async () => {
    const rec = await saft.requestExport(Y, M);
    ok(rec.status === 'queued', `requestExport → queued (${rec.id})`);
    exportId = rec.id;
  });

  // 3) drive processing: via the real BullMQ worker if Redis is reachable, else directly.
  const redisUp = await monitor.redisReachable();
  let workers: Array<{ close(): Promise<void> }> = [];
  if (redisUp) {
    workers = startConsumers(app) as unknown as Array<{ close(): Promise<void> }>;
    let status = 'queued';
    for (let i = 0; i < 40 && status !== 'completed' && status !== 'failed'; i++) {
      await sleep(250);
      const r = await owner.query<{ status: string }>('SELECT status FROM saft_exports WHERE id=$1', [exportId]);
      status = r.rows[0]?.status ?? 'queued';
    }
    ok(status === 'completed', `BullMQ worker processed the job → ${status}`);
  } else {
    await runner.run({ ...human, userId: 'system-worker' }, async () => { await saft.processExport(exportId); });
    ok(true, 'no Redis — processed directly (in-memory queue path)');
  }

  // 4) export completed + artifact persisted (inspect as owner)
  const exp = await owner.query<{ status: string; xsd_valid: boolean | null }>('SELECT status, xsd_valid FROM saft_exports WHERE id=$1', [exportId]);
  ok(exp.rows[0]?.status === 'completed', 'export status = completed');
  ok(exp.rows[0]?.xsd_valid === null, 'xsd_valid = null (harness inert: no schema bound)');

  const art = await owner.query<{ id: string; storage_key: string; content_type: string; size_bytes: string; sha256: string; kind: string }>(
    'SELECT id, storage_key, content_type, size_bytes, sha256, kind FROM saft_export_artifacts WHERE export_id=$1', [exportId]);
  ok(art.rowCount === 1, 'one xml artifact row persisted');
  const a = art.rows[0];
  ok(a?.kind === 'xml' && a.content_type === 'application/xml', 'artifact kind=xml, content-type application/xml');
  ok(/^[0-9a-f]{64}$/.test(a?.sha256 ?? ''), 'artifact has a sha256');

  // 5) sha256 INTEGRITY: re-read the stored bytes and recompute
  const bytes = await storage.readObject(a.storage_key);
  const recomputed = createHash('sha256').update(bytes).digest('hex');
  ok(recomputed === a.sha256, 'stored XML bytes match persisted sha256 (integrity)');
  ok(Number(a.size_bytes) === bytes.length, 'persisted size_bytes matches stored object');
  ok(bytes.toString('utf8').startsWith('<?xml'), 'stored artifact is XML');

  // 6) signed download URL + download audit
  await runner.run(human, async () => {
    const dl = await saft.getDownloadUrl(exportId);
    ok(!!dl && !!dl.url, 'getDownloadUrl returns a signed URL');
  });
  const dlAudit = await owner.query("SELECT 1 FROM audit_events WHERE action='saft.export_downloaded' AND entity_id=$1", [exportId]);
  ok((dlAudit.rowCount ?? 0) >= 1, 'saft.export_downloaded audit event written');
  const genAudit = await owner.query("SELECT 1 FROM audit_events WHERE action='saft.export_generated' AND entity_id=$1", [exportId]);
  ok((genAudit.rowCount ?? 0) >= 1, 'saft.export_generated audit event written');

  // 7) idempotency: re-processing a completed export is a no-op (still one artifact)
  await runner.run({ ...human, userId: 'system-worker' }, async () => { await saft.processExport(exportId); });
  const art2 = await owner.query('SELECT id FROM saft_export_artifacts WHERE export_id=$1', [exportId]);
  ok(art2.rowCount === 1, 'duplicate processExport is a no-op (still one artifact)');

  // 8) cross-tenant RLS: tenant B cannot obtain a download for tenant A's export
  await runner.run({ tenantId: B, userId: UB, companyId: CB }, async () => {
    const dl = await saft.getDownloadUrl(exportId);
    ok(dl === null, 'tenant B cannot download tenant A artifact (RLS isolation)');
  });

  // 9) queue monitor stats are observable (operational metrics surface)
  const stats = await monitor.stats();
  ok(stats === null || typeof stats.workers === 'number', 'queue monitor returns stats (or null without Redis)');

  for (const w of workers) { try { await w.close(); } catch { /* ignore */ } }
  await owner.end();
  await app.close();
  console.log(`\n=== SAF-T v2 E2E: ${pass} passed, ${fail} failed ===\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
