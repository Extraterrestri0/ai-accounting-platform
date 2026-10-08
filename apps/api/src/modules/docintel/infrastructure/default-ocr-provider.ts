import { Injectable, Logger } from '@nestjs/common';
import type { OcrProvider, OcrResult } from '../application/ocr.port';
import { OcrUnavailableError } from '../domain/errors';

/**
 * Production OCR provider.
 *  - Born-digital PDFs (embedded text) → extracted directly with pdfjs-dist (offline, exact).
 *    If the embedded text is POOR/EMPTY (scanned or image-only PDF) the file falls through
 *    to the OCR vendor — extraction never stops at a bad text layer.
 *  - Scanned images / image-only PDFs → delegated to a configured OCR vendor over HTTP(S)
 *    (OCR_VENDOR_URL); the bytes never persist with us (Invariant 7).
 *  - NO silent fake results: without a vendor, image content raises OcrUnavailableError so the
 *    user sees a clear "OCR not configured" message. The deterministic dev sample only runs
 *    when OCR_DEV_SAMPLE=true (tests/demo) and is flagged as such in diagnostics.
 */
interface PdfTextItem { str?: string }
interface PdfPage { getTextContent(): Promise<{ items: PdfTextItem[] }> }
interface PdfDoc { numPages: number; getPage(n: number): Promise<PdfPage> }

/**
 * Deterministic sample Bulgarian invoice (dev OCR only) — mirrors the reference sample invoice
 * so image/placeholder files yield a complete, balanced extraction (net 2760 + VAT 552 = 3312)
 * when no OCR vendor is configured. Never used when OCR_VENDOR_URL is set (real OCR then).
 */
const SAMPLE_INVOICE_TEXT = [
  'ФАКТУРА',
  'Номер: 0000000051',
  'Дата: 26/02/2017',
  'Валута: BGN',
  '',
  'Доставчик: Демо Архив поинт',
  'Град: София',
  'ЕИК: 040207268',
  'ДДС №: BG040207268',
  '',
  'Получател: Фирма 3',
  'ЕИК на получателя: 3333333333',
  'ДДС № на получателя: BG3333333333',
  '',
  'Артикул 1  4.00 x 650.00 = 2340.00',
  'Артикул 4  1.00 x 120.00 = 120.00',
  'Артикул 5  1.25 x 300.00 = 300.00',
  '',
  'Данъчна основа: 2760.00',
  'ДДС 20%: 552.00',
  'Общо за плащане: 3312.00',
  '',
  'Начин на плащане: Банков превод',
  'Банка: ТБ ИзвънЗемБанк',
  'BIC: IZVBBGSF',
  'IBAN: BG77IZVB00001122334455',
].join('\n');

@Injectable()
export class DefaultOcrProvider implements OcrProvider {
  private readonly log = new Logger('OCR');

  async recognize(bytes: Buffer, mimeType: string): Promise<OcrResult> {
    if (mimeType === 'application/pdf') {
      const text = await this.extractPdfText(bytes);
      // A meaningful text layer is used directly. A POOR one (a few stray chars on a scan)
      // is not trusted — fall through to OCR rather than stopping with garbage.
      const minChars = Number(process.env.OCR_PDF_TEXT_MIN ?? 40);
      if (text.trim().length >= minChars) return { text, pageCount: this.countPages(bytes), engine: 'pdf-text@embedded', provider: 'pdfjs', model: 'pdfjs' };
      if (text.trim().length > 0) this.log.warn(`PDF text layer too poor (${text.trim().length} chars < ${minChars}) — falling back to OCR.`);
    }
    return this.vendorOcr(bytes, mimeType);
  }

  private parsed: { text: string; pages: number } | null = null;
  private async extractPdfText(bytes: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs') as { getDocument(args: { data: Uint8Array; useSystemFonts?: boolean }): { promise: Promise<PdfDoc> } };
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
      let text = '';
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        text += content.items.map((i) => ('str' in i ? i.str : '')).join(' ') + '\n';
      }
      this.parsed = { text, pages: doc.numPages };
      return text;
    } catch { this.parsed = null; return ''; }
  }
  private countPages(_bytes: Buffer): number { return this.parsed?.pages ?? 1; }

  private async vendorOcr(bytes: Buffer, mimeType: string): Promise<OcrResult> {
    const url = process.env.OCR_VENDOR_URL;
    if (!url) {
      // No OCR vendor configured. Plain-text content is still genuinely readable (real data),
      // but IMAGE content cannot be read — and inventing the dev sample would present fake
      // data as a customer's invoice. Default: refuse with a clear, user-facing error.
      const decoded = bytes.toString('utf8');
      const printable = decoded.replace(/[^\x20-\x7EЀ-ӿ\n\r\t]/g, '');
      const looksLikeText = printable.length > 30 && printable.length / Math.max(decoded.length, 1) > 0.6;
      if (looksLikeText) return { text: decoded, pageCount: 1, engine: 'dev-ocr@text', provider: 'dev', model: 'text' };
      if (process.env.OCR_DEV_SAMPLE === 'true') {
        // Explicit opt-in for tests/demo only — flagged via engine so diagnostics mark it
        // devFallbackUsed and the UI labels it as NOT a real extraction.
        this.log.warn('OCR_VENDOR_URL not set — OCR_DEV_SAMPLE=true, returning the deterministic dev sample (NOT real data).');
        return { text: SAMPLE_INVOICE_TEXT, pageCount: 1, engine: 'dev-ocr@sample', provider: 'dev', model: 'sample' };
      }
      this.log.warn('OCR_VENDOR_URL not set and content requires OCR — refusing (no fake results).');
      throw new OcrUnavailableError();
    }
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': mimeType, Authorization: `Bearer ${process.env.OCR_VENDOR_KEY ?? ''}` }, body: new Uint8Array(bytes) });
    if (!res.ok) throw new Error(`OCR vendor error ${res.status}`);
    const data = (await res.json()) as { text?: string; pageCount?: number };
    return { text: data.text ?? '', pageCount: data.pageCount ?? 1, engine: 'vendor-ocr', provider: 'http', model: 'vendor' };
  }
}
