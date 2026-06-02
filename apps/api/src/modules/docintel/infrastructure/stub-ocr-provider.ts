import { Injectable } from '@nestjs/common';
import type { OcrProvider, OcrResult } from '../application/ocr.port';

/**
 * DEV OCR adapter. If the object already contains UTF-8 text (e.g. a text-ish PDF/XML in dev),
 * returns it; otherwise returns a deterministic placeholder. Production swaps in an EU,
 * zero-retention OCR vendor behind this same port — no service changes.
 */
@Injectable()
export class StubOcrProvider implements OcrProvider {
  async recognize(bytes: Buffer, _mimeType: string): Promise<OcrResult> {
    const text = bytes.toString('utf8');
    return { text, pageCount: 1, engine: 'stub-ocr@dev' };
  }
}
