import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { PostingKind, PostingLineInput, PostingRequest, PostingStatus } from '../domain/posting/models';

interface ReqRow { id: string; review_package_id: string | null; document_id: string | null; requested_by: string; kind: PostingKind; status: PostingStatus; lines: PostingLineInput[] | null; error: string | null; created_at: string; }
const mapReq = (r: ReqRow): PostingRequest => ({ id: r.id, reviewPackageId: r.review_package_id ?? undefined, documentId: r.document_id ?? undefined, requestedBy: r.requested_by, kind: r.kind, status: r.status, lines: r.lines ?? undefined, error: r.error ?? undefined, createdAt: r.created_at });

@Injectable()
export class PostingRepository {
  async hasPostedForReview(db: ScopedClient, reviewPackageId: string): Promise<boolean> {
    const r = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM posting_requests WHERE review_package_id=$1 AND status='posted' AND kind='post'`, [reviewPackageId]);
    return Number(r.rows[0].n) > 0;
  }
  async createRequest(db: ScopedClient, tenantId: string, companyId: string, p: { reviewPackageId?: string; documentId?: string; requestedBy: string; kind: PostingKind; lines: PostingLineInput[] }): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO posting_requests (tenant_id, company_id, review_package_id, document_id, requested_by, kind, status, lines)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id`,
      [tenantId, companyId, p.reviewPackageId ?? null, p.documentId ?? null, p.requestedBy, p.kind, JSON.stringify(p.lines)]);
    return r.rows[0].id;
  }
  async setRequestStatus(db: ScopedClient, requestId: string, status: PostingStatus, error?: string): Promise<void> {
    await db.query(`UPDATE posting_requests SET status=$2, error=$3, updated_at=now() WHERE id=$1`, [requestId, status, error ?? null]);
  }
  async addResult(db: ScopedClient, tenantId: string, companyId: string, r: { postingRequestId: string; journalEntryId: string; reversesEntryId?: string }): Promise<void> {
    await db.query(
      `INSERT INTO posting_results (tenant_id, company_id, posting_request_id, journal_entry_id, reverses_entry_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [tenantId, companyId, r.postingRequestId, r.journalEntryId, r.reversesEntryId ?? null]);
  }
  async getByReview(db: ScopedClient, reviewPackageId: string): Promise<{ request: PostingRequest; journalEntryId?: string } | null> {
    const r = await db.query<ReqRow & { journal_entry_id: string | null }>(
      `SELECT pr.*, res.journal_entry_id
         FROM posting_requests pr
         LEFT JOIN posting_results res ON res.posting_request_id = pr.id
        WHERE pr.review_package_id=$1 ORDER BY pr.created_at DESC LIMIT 1`, [reviewPackageId]);
    if (!r.rows[0]) return null;
    return { request: mapReq(r.rows[0]), journalEntryId: r.rows[0].journal_entry_id ?? undefined };
  }
  async accountIdByCode(db: ScopedClient, code: string): Promise<{ id: string; isPostable: boolean } | null> {
    const r = await db.query<{ id: string; is_postable: boolean }>(`SELECT id, is_postable FROM accounts WHERE code=$1 LIMIT 1`, [code]);
    return r.rows[0] ? { id: r.rows[0].id, isPostable: r.rows[0].is_postable } : null;
  }
  async list(db: ScopedClient, limit: number, offset: number): Promise<PostingRequest[]> {
    const r = await db.query<ReqRow>(`SELECT * FROM posting_requests ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    return r.rows.map(mapReq);
  }
}
