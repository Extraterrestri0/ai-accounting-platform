#!/usr/bin/env node
/* eslint-disable */
// =====================================================================
// REAL-document extraction validation (not the synthetic corpus).
// Runs the ACTUAL production-local pipeline (DefaultOcrProvider → assemble) over the
// real invoice files in the object store, and scores extracted vs expected for the 10
// required fields. Ground truth comes from the issued-invoice records in the DB (the
// records that generated these PDFs) — authoritative, not hand-made.
//
// Build the API first (npm run build), then: node scripts/validate-extraction-real.js
// =====================================================================
const fs = require('fs');
const path = require('path');
const DIST = path.resolve(__dirname, '../dist/modules/docintel');
const { DefaultOcrProvider } = require(path.join(DIST, 'infrastructure/default-ocr-provider.js'));
const { assemble } = require(path.join(DIST, 'domain/extraction/pipeline.js'));

const INV_DIR = 'C:/Users/Cody/pgdev/doc-storage/invoices';

// Ground truth per real PDF (from the `invoices` table that generated each file).
// ABSENT = the field is genuinely NOT in the document's source text → correct behavior is
// to NOT extract it (extracting a value would be a hallucination / false positive).
// date is ABSENT_IN_TEXT: the record has issue_date, but the PDF's text layer omits it.
const A = 'ABSENT', D = 'ABSENT_IN_TEXT';
const GT = {
  '0acd069c-2750-48fb-8fbf-a464011a22bb.pdf': { invoice_number: 'КИ-2026-0001', net_amount: '1000.00', vat_amount: '200.00', total_amount: '1200.00', currency: 'EUR', supplier_name: A, supplier_eik: A, supplier_vat: A, invoice_date: D, iban: A },
  '296eb71a-bf5f-4b0b-bfc1-ebe9ec1f6d0c.pdf': { invoice_number: 'ДИ-2026-0001', net_amount: '1000.00', vat_amount: '0.00', total_amount: '1000.00', currency: 'EUR', supplier_name: A, supplier_eik: A, supplier_vat: A, invoice_date: D, iban: A },
  '3ab93083-f150-4d80-ab32-42a6a06b3307.pdf': { invoice_number: 'ПФ-2026-0001', net_amount: '500.00', vat_amount: '100.00', total_amount: '600.00', currency: 'EUR', supplier_name: A, supplier_eik: A, supplier_vat: A, invoice_date: D, iban: A },
  '3f6b033f-dc62-485c-a365-7c84f500d735.pdf': { invoice_number: 'КИ-2026-0001', net_amount: '1000.00', vat_amount: '0.00', total_amount: '1000.00', currency: 'EUR', supplier_name: A, supplier_eik: A, supplier_vat: A, invoice_date: D, iban: A },
  '43701195-e7f8-45d6-a596-5f83b5137b73.pdf': { invoice_number: 'ДИ-2026-0001', net_amount: '1000.00', vat_amount: '200.00', total_amount: '1200.00', currency: 'EUR', supplier_name: A, supplier_eik: A, supplier_vat: A, invoice_date: D, iban: A },
  '59882ef3-8a19-4ba0-8376-b8ee2328837b.pdf': { invoice_number: '2026-0002', net_amount: '1000.00', vat_amount: '200.00', total_amount: '1200.00', currency: 'EUR', supplier_name: A, supplier_eik: A, supplier_vat: A, invoice_date: D, iban: A },
  '60e250e1-3de6-4af1-a591-cb33dc1d1a88.pdf': { invoice_number: '2026-0001', net_amount: '500.00', vat_amount: '100.00', total_amount: '600.00', currency: 'EUR', supplier_name: A, supplier_eik: A, supplier_vat: A, invoice_date: D, iban: A },
  'c5cd5b6f-f21a-4bec-8ad4-3db2c30f9efd.pdf': { invoice_number: '2026-0001', net_amount: '1000.00', vat_amount: '0.00', total_amount: '1000.00', currency: 'EUR', supplier_name: A, supplier_eik: A, supplier_vat: A, invoice_date: D, iban: A },
};

// Map the 10 requested report fields → internal field keys.
const FIELDS = [
  ['supplier name', 'supplier_name'], ['supplier EIK', 'supplier_eik'], ['supplier VAT', 'supplier_vat'],
  ['invoice number', 'invoice_number'], ['document date', 'invoice_date'],
  ['net amount', 'net_amount'], ['VAT amount', 'vat_amount'], ['gross amount', 'total_amount'],
  ['currency', 'currency'], ['IBAN', 'iban'],
];
const numKeys = new Set(['net_amount', 'vat_amount', 'total_amount']);

