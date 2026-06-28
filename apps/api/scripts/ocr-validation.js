#!/usr/bin/env node
/* eslint-disable */
// =====================================================================
// Production-OCR extraction validation runner (STEP 3).
// Reads a labeled ground-truth file, runs the CONFIGURED OCR provider (real Azure
// Document Intelligence) over each invoice, and scores extracted vs expected for the
// 10 required fields. REFUSES to run against the dev fallback — a result without the
// real provider would be meaningless. It does NOT fabricate or fall back.
//
//   npm run ocr:validate -- --ground-truth scripts/ocr-validation-ground-truth.json
//   npm run ocr:validate -- --dry-run          # validate template + show report skeleton, no OCR
//
// Exit 0 = ran and all targets met (or dry-run ok); 1 = refused / targets failed / bad template.
// =====================================================================
const fs = require('fs');
const path = require('path');
const { checkProviderReadiness } = require('./ocr-provider-check');

const DIST = path.resolve(__dirname, '../dist/modules/docintel');

// [report label, ground-truth key, internal field key]
const FIELDS = [
  ['supplier name', 'supplier_name', 'supplier_name'],
  ['supplier EIK', 'supplier_eik', 'supplier_eik'],
  ['supplier VAT', 'supplier_vat', 'supplier_vat'],
  ['invoice number', 'invoice_number', 'invoice_number'],
  ['invoice date', 'invoice_date', 'invoice_date'],
  ['net amount', 'net_amount', 'net_amount'],
  ['VAT amount', 'vat_amount', 'vat_amount'],
  ['gross amount', 'gross_amount', 'total_amount'],
  ['currency', 'currency', 'currency'],
  ['IBAN', 'iban', 'iban'],
];
const GT_KEYS = new Set(FIELDS.map((f) => f[1]));
const NUM_KEYS = new Set(['net_amount', 'vat_amount', 'gross_amount']);
const SUPPLIER_KEYS = new Set(['supplier_name', 'supplier_eik', 'supplier_vat']);
const CRITICAL_AMOUNTS = new Set(['net_amount', 'gross_amount']);

function parseArgs(argv) {
  const a = { groundTruth: null, dryRun: false, base: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true;
    else if (argv[i] === '--ground-truth') a.groundTruth = argv[++i];
    else if (argv[i] === '--base') a.base = argv[++i];
  }
  return a;
}

function mimeOf(file) {
  const e = file.toLowerCase().split('.').pop();
  return e === 'pdf' ? 'application/pdf'
    : e === 'png' ? 'image/png'
    : e === 'jpg' || e === 'jpeg' ? 'image/jpeg'
    : e === 'xml' ? 'application/xml'
    : 'application/octet-stream';
}

// ---- template validation (runs in every mode) ----
function validateTemplate(gt, gtPath, baseOverride) {
  const errors = [];
  if (!gt || typeof gt !== 'object') errors.push('root is not an object');
  if (!Array.isArray(gt.documents) || gt.documents.length === 0) errors.push('"documents" must be a non-empty array');
  const baseDir = baseOverride
    ? path.resolve(baseOverride)
    : path.resolve(path.dirname(gtPath), gt.baseDir ?? '.');
  const docs = [];
  (gt.documents ?? []).forEach((d, i) => {
    const where = `documents[${i}]${d && d.id ? ` (${d.id})` : ''}`;
    if (!d.id) errors.push(`${where}: missing "id"`);
    if (!d.file) errors.push(`${where}: missing "file"`);
    if (!d.expected || typeof d.expected !== 'object') errors.push(`${where}: missing "expected" object`);
    else for (const k of Object.keys(d.expected)) if (!GT_KEYS.has(k)) errors.push(`${where}: unknown expected field "${k}"`);
    const filePath = d.file ? path.resolve(baseDir, d.file) : null;
    docs.push({ ...d, filePath, fileExists: filePath ? fs.existsSync(filePath) : false });
  });
  return { errors, baseDir, docs };
}

// ---- comparison ----
function classify(internalKey, expected, got) {
  const absent = expected === null || expected === undefined;
  if (absent) return got == null || got === '' ? 'correct-absent' : 'false-positive';
  if (got == null || got === '') return 'missing';
  if (NUM_KEYS.has(internalKey === 'total_amount' ? 'gross_amount' : internalKey) || internalKey === 'total_amount')
    return Math.abs(parseFloat(String(got)) - parseFloat(String(expected))) < 0.005 ? 'exact' : 'wrong';
  const g = String(got).replace(/\s+/g, '').toUpperCase();
  const e = String(expected).replace(/\s+/g, '').toUpperCase();
  if (g === e) return 'exact';
  if (g.includes(e) || e.includes(g)) return 'partial';
  return 'wrong';
}

