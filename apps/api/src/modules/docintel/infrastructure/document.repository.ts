import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { Document, DocumentMetadata, DocumentStatus, DocumentWithMeta, DetectedType } from '../domain/models';

interface DocRow {
  id: string; company_id: string; original_filename: string; mime_type: string; size_bytes: string | null;
  status: DocumentStatus; storage_key: string | null; checksum_sha256: string | null;
  counterparty_id: string | null; document_date: string | null; source: string; uploaded_by: string | null;
  created_at: string; updated_at: string;
}
const mapDoc = (r: DocRow): Document => ({
  id: r.id, companyId: r.company_id, originalFilename: r.original_filename, mimeType: r.mime_type,
  sizeBytes: r.size_bytes == null ? undefined : Number(r.size_bytes), status: r.status,
  storageKey: r.storage_key ?? undefined, checksumSha256: r.checksum_sha256 ?? undefined,
  counterpartyId: r.counterparty_id ?? undefined, documentDate: r.document_date ?? undefined,
  source: r.source, uploadedBy: r.uploaded_by ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

@Injectable()
export class DocumentRepository {
  async createPending(db: ScopedClient, tenantId: string, companyId: string, d: {
    filename: string; mimeType: string; sizeBytes: number; storageKey: string; uploadedBy?: string;
  }): Promise<Document> {
    const r = await db.query<DocRow>(
      `INSERT INTO documents (tenant_id, company_id, original_filename, mime_type, size_bytes, status, storage_key, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,'pending_upload',$6,$7) RETURNING *`,
      [tenantId, companyId, d.filename, d.mimeType, d.sizeBytes, d.storageKey, d.uploadedBy ?? null]);
    return mapDoc(r.rows[0]);
  }
  async getById(db: ScopedClient, id: string): Promise<Document | null> {
    const r = await db.query<DocRow>(`SELECT * FROM documents WHERE id=$1`, [id]);
    return r.rows[0] ? mapDoc(r.rows[0]) : null;
  }
  async setStatus(db: ScopedClient, id: string, status: DocumentStatus, extra?: { checksum?: string; sizeBytes?: number }): Promise<Document> {
    const r = await db.query<DocRow>(
      `UPDATE documents SET status=$2,
         checksum_sha256=COALESCE($3,checksum_sha256), size_bytes=COALESCE($4,size_bytes), updated_at=now()
       WHERE id=$1 RETURNING *`,
      [id, status, extra?.checksum ?? null, extra?.sizeBytes ?? null]);
    return mapDoc(r.rows[0]);
  }
  async trash(db: ScopedClient, id: string): Promise<Document> {
    const r = await db.query<DocRow>(
      `UPDATE documents SET status='trashed', trashed_at=now(), updated_at=now() WHERE id=$1 RETURNING *`, [id]);
    return mapDoc(r.rows[0]);
  }
  async addVersion(db: ScopedClient, tenantId: string, companyId: string, v: {
    documentId: string; versionNo: number; storageKey: string; checksum: string; sizeBytes: number;
  }): Promise<void> {
    await db.query(
      `INSERT INTO document_versions (tenant_id, company_id, document_id, version_no, storage_key, checksum_sha256, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenantId, companyId, v.documentId, v.versionNo, v.storageKey, v.checksum, v.sizeBytes]);
  }
  async upsertMetadata(db: ScopedClient, tenantId: string, companyId: string, m: {
    documentId: string; detectedType?: DetectedType; scanStatus?: string; scanEngine?: string; scannedAt?: boolean;
  }): Promise<void> {
    await db.query(
      `INSERT INTO document_metadata (document_id, tenant_id, company_id, detected_type, scan_status, scan_engine, scanned_at)
       VALUES ($1,$2,$3,$4,COALESCE($5,'pending'),$6, CASE WHEN $7 THEN now() ELSE NULL END)
       ON CONFLICT (document_id) DO UPDATE SET
         detected_type=COALESCE($4, document_metadata.detected_type),
         scan_status=COALESCE($5, document_metadata.scan_status),
         scan_engine=COALESCE($6, document_metadata.scan_engine),
         scanned_at=CASE WHEN $7 THEN now() ELSE document_metadata.scanned_at END,
         updated_at=now()`,
      [m.documentId, tenantId, companyId, m.detectedType ?? null, m.scanStatus ?? null, m.scanEngine ?? null, m.scannedAt ?? false]);
  }
  async getMetadata(db: ScopedClient, documentId: string): Promise<DocumentMetadata | null> {
    const r = await db.query<{ document_id: string; detected_type: DetectedType | null; page_count: number | null; scan_status: DocumentMetadata['scanStatus']; scan_engine: string | null; scanned_at: string | null }>(
      `SELECT * FROM document_metadata WHERE document_id=$1`, [documentId]);
    const x = r.rows[0]; if (!x) return null;
    return { documentId: x.document_id, detectedType: x.detected_type ?? undefined, pageCount: x.page_count ?? undefined, scanStatus: x.scan_status, scanEngine: x.scan_engine ?? undefined, scannedAt: x.scanned_at ?? undefined };
  }
  async nextVersionNo(db: ScopedClient, documentId: string): Promise<number> {
    const r = await db.query<{ n: number | null }>(`SELECT max(version_no) AS n FROM document_versions WHERE document_id=$1`, [documentId]);
    return (r.rows[0].n ?? 0) + 1;
  }

  async list(db: ScopedClient, q: { status?: DocumentStatus; type?: DetectedType; search?: string; limit: number; offset: number }): Promise<{ items: DocumentWithMeta[]; total: number }> {
    const where: string[] = ['true']; const params: unknown[] = [];
    if (q.status) { params.push(q.status); where.push(`d.status=$${params.length}`); }
    else { where.push(`d.status NOT IN ('trashed','deleted')`); } // hide trash + purged from the default view
    if (q.type) { params.push(q.type); where.push(`m.detected_type=$${params.length}`); }
    if (q.search) { params.push(`%${q.search.toLowerCase()}%`); where.push(`lower(d.original_filename) LIKE $${params.length}`); }
    const w = where.join(' AND ');
    const total = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM documents d LEFT JOIN document_metadata m ON m.document_id=d.id WHERE ${w}`, params);
    params.push(q.limit); params.push(q.offset);
    const rows = await db.query<DocRow & { detected_type: DetectedType | null; scan_status: DocumentMetadata['scanStatus'] | null }>(
      `SELECT d.*, m.detected_type, m.scan_status FROM documents d
         LEFT JOIN document_metadata m ON m.document_id=d.id
        WHERE ${w} ORDER BY d.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const items: DocumentWithMeta[] = rows.rows.map((r) => ({
      ...mapDoc(r),
      metadata: r.scan_status ? { documentId: r.id, detectedType: r.detected_type ?? undefined, scanStatus: r.scan_status } : undefined,
    }));
    return { items, total: Number(total.rows[0].n) };
  }
}
