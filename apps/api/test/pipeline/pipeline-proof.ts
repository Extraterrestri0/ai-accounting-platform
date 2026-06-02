import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { startConsumers } from '../../src/worker/consumers';
import { JobContextRunner } from '../../src/platform/database/job-context.runner';
import { MALWARE_SCAN_QUEUE } from '../../src/modules/docintel';
import type { MalwareScanQueue } from '../../src/modules/docintel/application/scan.port';
import { EXTRACTION_SERVICE, type IExtractionService } from '../../src/modules/docintel';

const A = '11111111-1111-1111-1111-111111111111';
const CA = 'c1111111-1111-1111-1111-111111111111';
const DOC = 'd0000000-0000-0000-0000-0000000000d5';
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log(`  ${c ? '\u2713 PASS' : '\u2717 FAIL'}: ${m}`); c ? pass++ : fail++; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const workers = startConsumers(app);
  const scanQueue = app.get<MalwareScanQueue>(MALWARE_SCAN_QUEUE);
  const runner = app.get(JobContextRunner);
  const extraction = app.get<IExtractionService>(EXTRACTION_SERVICE);
  const pool = new Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE });
  const q = async (sql: string, params: unknown[] = []) => {
    const c = await pool.connect();
    try { await c.query("SELECT set_config('app.tenant_id',$1,false)", [A]); await c.query("SELECT set_config('app.company_id',$1,false)", [CA]); return await c.query(sql, params); }
    finally { c.release(); }
  };

  console.log('\n=== DOCUMENT PIPELINE (real BullMQ + worker + OCR / live Redis + PostgreSQL) ===\n');
  ok(scanQueue.constructor.name === 'RedisScanQueue', `scan queue is real BullMQ (${scanQueue.constructor.name})`);

  await scanQueue.enqueue({ documentId: DOC, tenantId: A, companyId: CA, storageKey: 'docs/inv1.pdf' });
  console.log('  - scan job enqueued; waiting for worker to process the pipeline...');

  let status = '', extractionRows = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const s = await q('SELECT status FROM documents WHERE id=$1', [DOC]);
    status = s.rows[0]?.status ?? '';
    const e = await q('SELECT count(*)::int n FROM document_extractions WHERE document_id=$1', [DOC]);
    extractionRows = e.rows[0]?.n ?? 0;
    if (status === 'ready' && extractionRows > 0) break;
  }
  ok(status === 'ready', `Scan executed -> document scanning -> ready (status=${status})`);
  ok(extractionRows > 0, `OCR + Extraction executed by the worker (document_extractions=${extractionRows})`);

  const fld = await q("SELECT engine FROM extraction_runs WHERE document_id=$1 ORDER BY started_at DESC LIMIT 1", [DOC]).catch(() => ({ rows: [] as Array<{ engine: string }> }));
  const engine = fld.rows[0]?.engine ?? 'n/a';
  ok(engine.includes('pdf-text') || engine.includes('ocr') || engine.includes('vendor'), `extraction engine is real (${engine})`);

  await runner.run({ tenantId: A, userId: 'system-worker', companyId: CA }, async () => {
    const pkg = await extraction.getReviewPackage(DOC);
    ok(!!pkg && Array.isArray(pkg.fields), `Review Package built (${pkg.fields.length} fields)`);
  });

  await Promise.all(workers.map((w) => w.close()));
  await pool.end(); await app.close();
  console.log(`\n=== PIPELINE RESULT: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('PIPELINE CRASHED:', e); process.exit(1); });
