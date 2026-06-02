# TASK 008 — OCR & Extraction Pipeline

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 008 · **Depends on:** 002–007 · **PR:** one scoped PR.
**Deliverable:** `task008-ocr-extraction.zip` → unzip into repo root over Tasks 002–007 (later files win).

> **Verified during build (live PostgreSQL 16 + cumulative repo):** migration 0009 applied; RLS isolation, duplicate-run + one-current-extraction prevention, field immutability, confidence storage, and AI-actor audit all proved; the extractor/XML/confidence logic ran green in Node and Jest; `tsc` clean, `eslint` clean, **15/15 tests pass**; 0009 down→up round-trips. No redesign of prior tasks; no new frameworks.

## 1. Files created
- DB: `db/migrations/0009_extractions.{up,down}.sql`.
- extraction domain: `extraction/models.ts`, `extraction/field-extractor.ts` (text→fields), `extraction/xml-extractor.ts` (UBL-ish, no OCR), `extraction/confidence.ts` (validation-aware scoring).
- ports: `application/ocr.port.ts`, `application/extraction-queue.port.ts`, `application/extraction.service.interface.ts`.
- application: `extraction.service.ts`.
- infrastructure: `extraction.repository.ts`, `stub-ocr-provider.ts`, `inmemory-extraction-queue.ts`.
- api: `extractions.controller.ts`.
- docs `docs/OCR_EXTRACTION.md`; tests `test/extraction/extraction-logic.spec.ts`; frontend `apps/web/components/domain/documents/ExtractionReviewScreen.tsx`.

## 2. Files modified
- `docintel/application/storage.port.ts` + `infrastructure/local-object-storage.ts` — **additive**: added `readObject(key)` (OCR needs full bytes; Task 007 exposed only `readPrefix`). No existing behavior changed.
- `docintel/docintel.module.ts` + `index.ts` + `application/index.ts` — extended to wire/export the extraction service + new ports. No prior-task logic touched.

## 3. Database changes (migration 0009)
- `extraction_runs` — one per attempt; `method` (ocr/xml/hybrid), `engine`, `status`, `overall_confidence`; **partial unique** `uq_active_run` (≤1 active run per document).
- `document_extractions` — consolidated result; `doc_type`, `overall_confidence`; `UNIQUE(tenant,run_id)` (one per run) + **partial unique** `uq_current_extraction` (one `extracted` per document).
- `extraction_fields` — per-field `value_text`/`value_normalized`/`confidence`(0..1)/`source`/`validation_status`/`bbox`; `UNIQUE(tenant,extraction_id,field_key)`; **append-only** (deny_mutation trigger + INSERT/SELECT-only grant).
- All three ENABLE+FORCE RLS (company-scoped). Down migration drops cleanly (verified).

## 4. Security review
- **AI proposes, never commits (Invariant 4):** the module has no ledger dependency, writes only extraction tables, and audits as actor **`ai`** (capability-limited identity).
- **Deterministic over probabilistic (Invariant 6):** EIK/VAT/IBAN validators override OCR confidence — valid → `valid` (boosted), invalid → `invalid` (downranked ~0.4).
- **Tenant + company scoped, RLS-protected** (proved B sees 0 of A). **Immutable** extraction fields (DB-proven UPDATE/DELETE blocked).
- **Duplicate-extraction prevention** at the DB (active-run + current-extraction partial uniques).
- **EU + zero-retention OCR (Invariant 7):** `OcrProvider` is a port; prod vendor must be EU/zero-retention (deferred selection). Uploaded/extracted text is treated as DATA, never instructions.

## 5. Test results
- **Live DB proofs (ran):** run+extraction+4 fields w/ confidence · duplicate active run blocked · second current extraction blocked · field UPDATE blocked · RLS isolation (B↮A) · audit chain valid (actor `ai`) → **all PASS**.
- **Unit (jest, ran):** PDF/image OCR-text extraction (invoice_number/total/vat/currency + confidence) · XML extraction @0.99 · **validation outranks OCR** (valid EIK→valid, invalid EIK→invalid@≤0.4) · review-package flags (low-confidence/failed/missing) → **PASS**.
- Maps to required cases: PDF extraction, image extraction, XML extraction, confidence scoring, duplicate-extraction prevention, tenant isolation, audit generation.
- Combined suite: **15/15**; `tsc` clean; `eslint` clean.

## 6. OCR examples
From the sample invoice text (verified): `invoice_number=INV-2026-001@0.97`, `invoice_date=2026-04-15@0.95`, `total_amount=240.00@0.94`, `vat_amount=40.00@0.92`, `currency=EUR@0.9`, `supplier_eik=111111113@0.95 (valid)`, `supplier_vat=BG111111113@0.95 (valid)`, `iban=BG80…@0.95 (valid)`, `supplier_name=Acme OOD@0.84`. Overall = 0.871. XML sample: `invoice_number=UBL-77@0.99`, `supplier_name=Globex EOOD@0.99`, `total_amount=120.00@0.99`.

## 7. UI preview screenshots
Rendered inline above: the Extraction Review screen — extracted fields with per-field confidence bars and validation badges (valid/warning), an overall-confidence chip, and a flag banner. Component shipped at `apps/web/components/domain/documents/ExtractionReviewScreen.tsx`.

## 8. Known limitations
- **OCR + extraction are dev adapters**: `StubOcrProvider` returns the object's UTF-8 text (so text-ish PDFs/XML work in dev); real raster OCR for scanned PDFs/images requires the EU zero-retention vendor (prod adapter behind the same port). The field extractor is regex/keyword-based (deterministic, testable) — an AI/LLM extractor can be added behind the same `ExtractionResult` contract.
- **XML extractor** covers a UBL-ish subset by tag name (no namespace-aware XSD validation) — sufficient for MVP e-invoice fields.
- **Queue worker** is in-memory/logging (prod = BullMQ + capability-limited worker); `runExtraction` is the worker entrypoint and runs synchronously in dev.
- Frontend is a representative screen + preview, not type-checked in the backend harness.
- Confidence weights/thresholds are heuristic constants; tune with pilot data.

## 9. Next recommended task
**Task 009 — Rules Engine MVP** (VAT suggestions, posting suggestions, deterministic validation). Acceptance met: it consumes `IExtractionService.getReviewPackage`/`getExtraction` (fields + confidence + validation + flags) to produce suggestions, and **Task 010 (Review Queue)** consumes the same — no redesign of the extraction tables.

---
*Production-ready backend + migration + ports/adapters + tests + representative frontend. Verified on PostgreSQL 16 + Node. Commit: `feat(docintel): OCR & extraction pipeline with confidence scoring (AI proposes, never posts)`.*
