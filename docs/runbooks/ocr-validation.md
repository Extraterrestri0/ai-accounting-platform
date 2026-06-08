# OCR Extraction Validation Runbook

> How to prove invoice extraction works on **real inbound supplier invoices** through the **production OCR provider** (Azure Document Intelligence), not the dev fallback. This is the open public-launch item ([BETA_READINESS_REPORT.md](../BETA_READINESS_REPORT.md) #6, Exit Criteria **B1**). The scaffold here is ready to run the moment Azure credentials + real labeled invoices are provided.
>
> **Non-negotiables:** never commit real invoices or filled ground truth (private customer data); never put Azure keys in code/CI; the runner **refuses** to score against the dev fallback (a fake-OCR result is not proof). EU residency + zero-retention apply (Invariant 7).

## Pieces

| Piece | Path |
|---|---|
| Ground-truth **template** | `apps/api/scripts/ocr-validation-ground-truth.example.json` |
| Samples folder (gitignored) | `apps/api/test/fixtures/ocr-samples/` |
| Provider **readiness check** | `apps/api/scripts/ocr-provider-check.js` → `npm run ocr:check` |
| **Validation runner** | `apps/api/scripts/ocr-validation.js` → `npm run ocr:validate` |

---

## 1. Prepare invoice samples
Collect **real inbound supplier invoices** (documents the company *received*, not ones it issued). Minimum beta set:
- **≥ 10 Bulgarian** + **≥ 3 EU** supplier invoices.
- Mix **PDF (born-digital)** and **scanned images** (JPG/PNG) — scans are what exercise real OCR.
- Include **with-VAT** and **without-VAT** (non-registered supplier / 0%), and **with-IBAN** and **without-IBAN**.

Put the files under `apps/api/test/fixtures/ocr-samples/` (everything there except the README is gitignored). You may use any folder — point `baseDir`/`--base` at it.

## 2. Fill ground truth
Copy the template and fill the **real** expected values, read from each document:
```
cp apps/api/scripts/ocr-validation-ground-truth.example.json \
   apps/api/test/fixtures/ocr-samples/ocr-validation-ground-truth.json   # gitignored
```
Per document set: `id`, `file` (relative to `baseDir`), `documentType`, `country`, `isScanned`, `notes`, and `expected` for the 10 fields:
`supplier_name, supplier_eik, supplier_vat, invoice_number, invoice_date, net_amount, vat_amount, gross_amount, currency, iban`.

- Amounts as decimal strings (`"1250.00"`); dates ISO (`"2026-03-14"`); `gross_amount` = invoice total.
- **Use `null` for a field genuinely ABSENT** in the document (no IBAN, no VAT, foreign supplier with no BG EIK). The runner then counts any extracted value for it as a **false positive** — this is how we catch hallucinations.

## 3. Configure Azure credentials safely
**Never** put keys in code, the repo, or CI. Set them in the local `.env` (gitignored) or the runtime secret store (AWS Secrets Manager in prod):
```
OCR_PROVIDER=azure
AZURE_DOCINTEL_ENDPOINT=https://<resource>.cognitiveservices.azure.com
AZURE_DOCINTEL_KEY=<resource key>
AZURE_DOCINTEL_REGION=westeurope        # must be an approved EU region
# optional: AZURE_DOCINTEL_MODEL=prebuilt-invoice  AZURE_DOCINTEL_API_VERSION=2023-07-31  OCR_TIMEOUT_MS=30000
```
EU regions accepted: westeurope, northeurope, francecentral, germanywestcentral, swedencentral, switzerlandnorth, norwayeast, polandcentral, italynorth, spaincentral. The provider **fails fast** if endpoint/key/EU-region are missing — it cannot silently fall back. (`OCR_ALLOW_NON_EU=true` exists only for a deliberate, documented exception — do not use for production data.)

Verify readiness before running:
```
cd apps/api && npm run build && npm run ocr:check
```
Exit 0 + “READY” = the real Azure provider is active. Exit 1 lists exactly what’s missing.

## 4. Run validation
```
cd apps/api && npm run build
# dry-run first: validates the template + shows the report skeleton, runs NO OCR
npm run ocr:validate -- --ground-truth test/fixtures/ocr-samples/ocr-validation-ground-truth.json --dry-run
# real run (refuses unless ocr:check is green):
npm run ocr:validate -- --ground-truth test/fixtures/ocr-samples/ocr-validation-ground-truth.json
```
If the provider is the dev fallback, the real run **refuses** and exits non-zero.

## 5. Interpret results
Per field the runner reports **present / exact / partial / missing+wrong / correct-absent / false-positive** and a **present-field accuracy**; plus **per-document accuracy** and the **targets** block.

- **exact** — normalized value equals expected (amounts within 0.005).
- **partial** — substring/contained match (e.g. supplier name minus legal form) — review-correctable, not a clean pass.
- **missing** — expected present, nothing extracted.
- **wrong** — extracted a different value (the dangerous case for amounts/identity).
- **correct-absent** — expected `null` and nothing extracted (good).
- **false-positive** — expected `null` but a value was extracted (hallucination).

## 6. Thresholds — beta vs public launch
| Gate | Beta | Public launch |
|---|---|---|
| Field-level accuracy (present fields) | ≥ **95%** | ≥ 95% sustained on a larger set |
| Critical amount mismatches (net, gross) | **0** | 0 |
| VAT amount mismatches | **0** | 0 |
| Supplier identity mismatches (name/EIK/VAT) | **0** | 0 |
| Sample size | ≥ 13 (10 BG + 3 EU) | broader, recurring |

> Context: in MVP **every extraction is human-reviewed before posting** (AI proposes, never commits — Invariant 4), so extraction accuracy is **not** on the controlled-beta critical path. These targets gate **public launch** and are the trigger to trust higher-confidence fields with less review.

## 7. What failures block launch
- **Any** amount mismatch (`net`/`gross` **missing or wrong**), **any** VAT-amount mismatch, or **any** supplier-identity mismatch → **launch-blocking** (wrong money / wrong counterparty). Fix the extractor/provider and re-run.
- Field-level accuracy < 95% → launch-blocking until addressed (tune mapping/regex/heuristics — do not weaken validation).
- False-positives on `null` fields → launch-blocking (hallucination); make the relevant extractor stricter.
- A high **partial** rate on supplier name is acceptable for beta (human review catches it) but should be driven down before launch.

## 8. CI / staging (no credentials in CI)
- **Do NOT add Azure credentials to CI.** This validation needs a real provider + private invoices and is **run manually in staging**, not in the PR pipeline.
- CI may run only the **safe** parts: the template/JSON validation and the runner in **`--dry-run`** (no OCR, no creds) — to keep the scaffold honest.
- **Manual staging run:** on a staging host with the Azure secret injected from the vault and the sample set mounted to `test/fixtures/ocr-samples/`, run `npm run ocr:check && npm run ocr:validate -- --ground-truth …`. Record the accuracy table + targets verdict in the Beta Readiness Report / DR-style sign-off. Re-run whenever the extractor or the Azure model version changes.

## Reusable sibling harnesses
- `npm run …` not wired, run directly: `node scripts/validate-extraction-real.js` — scores the platform’s own born-digital PDFs (no OCR vendor needed).
- `node scripts/measure-extraction.js` — synthetic corpus regression (both pdf.js-joined and line shapes).
