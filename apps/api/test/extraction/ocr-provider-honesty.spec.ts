/**
 * Upload extraction reliability — OCR provider honesty (no fake results) + layered fallback.
 *  - image content WITHOUT a configured OCR vendor → OcrUnavailableError (clear user-facing
 *    message), NOT the silent dev sample;
 *  - dev sample only with explicit OCR_DEV_SAMPLE=true, and flagged via engine=dev-ocr@sample;
 *  - a PDF with a poor/empty text layer falls through to the vendor (never stops at bad text).
 */
import { DefaultOcrProvider } from '../../src/modules/docintel/infrastructure/default-ocr-provider';
import { OcrUnavailableError } from '../../src/modules/docintel/domain/errors';

// tiny valid PNG header + junk = "image content" that can never look like text
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0x07),
]);

const ENV_KEYS = ['OCR_VENDOR_URL', 'OCR_VENDOR_KEY', 'OCR_DEV_SAMPLE'] as const;
let saved: Record<string, string | undefined>;
let savedFetch: unknown;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  savedFetch = (global as { fetch?: unknown }).fetch;
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  (global as { fetch?: unknown }).fetch = savedFetch;
  jest.restoreAllMocks();
});

describe('image without OCR vendor', () => {
  it('throws OcrUnavailableError with a clear user-facing message (no silent dev sample)', async () => {
    const p = new DefaultOcrProvider();
    await expect(p.recognize(PNG_BYTES, 'image/png')).rejects.toThrow(OcrUnavailableError);
    await expect(p.recognize(PNG_BYTES, 'image/png')).rejects.toThrow(/OCR provider is not configured/);
  });
  it('returns the dev sample ONLY with OCR_DEV_SAMPLE=true, flagged as dev-ocr@sample', async () => {
    process.env.OCR_DEV_SAMPLE = 'true';
    const r = await new DefaultOcrProvider().recognize(PNG_BYTES, 'image/png');
    expect(r.engine).toBe('dev-ocr@sample'); // diagnostics mark devFallbackUsed from this
    expect(r.provider).toBe('dev');
  });
});

describe('PDF with poor/empty text layer', () => {
  it('falls through to the OCR vendor instead of stopping at bad text', async () => {
    process.env.OCR_VENDOR_URL = 'http://127.0.0.1:9/ocr'; // never reached: fetch is mocked
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'ФАКТУРА № 123 Общо: 10,00', pageCount: 1 }),
    });
    (global as { fetch: unknown }).fetch = fetchMock;
    // not a real PDF → pdfjs yields no text → must fall through to the vendor
    const r = await new DefaultOcrProvider().recognize(Buffer.from('%PDF-not-really'), 'application/pdf');
    expect(fetchMock).toHaveBeenCalled();
    expect(r.engine).toBe('vendor-ocr');
    expect(r.text).toContain('ФАКТУРА');
  });
});
