import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { ReviewActionLog, ReviewActionType, ReviewComment, ReviewerDashboard, ReviewPackage, ReviewQueueItem, ReviewStatus } from '../domain/review/models';

interface PkgRow {
  id: string; document_id: string; extraction_id: string | null; accounting_suggestion_id: string | null;
  status: ReviewStatus; assigned_reviewer_id: string | null; approved_account_id: string | null;
  approved_vat_code_id: string | null; approved_posting: unknown; decided_by: string | null; decided_at: string | null; created_at: string;
}
const mapPkg = (r: PkgRow): ReviewPackage => ({
  id: r.id, documentId: r.document_id, extractionId: r.extraction_id ?? undefined, accountingSuggestionId: r.accounting_suggestion_id ?? undefined,
  status: r.status, assignedReviewerId: r.assigned_reviewer_id ?? undefined, approvedAccountId: r.approved_account_id ?? undefined,
  approvedVatCodeId: r.approved_vat_code_id ?? undefined, approvedPosting: r.approved_posting ?? undefined,
  decidedBy: r.decided_by ?? undefined, decidedAt: r.decided_at ?? undefined, createdAt: r.created_at,
});

@Injectable()
export class ReviewRepository {
  async create(db: ScopedClient, tenantId: string, companyId: string, p: { documentId: string; extractionId?: string; accountingSuggestionId?: string }): Promise<ReviewPackage> {
    const r = await db.query<PkgRow>(
      `INSERT INTO review_packages (tenant_id, company_id, document_id, extraction_id, accounting_suggestion_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, document_id) DO UPDATE SET extraction_id=EXCLUDED.extraction_id, accounting_suggestion_id=EXCLUDED.accounting_suggestion_id, updated_at=now()
       RETURNING *`,
      [tenantId, companyId, p.documentId, p.extractionId ?? null, p.accountingSuggestionId ?? null]);
    return mapPkg(r.rows[0]);
  }
  async getByDocument(db: ScopedClient, documentId: string): Promise<ReviewPackage | null> {
    const r = await db.query<PkgRow>(`SELECT * FROM review_packages WHERE document_id=$1`, [documentId]);
    return r.rows[0] ? mapPkg(r.rows[0]) : null;
  }
  async getById(db: ScopedClient, id: string): Promise<ReviewPackage | null> {
    const r = await db.query<PkgRow>(`SELECT * FROM review_packages WHERE id=$1`, [id]);
    return r.rows[0] ? mapPkg(r.rows[0]) : null;
  }
  async setDecision(db: ScopedClient, id: string, status: ReviewStatus, decidedBy: string, approved?: { accountId?: string; vatCodeId?: string; posting?: unknown }): Promise<void> {
    await db.query(
      `UPDATE review_packages SET status=$2, decided_by=$3, decided_at=now(),
         approved_account_id=COALESCE($4, approved_account_id),
         approved_vat_code_id=COALESCE($5, approved_vat_code_id),
         approved_posting=COALESCE($6, approved_posting), updated_at=now()
       WHERE id=$1`,
      [id, status, decidedBy, approved?.accountId ?? null, approved?.vatCodeId ?? null, approved?.posting ? JSON.stringify(approved.posting) : null]);
  }
  async assign(db: ScopedClient, id: string, reviewerId: string): Promise<void> {
    await db.query(`UPDATE review_packages SET assigned_reviewer_id=$2, updated_at=now() WHERE id=$1`, [id, reviewerId]);
  }
  /** HUMAN-only action log (DB also enforces actor_type='user'). */
  async addAction(db: ScopedClient, tenantId: string, companyId: string, a: { packageId: string; actionType: ReviewActionType; actorId: string; payload?: unknown }): Promise<void> {
    await db.query(
      `INSERT INTO review_actions (tenant_id, company_id, review_package_id, action_type, actor_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, companyId, a.packageId, a.actionType, a.actorId, a.payload ? JSON.stringify(a.payload) : null]);
  }
  async addComment(db: ScopedClient, tenantId: string, companyId: string, packageId: string, authorId: string, body: string): Promise<void> {
    await db.query(`INSERT INTO review_comments (tenant_id, company_id, review_package_id, author_id, body) VALUES ($1,$2,$3,$4,$5)`, [tenantId, companyId, packageId, authorId, body]);
  }
  async listComments(db: ScopedClient, packageId: string): Promise<ReviewComment[]> {
    const r = await db.query<{ id: string; author_id: string; body: string; created_at: string }>(`SELECT * FROM review_comments WHERE review_package_id=$1 ORDER BY created_at`, [packageId]);
    return r.rows.map((x) => ({ id: x.id, authorId: x.author_id, body: x.body, createdAt: x.created_at }));
  }
  async listActions(db: ScopedClient, packageId: string): Promise<ReviewActionLog[]> {
    const r = await db.query<{ id: string; action_type: ReviewActionType; actor_id: string; payload: unknown; created_at: string }>(`SELECT * FROM review_actions WHERE review_package_id=$1 ORDER BY created_at`, [packageId]);
    return r.rows.map((x) => ({ id: x.id, actionType: x.action_type, actorId: x.actor_id, payload: x.payload ?? undefined, createdAt: x.created_at }));
  }
  async listQueue(db: ScopedClient, f: { status?: ReviewStatus; assignedTo?: string; limit: number; offset: number }): Promise<{ items: ReviewQueueItem[]; total: number }> {
    const where: string[] = ['true']; const params: unknown[] = [];
    if (f.status) { params.push(f.status); where.push(`p.status=$${params.length}`); }
    if (f.assignedTo) { params.push(f.assignedTo); where.push(`p.assigned_reviewer_id=$${params.length}`); }
    const w = where.join(' AND ');
    const total = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM review_packages p WHERE ${w}`, params);
    params.push(f.limit); params.push(f.offset);
    const rows = await db.query<{ id: string; document_id: string; filename: string; status: ReviewStatus; assigned_reviewer_id: string | null; confidence: string | null; is_duplicate: boolean | null; created_at: string }>(
      `SELECT p.id, p.document_id, d.original_filename AS filename, p.status, p.assigned_reviewer_id,
              s.confidence, s.is_duplicate, p.created_at
         FROM review_packages p
         JOIN documents d ON d.id = p.document_id
         LEFT JOIN accounting_suggestions s ON s.id = p.accounting_suggestion_id
        WHERE ${w} ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return {
      items: rows.rows.map((x) => ({ id: x.id, documentId: x.document_id, filename: x.filename, status: x.status, assignedReviewerId: x.assigned_reviewer_id ?? undefined, confidence: x.confidence == null ? undefined : Number(x.confidence), isDuplicate: x.is_duplicate ?? false, createdAt: x.created_at })),
      total: Number(total.rows[0].n),
    };
  }
  async dashboard(db: ScopedClient, userId?: string): Promise<ReviewerDashboard> {
    const r = await db.query<{ status: ReviewStatus; n: string }>(`SELECT status, count(*)::text AS n FROM review_packages GROUP BY status`);
    const by = (s: ReviewStatus) => Number(r.rows.find((x) => x.status === s)?.n ?? 0);
    const mine = userId ? await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM review_packages WHERE assigned_reviewer_id=$1 AND status IN ('pending','needs_correction')`, [userId]) : null;
    return { pending: by('pending'), needsCorrection: by('needs_correction'), approved: by('approved'), rejected: by('rejected'), assignedToMe: mine ? Number(mine.rows[0].n) : 0 };
  }
  async markSuggestion(db: ScopedClient, suggestionId: string, status: 'accepted' | 'rejected'): Promise<void> {
    await db.query(`UPDATE accounting_suggestions SET status=$2 WHERE id=$1`, [suggestionId, status]);
  }
}
