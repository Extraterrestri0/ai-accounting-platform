'use client';
/**
 * Extraction Review — shows OCR/XML extracted fields with per-field confidence and
 * deterministic-validation status. This is the review-ready package the Rules Engine (009)
 * and Review Queue (010) consume. Read-only here; correction/approval is Task 010.
 * AI proposes — it never posts (Invariant 4).
 */
import { useQuery } from '@tanstack/react-query';

type Validation = 'valid' | 'invalid' | 'warning' | 'unchecked';
interface Field { key: string; valueText?: string; confidence: number; source: 'ocr' | 'xml' | 'derived'; validationStatus: Validation; }
interface ReviewPackage {
  documentId: string; docType: string; overallConfidence: number; fields: Field[];
  flags: { lowConfidenceFields: string[]; failedValidations: string[]; missingRequired: string[] };
}
const LABEL: Record<string, string> = {
  supplier_name: 'Supplier', supplier_vat: 'Supplier VAT', supplier_eik: 'Supplier EIK', customer_name: 'Customer',
  invoice_number: 'Invoice №', invoice_date: 'Invoice date', due_date: 'Due date', currency: 'Currency',
  net_amount: 'Net', vat_amount: 'VAT', total_amount: 'Total', iban: 'IBAN', payment_reference: 'Reference',
};

export function ExtractionReviewScreen({ documentId }: { documentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['review-package', documentId],
    queryFn: () => fetch(`/api/documents/${documentId}/review-package`).then((r) => r.json() as Promise<ReviewPackage>),
  });
  if (isLoading || !data) return <p>Loading extraction…</p>;
  const pct = (c: number) => `${Math.round(c * 100)}%`;
  return (
    <section>
      <header>
        <h1>Извлечени данни · Extraction review</h1>
        <p>Document type: {data.docType} · Overall confidence: {pct(data.overallConfidence)}</p>
      </header>
      {data.flags.failedValidations.length > 0 && (
        <p role="alert">Validation failed: {data.flags.failedValidations.map((k) => LABEL[k] ?? k).join(', ')}</p>
      )}
      <table>
        <thead><tr><th>Field</th><th>Value</th><th>Confidence</th><th>Validation</th><th>Source</th></tr></thead>
        <tbody>
          {data.fields.map((f) => (
            <tr key={f.key} data-low={f.confidence < 0.85} data-invalid={f.validationStatus === 'invalid'}>
              <td>{LABEL[f.key] ?? f.key}</td>
              <td>{f.valueText ?? '—'}</td>
              <td><meter min={0} max={1} value={f.confidence} /> {pct(f.confidence)}</td>
              <td>{f.validationStatus}</td>
              <td>{f.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><small>AI-extracted suggestions — nothing is posted until a human approves (Review Queue).</small></p>
    </section>
  );
}
