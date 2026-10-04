/* eslint-disable */
// =====================================================================
// Local Tesseract OCR sidecar — DEV ONLY.
// Implements the app's OCR_VENDOR_URL contract (DefaultOcrProvider.vendorOcr /
// HttpOcrProvider): POST raw image bytes -> { "text": "...", "pageCount": 1 }.
// Point the API at it:  OCR_VENDOR_URL=http://127.0.0.1:8089/ocr  (keep OCR_PROVIDER unset
// so born-digital PDFs still use pdf.js; only images/scans hit this service).
//
// Real OCR, offline, no cloud cost — via tesseract.js (WASM), Bulgarian + English.
// NOT a production provider (use Azure Document Intelligence for prod, EU/zero-retention).
//   cd tools/local-ocr && npm install && npm start
// =====================================================================
const http = require('http');
const { createWorker } = require('tesseract.js');
const { createCanvas } = require('@napi-rs/canvas');

// Rasterize a (scanned) PDF's pages to PNG buffers using pdfjs + @napi-rs/canvas.
// Done by hand (not pdf-to-png-converter) to avoid that lib's Windows cmap-path bug.
let _pdfjs = null;
async function getPdfjs() { if (!_pdfjs) _pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); return _pdfjs; }
async function rasterizePdf(buf, scale) {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(canvas.toBuffer('image/png'));
  }
  return pages;
}

const PORT = Number(process.env.LOCAL_OCR_PORT || 8089);
const LANGS = process.env.LOCAL_OCR_LANGS || 'bul+eng';
const MAX_BYTES = 25 * 1024 * 1024;

let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    console.log(`[local-ocr] initializing tesseract worker (${LANGS}) — first run downloads language data…`);
    workerPromise = createWorker(LANGS).then((w) => { console.log('[local-ocr] worker ready'); return w; });
  }
  return workerPromise;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX_BYTES) { reject(new Error('payload too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', engine: 'tesseract.js', langs: LANGS }));
  }
  if (req.method !== 'POST') { res.writeHead(405); return res.end('method not allowed'); }

  const ctype = (req.headers['content-type'] || '').toLowerCase();
  try {
    const bytes = await readBody(req);
    const isPdf = ctype.includes('pdf') || bytes.slice(0, 5).toString('latin1') === '%PDF-';
    const t0 = Date.now();
    const worker = await getWorker();

    if (isPdf) {
      // Scanned/image-only PDF: rasterize each page to PNG, then OCR each page and join.
      // (Born-digital PDFs are read by the app's pdf.js path and never reach here.)
      const scale = Number(process.env.LOCAL_OCR_PDF_SCALE || 2.0);
      const pages = await rasterizePdf(bytes, scale);
      let text = '';
      for (const png of pages) {
        const { data } = await worker.recognize(png);
        text += (data && data.text ? data.text : '') + '\n';
      }
      console.log(`[local-ocr] pdf ${bytes.length}B, ${pages.length} page(s) @scale ${scale} -> ${text.length} chars in ${Date.now() - t0}ms`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ text, pageCount: pages.length }));
    }

    // Single image (png/jpg/bmp/...).
    const { data } = await worker.recognize(bytes);
    const text = (data && data.text) || '';
    console.log(`[local-ocr] ${ctype || 'image'} ${bytes.length}B -> ${text.length} chars in ${Date.now() - t0}ms`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text, pageCount: 1, confidence: data && data.confidence }));
  } catch (e) {
    console.error('[local-ocr] error:', e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`[local-ocr] listening on http://127.0.0.1:${PORT}/ocr  (langs ${LANGS})`));