function classify(key, expected, got) {
  const absent = expected === A || expected === D;
  if (absent) return got == null ? 'correct-absent' : 'false-positive';
  if (got == null) return 'missing';
  if (numKeys.has(key)) return Math.abs(parseFloat(got) - parseFloat(expected)) < 0.005 ? 'exact' : 'wrong';
  const g = String(got).replace(/\s+/g, '').toUpperCase(), e = String(expected).replace(/\s+/g, '').toUpperCase();
  if (g === e) return 'exact';
  if (g.includes(e) || e.includes(g)) return 'partial';
  return 'wrong';
}

(async () => {
  const provider = new DefaultOcrProvider();
  const files = fs.readdirSync(INV_DIR).filter((f) => f.endsWith('.pdf') && GT[f]);
  const tally = {}; FIELDS.forEach(([, k]) => (tally[k] = { exact: 0, partial: 0, missing: 0, wrong: 0, 'correct-absent': 0, 'false-positive': 0, present: 0, absent: 0 }));
  const failures = [];

  for (const f of files) {
    const bytes = fs.readFileSync(path.join(INV_DIR, f));
    const ocr = await provider.recognize(bytes, 'application/pdf');
    const primary = ocr.fields && ocr.fields.length ? [] : [];
    const { fields } = assemble({ text: ocr.text, engine: ocr.engine, method: 'ocr', provider: ocr.provider, model: ocr.model });
    const byKey = {}; for (const x of fields) byKey[x.key] = x.valueText;
    const gt = GT[f];
    for (const [, key] of FIELDS) {
      const c = classify(key, gt[key], byKey[key]);
      tally[key][c]++;
      const absent = gt[key] === A || gt[key] === D;
      tally[key][absent ? 'absent' : 'present']++;
      if (c === 'missing' || c === 'wrong' || c === 'false-positive') failures.push(`${f.slice(0, 8)}  ${key}: expected ${JSON.stringify(gt[key])} got ${JSON.stringify(byKey[key] ?? null)} [${c}]`);
    }
  }

  console.log(`\n=== REAL-document extraction validation ===`);
  console.log(`sample size: ${files.length} real born-digital PDF invoices (issued by the platform; ground truth = invoices table)\n`);
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('field', 16) + pad('present', 9) + pad('exact', 7) + pad('partial', 9) + pad('missing', 9) + pad('absent✓', 9) + pad('false+', 8) + 'present-acc');
  let totPresent = 0, totExact = 0, totPartial = 0, totAbsent = 0, totCorrectAbsent = 0, totFalsePos = 0;
  for (const [label, key] of FIELDS) {
    const t = tally[key];
    const presentAcc = t.present ? ((100 * (t.exact + t.partial)) / t.present).toFixed(0) + '%' : '   —';
    console.log(pad(label, 16) + pad(t.present, 9) + pad(t.exact, 7) + pad(t.partial, 9) + pad(t.missing + t.wrong, 9) + pad(t['correct-absent'], 9) + pad(t['false-positive'], 8) + presentAcc);
    totPresent += t.present; totExact += t.exact; totPartial += t.partial; totAbsent += t.absent; totCorrectAbsent += t['correct-absent']; totFalsePos += t['false-positive'];
  }
  console.log('');
  console.log(`present fields:        ${totPresent}  → exact ${totExact} (${((100 * totExact) / totPresent).toFixed(1)}%), partial ${totPartial}, missing/wrong ${totPresent - totExact - totPartial}`);
  console.log(`absent fields:         ${totAbsent}  → correctly-absent ${totCorrectAbsent} (${((100 * totCorrectAbsent) / totAbsent).toFixed(1)}%), false-positives ${totFalsePos}`);
  const overallDen = totPresent + totAbsent, overallCorrect = totExact + totPartial + totCorrectAbsent;
  console.log(`overall (10 fields × ${files.length} docs = ${overallDen}): ${overallCorrect} correct = ${((100 * overallCorrect) / overallDen).toFixed(1)}%`);

  console.log(`\n--- top remaining failures ---`);
  if (!failures.length) console.log('  (none)');
  else failures.slice(0, 20).forEach((x) => console.log('  ' + x));
  console.log('');
})();
