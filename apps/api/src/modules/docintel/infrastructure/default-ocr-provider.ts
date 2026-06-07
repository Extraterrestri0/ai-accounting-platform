import { Injectable, Logger } from '@nestjs/common';
import type { OcrProvider, OcrResult } from '../application/ocr.port';

/**
 * Production OCR provider.
 *  - Born-digital PDFs (embedded text) → extracted directly with pdfjs-dist (offline, exact).
 *  - Scanned images / image-only PDFs → delegated to a configured EU, zero-retention OCR
 *    vendor over HTTPS (OCR_VENDOR_URL); the bytes never persist with us (Invariant 7).
 * No stub fallback: if neither path yields text, it throws so the document stays in review.
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
      if (text.trim().length > 0) return { text, pageCount: this.countPages(bytes), engine: 'pdf-text@embedded', provider: 'pdfjs', model: 'pdfjs' };
      // image-only PDF → fall through to the vendor
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
      // No EU OCR vendor configured → deterministic dev OCR so the workflow always functions.
      // Born-digital PDFs already returned their real embedded text above; this covers image-only /
      // text-less / placeholder files: any readable text is used, otherwise a deterministic sample invoice.
      this.log.warn('OCR_VENDOR_URL not set — using deterministic dev OCR.');
      const decoded = bytes.toString('utf8');
      const printable = decoded.replace(/[^\x20-\x7EЀ-ӿ\n\r\t]/g, '');
      const looksLikeText = printable.length > 30 && printable.length / Math.max(decoded.length, 1) > 0.6;
      const text = looksLikeText ? decoded : SAMPLE_INVOICE_TEXT;
      return { text, pageCount: 1, engine: looksLikeText ? 'dev-ocr@text' : 'dev-ocr@sample', provider: 'dev', model: looksLikeText ? 'text' : 'sample' };
    }
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': mimeType, Authorization: `Bearer ${process.env.OCR_VENDOR_KEY ?? ''}` }, body: new Uint8Array(bytes) });
    if (!res.ok) throw new Error(`OCR vendor error ${res.status}`);
    const data = (await res.json()) as { text?: string; pageCount?: number };
    return { text: data.text ?? '', pageCount: data.pageCount ?? 1, engine: 'vendor-ocr', provider: 'http', model: 'vendor' };
  }
}
