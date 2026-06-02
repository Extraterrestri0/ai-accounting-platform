import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { STORAGE_SERVICE, type StorageService } from '../../docintel';
import type { GeneratedPdf, InvoicePdfGenerator } from '../application/pdf.port';
import type { Invoice } from '../domain/invoice/models';

const FONT_DIR = join(__dirname, 'fonts');
const REGULAR = readFileSync(join(FONT_DIR, 'DejaVuSans.ttf'));
const BOLD = readFileSync(join(FONT_DIR, 'DejaVuSans-Bold.ttf'));

/**
 * Production invoice PDF — renders a real, valid PDF with pdf-lib + an embedded Unicode font
 * (DejaVuSans) so Bulgarian Cyrillic renders correctly. Stored in object storage; returns checksum.
 */
@Injectable()
export class PdfLibInvoiceGenerator implements InvoicePdfGenerator {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async generate(invoice: Invoice): Promise<GeneratedPdf> {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(REGULAR, { subset: true });
    const bold = await pdf.embedFont(BOLD, { subset: true });
    let page = pdf.addPage([595.28, 841.89]); // A4
    const ink = rgb(0.06, 0.09, 0.16);
    let y = 800;
    const line = (t: string, x: number, size = 10, f = font) => page.drawText(t, { x, y, size, font: f, color: ink });

    line(`Фактура / Invoice ${invoice.invoiceNumber ?? '(draft)'}`, 40, 18, bold); y -= 26;
    line(`Дата / Date: ${invoice.issueDate ?? ''}`, 40); line(`Валута / Currency: ${invoice.currency}`, 360); y -= 16;
    line(`Получател / Customer: ${invoice.customerName ?? ''}`, 40); y -= 24;
    line('Описание / Description', 40, 10, bold); line('Кол.', 300, 10, bold); line('Ед. цена', 350, 10, bold); line('ДДС', 430, 10, bold); line('Сума', 500, 10, bold); y -= 14;
    for (const l of invoice.lines) {
      line(l.description.slice(0, 40), 40); line(String(l.quantity), 300); line(l.unitPrice, 350); line(`${l.vatRate}%`, 430); line(l.grossAmount, 500); y -= 14;
      if (y < 80) { page = pdf.addPage([595.28, 841.89]); y = 800; }
    }
    y -= 10;
    line(`Нето / Net: ${invoice.netTotal} ${invoice.currency}`, 360); y -= 14;
    line(`ДДС / VAT: ${invoice.vatTotal} ${invoice.currency}`, 360); y -= 14;
    line(`Общо / Total: ${invoice.grossTotal} ${invoice.currency}`, 360, 12, bold);

    const bytes = Buffer.from(await pdf.save());
    const storageKey = `invoices/${invoice.id}.pdf`;
    await (this.storage as unknown as { put?: (k: string, b: Buffer, ct?: string) => Promise<void> }).put?.(storageKey, bytes, 'application/pdf');
    return { storageKey, checksum: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  }
}
