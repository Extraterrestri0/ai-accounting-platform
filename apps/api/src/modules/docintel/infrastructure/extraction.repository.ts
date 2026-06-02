import { Injectable } from '@nestjs/common';
import type { ScopedClient } from '../../../platform';
import type { DocumentExtraction, ExtractedField, FieldKey, RunMethod, RunStatus } from '../domain/extraction/models';

@Injectable()
export class ExtractionRepository {
  async hasActiveRun(db: ScopedClient, documentId: string): Promise<boolean> {
    const r = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM extraction_runs WHERE document_id=$1 AND status IN ('pending','running')`, [documentId]);
    return Number(r.rows[0].n) > 0;
  }
  async createRun(db: ScopedClient, tenantId: string, companyId: string, documentId: string, method: RunMethod, engine: string): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO extraction_runs (tenant_id, company_id, document_id, method, engine, status, started_at)
       VALUES ($1,$2,$3,$4,$5,'running',now()) RETURNING id`,
      [tenantId, companyId, documentId, method, engine]);
    return r.rows[0].id;
  }
  async finishRun(db: ScopedClient, runId: string, status: RunStatus, overall: number | null, error?: string): Promise<void> {
    await db.query(
      `UPDATE extraction_runs SET status=$2, overall_confidence=$3, error=$4, finished_at=now() WHERE id=$1`,
      [runId, status, overall, error ?? null]);
  }
  /** Supersede any current extraction, then insert the new one + its fields. */
  async saveExtraction(db: ScopedClient, tenantId: string, companyId: string, documentId: string, runId: string, docType: string, overall: number, fields: ExtractedField[]): Promise<string> {
    await db.query(`UPDATE document_extractions SET status='superseded' WHERE document_id=$1 AND status='extracted'`, [documentId]);
    const ex = await db.query<{ id: string }>(
      `INSERT INTO document_extractions (tenant_id, company_id, document_id, run_id, doc_type, overall_confidence)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [tenantId, companyId, documentId, runId, docType, overall]);
    const extractionId = ex.rows[0].id;
    for (const f of fields) {
      await db.query(
        `INSERT INTO extraction_fields (tenant_id, company_id, extraction_id, field_key, value_text, value_normalized, confidence, source, validation_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenantId, companyId, extractionId, f.key, f.valueText ?? null, f.valueNormalized ?? null, f.confidence, f.source, f.validationStatus]);
    }
    return extractionId;
  }
  async getCurrentExtraction(db: ScopedClient, documentId: string): Promise<DocumentExtraction | null> {
    const e = await db.query<{ id: string; document_id: string; run_id: string; doc_type: DocumentExtraction['docType']; overall_confidence: string; status: DocumentExtraction['status'] }>(
      `SELECT * FROM document_extractions WHERE document_id=$1 AND status='extracted'`, [documentId]);
    if (!e.rows[0]) return null;
    const x = e.rows[0];
    const fr = await db.query<{ field_key: FieldKey; value_text: string | null; value_normalized: string | null; confidence: string; source: ExtractedField['source']; validation_status: ExtractedField['validationStatus'] }>(
      `SELECT * FROM extraction_fields WHERE extraction_id=$1 ORDER BY field_key`, [x.id]);
    const fields: ExtractedField[] = fr.rows.map((r) => ({ key: r.field_key, valueText: r.value_text ?? undefined, valueNormalized: r.value_normalized ?? undefined, confidence: Number(r.confidence), source: r.source, validationStatus: r.validation_status }));
    return { id: x.id, documentId: x.document_id, runId: x.run_id, docType: x.doc_type, overallConfidence: Number(x.overall_confidence), status: x.status, fields };
  }
}