function pct(n, d) { return d === 0 ? '   —' : ((100 * n) / d).toFixed(1).padStart(5) + '%'; }
function pad(s, n) { return String(s).padEnd(n); }

function reportSkeleton() {
  console.log('\n  report columns: present | exact | partial | missing/wrong | correct-absent | false+ | present-accuracy');
  console.log('  targets: field-level ≥95% · 0 critical amount mismatches (net/gross) · 0 VAT mismatches · 0 supplier-identity mismatches\n');
  console.log('  ' + pad('field', 16) + pad('present', 9) + pad('exact', 7) + pad('partial', 9) + pad('miss/wrong', 12) + pad('absent✓', 9) + 'false+');
  for (const [label] of FIELDS) console.log('  ' + pad(label, 16) + pad('—', 9) + pad('—', 7) + pad('—', 9) + pad('—', 12) + pad('—', 9) + '—');
}

async function runReal(docs) {
  const { createOcrProvider } = require(path.join(DIST, 'infrastructure/ocr-provider.factory.js'));
  const { fromVendorFields } = require(path.join(DIST, 'domain/extraction/merge.js'));
  const { assemble } = require(path.join(DIST, 'domain/extraction/pipeline.js'));
  const provider = createOcrProvider(process.env);

  const tally = {}; FIELDS.forEach(([, , k]) => (tally[k] = { present: 0, exact: 0, partial: 0, missing: 0, wrong: 0, correctAbsent: 0, falsePos: 0 }));
  const perDoc = []; const failures = [];
  let critAmount = 0, critVat = 0, critSupplier = 0;

  for (const d of docs) {
    if (!d.fileExists) { failures.push(`${d.id}: file not found (${d.filePath})`); perDoc.push({ id: d.id, acc: 0, note: 'file missing' }); continue; }
    const bytes = fs.readFileSync(d.filePath);
    const ocr = await provider.recognize(bytes, mimeOf(d.file));
    const primary = ocr.fields && ocr.fields.length ? fromVendorFields(ocr.fields) : [];
    const { fields } = assemble({ primary, text: ocr.text, engine: ocr.engine, method: primary.length ? 'hybrid' : 'ocr', provider: ocr.provider, model: ocr.model });
    const byKey = {}; for (const f of fields) byKey[f.key] = f.valueText;

    let correct = 0;
    for (const [label, gtKey, key] of FIELDS) {
      const expected = Object.prototype.hasOwnProperty.call(d.expected, gtKey) ? d.expected[gtKey] : null;
      const got = byKey[key] ?? null;
      const c = classify(key, expected, got);
      const t = tally[key];
      const present = !(expected === null || expected === undefined);
      if (present) t.present++;
      if (c === 'exact') t.exact++; else if (c === 'partial') t.partial++; else if (c === 'missing') t.missing++;
      else if (c === 'wrong') t.wrong++; else if (c === 'correct-absent') t.correctAbsent++; else if (c === 'false-positive') t.falsePos++;
      if (c === 'exact' || c === 'partial' || c === 'correct-absent') correct++;
      const bad = c === 'missing' || c === 'wrong' || c === 'false-positive';
      if (bad) {
        failures.push(`${pad(d.id, 20)} ${pad(label, 14)} expected ${JSON.stringify(expected)} got ${JSON.stringify(got)} [${c}]`);
        if (CRITICAL_AMOUNTS.has(gtKey) && (c === 'missing' || c === 'wrong')) critAmount++;
        if (gtKey === 'vat_amount' && (c === 'missing' || c === 'wrong')) critVat++;
        if (SUPPLIER_KEYS.has(gtKey)) critSupplier++;
      }
    }
    perDoc.push({ id: d.id, acc: (100 * correct) / FIELDS.length });
  }

  // ---- print ----
  console.log('\n=== Production-OCR extraction validation ===');
  console.log(`provider: ${provider.constructor.name} (engine reported per doc) · sample size: ${docs.length} documents\n`);
  console.log('  ' + pad('field', 16) + pad('present', 9) + pad('exact', 7) + pad('partial', 9) + pad('miss/wrong', 12) + pad('absent✓', 9) + pad('false+', 8) + 'present-acc');
  let P = 0, E = 0, PA = 0, AB = 0, CA = 0, FP = 0;
  for (const [label, , key] of FIELDS) {
    const t = tally[key];
    const absent = t.correctAbsent + t.falsePos;
    console.log('  ' + pad(label, 16) + pad(t.present, 9) + pad(t.exact, 7) + pad(t.partial, 9) + pad(t.missing + t.wrong, 12) + pad(t.correctAbsent, 9) + pad(t.falsePos, 8) + pct(t.exact + t.partial, t.present));
    P += t.present; E += t.exact; PA += t.partial; AB += absent; CA += t.correctAbsent; FP += t.falsePos;
  }
  const fieldLevel = (100 * (E + PA)) / Math.max(P, 1);
  console.log('');
  console.log(`field-level accuracy (present fields): ${fieldLevel.toFixed(1)}%  (exact ${E}, partial ${PA}, missing/wrong ${P - E - PA} of ${P})`);
  console.log(`absent fields: ${CA}/${AB} correctly absent, ${FP} false-positive(s)`);
  console.log('\n  per-document accuracy:');
  for (const d of perDoc) console.log(`    ${pad(d.id, 22)} ${d.acc.toFixed(1)}%${d.note ? '  (' + d.note + ')' : ''}`);

  console.log('\n  --- targets ---');
  const t1 = fieldLevel >= 95; const t2 = critAmount === 0; const t3 = critVat === 0; const t4 = critSupplier === 0;
  console.log(`    ${t1 ? '✓' : '✗'} field-level ≥95%            (${fieldLevel.toFixed(1)}%)`);
  console.log(`    ${t2 ? '✓' : '✗'} 0 critical amount mismatch  (${critAmount})`);
  console.log(`    ${t3 ? '✓' : '✗'} 0 VAT amount mismatch       (${critVat})`);
  console.log(`    ${t4 ? '✓' : '✗'} 0 supplier identity mismatch(${critSupplier})`);

  if (failures.length) { console.log('\n  --- failures ---'); failures.slice(0, 40).forEach((f) => console.log('  ' + f)); }
  const passed = t1 && t2 && t3 && t4;
  console.log(`\n${passed ? '✅ EXTRACTION MEETS BETA TARGETS' : '❌ EXTRACTION DOES NOT MEET TARGETS'}\n`);
  return passed;
}

