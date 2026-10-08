import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import type { ScopedClient } from './scoped-client';

/**
 * Durable, DB-backed idempotency for money-moving operations (P0 — Pass 1A).
 *
 * The claim is made INSIDE the caller's transaction, so the idempotency row commits
 * atomically with the payment/journal it guards. The UNIQUE(tenant,company,operation,key)
 * index is the concurrency primitive: a concurrent second request with the same key blocks
 * on the uncommitted claim until the first transaction finishes, then observes the committed
 * result (replay) — or, if the first rolled back, wins the insert and performs the operation.
 *
 * Never use an in-memory map for this — a process restart or a second instance would lose it.
 */
export interface IdempotencyKeyArgs {
  tenantId: string;
  companyId: string;
  operation: string;
  key: string;
  fingerprint: string;
}
export type IdempotencyClaim =
  | { status: 'owned'; id: string }
  | { status: 'replay'; result: Record<string, unknown> }
  | { status: 'conflict' };

@Injectable()
export class IdempotencyRepository {
  /**
   * Claim the (operation,key) for this request, in the caller's transaction.
   * - 'owned'    → we inserted the claim; the caller MUST perform the op and then call complete().
   * - 'replay'   → the same key+fingerprint already completed; return its stored result, do nothing else.
   * - 'conflict' → the key was used with a DIFFERENT payload; the caller MUST refuse and not mutate.
   */
  async claim(db: ScopedClient, a: IdempotencyKeyArgs): Promise<IdempotencyClaim> {
    const ins = await db.query<{ id: string }>(
      `INSERT INTO financial_write_idempotency (tenant_id, company_id, operation, idempotency_key, request_fingerprint)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, company_id, operation, idempotency_key) DO NOTHING
       RETURNING id`,
      [a.tenantId, a.companyId, a.operation, a.key, a.fingerprint]);
    if (ins.rows[0]) return { status: 'owned', id: ins.rows[0].id };

    // Conflict: a committed row exists (the INSERT above blocked on any in-flight claim until it
    // committed; had it rolled back, our insert would have succeeded and we'd own it).
    const ex = await db.query<{ request_fingerprint: string; result_json: Record<string, unknown> | null }>(
      `SELECT request_fingerprint, result_json FROM financial_write_idempotency
        WHERE tenant_id=$1 AND company_id=$2 AND operation=$3 AND idempotency_key=$4`,
      [a.tenantId, a.companyId, a.operation, a.key]);
    const row = ex.rows[0];
    if (!row) return { status: 'conflict' };                 // defensive: unexpected, fail closed
    if (row.request_fingerprint !== a.fingerprint) return { status: 'conflict' };
    return { status: 'replay', result: row.result_json ?? {} };
  }

  /** Record the result on the owned claim (same transaction as the guarded write). */
  async complete(db: ScopedClient, id: string, result: Record<string, unknown>): Promise<void> {
    await db.query(`UPDATE financial_write_idempotency SET result_json = $2::jsonb WHERE id = $1`,
      [id, JSON.stringify(result)]);
  }
}

/**
 * Canonical request fingerprint: a stable sha256 over the operation + a key-sorted payload,
 * so the SAME semantic request hashes identically and ANY change (amount, document, date,
 * currency, account, lines) changes the hash and is refused as a conflict.
 */
export function canonicalFingerprint(operation: string, payload: unknown): string {
  return crypto.createHash('sha256').update(operation + '\n' + stableStringify(payload)).digest('hex');
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
