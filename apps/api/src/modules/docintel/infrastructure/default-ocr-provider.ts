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

@Injectable()
export class DefaultOcrProvider implements OcrProvider {
  private readonly log = new Logger('OCR');

  async recognize(bytes: Buffer, mimeType: string): Promise<OcrResult> {
    if (mimeType === 'application/pdf') {
      const text = await this.extractPdfText(bytes);
      if (text.trim().length > 0) return { text, pageCount: this.countPages(bytes), engine: 'pdf-text@embedded' };
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
    if (!url) throw new Error('Image OCR requires OCR_VENDOR_URL (EU zero-retention vendor) — not configured.');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': mimeType, Authorization: `Bearer ${process.env.OCR_VENDOR_KEY ?? ''}` }, body: new Uint8Array(bytes) });
    if (!res.ok) throw new Error(`OCR vendor error ${res.status}`);
    const data = (await res.json()) as { text?: string; pageCount?: number };
    return { text: data.text ?? '', pageCount: data.pageCount ?? 1, engine: 'vendor-ocr' };
  }
}