(async () => {
  const args = parseArgs(process.argv);
  const gtPath = path.resolve(args.groundTruth ?? path.join(__dirname, 'ocr-validation-ground-truth.example.json'));
  if (!fs.existsSync(gtPath)) { console.error(`Ground-truth file not found: ${gtPath}`); process.exit(1); }
  let gt;
  try { gt = JSON.parse(fs.readFileSync(gtPath, 'utf8')); }
  catch (e) { console.error(`Ground-truth file is not valid JSON: ${e.message}`); process.exit(1); }

  const { errors, baseDir, docs } = validateTemplate(gt, gtPath, args.base);
  console.log(`ground truth: ${gtPath}`);
  console.log(`samples base: ${baseDir}`);
  if (errors.length) { console.error('\n❌ template invalid:'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
  console.log(`✓ template valid — ${docs.length} document(s); files present: ${docs.filter((d) => d.fileExists).length}/${docs.length}`);

  const readiness = checkProviderReadiness(process.env);

  if (args.dryRun) {
    console.log('\n--- DRY RUN (no OCR executed) ---');
    console.log(`provider readiness: ${readiness.ready ? 'READY (real Azure)' : 'NOT READY — ' + (readiness.devFallback ? 'dev fallback active' : 'provider not configured')}`);
    if (!readiness.ready) console.log('  → a real run would REFUSE (dev fallback is not accepted as proof).');
    console.log('\n  documents:');
    for (const d of docs) console.log(`    ${pad(d.id, 22)} ${pad(d.country ?? '-', 4)} ${d.isScanned ? 'scan' : 'pdf '} file:${d.fileExists ? 'present' : 'MISSING'}  ${d.file}`);
    reportSkeleton();
    console.log('✓ DRY RUN OK — template parses, file resolution works, report format above. Provide Azure creds + samples to run for real.\n');
    process.exit(0);
  }

  if (!readiness.ready) {
    console.error('\n❌ REFUSING TO RUN — the production OCR provider is not active.');
    for (const c of readiness.checks.filter((c) => !c.ok)) console.error(`  ✗ ${c.name} (${c.detail})`);
    console.error('\nA validation result against the dev fallback is not proof. Configure Azure Document Intelligence');
    console.error('(see docs/runbooks/ocr-validation.md) and retry. Use --dry-run to validate the template meanwhile.\n');
    process.exit(1);
  }

  const passed = await runReal(docs);
  process.exit(passed ? 0 : 1);
})();
