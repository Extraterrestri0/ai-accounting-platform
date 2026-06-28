import { Injectable, Logger } from '@nestjs/common';
import type { OcrField, OcrProvider, OcrResult } from '../application/ocr.port';
import { FIELD_KEYS, type FieldKey } from '../domain/extraction/models';

/**
 * Generic EU, zero-retention OCR / Document-AI vendor over HTTPS (vendor-agnostic).
 * POSTs the raw bytes; accepts either a text-only response or a structured one.
 *
 * Expected JSON response (any subset):
 *   { "text": "...", "pageCount": 1,
 *     "fields": [ { "key": "invoice_number", "value": "...", "confidence": 0.97 }, ... ] }
 *
 * Config: OCR_VENDOR_URL (required), OCR_VENDOR_KEY (bearer, optional), OCR_TIMEOUT_MS.
 */
@Injectable()
export class HttpOcrProvider implements OcrProvider {
  private readonly log = new Logger('OCR.Http');
  private readonly url: string;
  private readonly key: string;
  private readonly timeoutMs: number;

  constructor() {
    this.url = process.env.OCR_VENDOR_URL ?? '';
    this.key = process.env.OCR_VENDOR_KEY ?? '';
    this.timeoutMs = Number(process.env.OCR_TIMEOUT_MS ?? 30000);
    if (!this.url) throw new Error('HTTP OCR provider selected but OCR_VENDOR_URL is not set.');
  }

  async recognize(bytes: Buffer, mimeType: string): Promise<OcrResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': mimeType || 'application/octet-stream', Authorization: `Bearer ${this.key}` },
        body: new Uint8Array(bytes),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`OCR vendor error ${res.status}`);
      const data = (await res.json()) as { text?: string; pageCount?: number; fields?: Array<{ key?: string; value?: string; confidence?: number }> };
      const fields = this.normalizeFields(data.fields);
      this.log.log(`HTTP OCR ok — ${fields.length} structured field(s).`);
      return {
        text: data.text ?? '',
        pageCount: data.pageCount ?? 1,
        engine: 'vendor-ocr',
        provider: 'http',
        model: 'vendor',
        fields: fields.length ? fields : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Keep only well-formed fields whose key is in the canonical whitelist. */
  private normalizeFields(raw?: Array<{ key?: string; value?: string; confidence?: number }>): OcrField[] {
    if (!raw?.length) return [];
    const allowed = new Set<string>(FIELD_KEYS as readonly string[]);
    const out: OcrField[] = [];
    for (const f of raw) {
      if (f.key && allowed.has(f.key) && f.value != null && String(f.value).trim() !== '') {
        out.push({ key: f.key as FieldKey, value: String(f.value).trim(), confidence: Math.max(0, Math.min(1, Number(f.confidence ?? 0.6))) });
      }
    }
    return out;
  }
}
