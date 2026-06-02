# TASK 007 — Document Upload Center

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 007 · **Depends on:** 002–006 · **PR:** one scoped PR.
**Deliverable:** `task007-documents.zip` → unzip into repo root over Tasks 002–006 (later files win).

> **Verified during build (live PostgreSQL 16 + cumulative repo):** migration 0008 applied; RLS isolation, version immutability (UPDATE/DELETE blocked), status-check integrity, archive filter, and audit-chain-after-upload all proved; `tsc` clean, `eslint` clean, **10/10 tests pass**; 0008 down→up round-trips. No redesign of prior tasks; no new frameworks. This is the first user-facing workflow.

## 1. Files created
- DB: `db/migrations/0008_documents.{up,down}.sql`.
- docintel domain: `models.ts`, `errors.ts`, `validation/file-type.ts` (magic-byte detection + allowlist + 25 MB cap).
- ports: `application/storage.port.ts`, `application/scan.port.ts`.
- application: `document.service.interface.ts`, `document.service.ts`, `index.ts`.
- infrastructure: `document.repository.ts`, `local-object-storage.ts` (dev WORM adapter), `inmemory-scan-queue.ts` (dev scan adapter).
- api: `documents.controller.ts` + `dto/documents.dto.ts`.
- module/index: `docintel.module.ts`, `index.ts`; runtime doc `docs/DOCUMENT_UPLOAD.md`.
- tests: `test/documents/documents-logic.spec.ts`.
- frontend: `apps/web/components/domain/documents/{UploadCenterScreen,DocumentArchiveScreen,FilePreviewScreen}.tsx`.

## 2. Files modified
- None of the prior tasks' logic. `docintel.module.ts`/`index.ts`/`application/index.ts` replace the Task 002 docintel **stubs** (the docintel context is implemented now); `AppModule` already imported `DocIntelModule`. Reused existing `DOCUMENT_UPLOAD`/`COMPANY_READ` permissions from Task 005 (no RBAC change needed).

## 3. Database changes (migration 0008)
- `documents` — company-scoped; `status` CHECK (`pending_upload→uploaded→scanning→ready|quarantined|failed`), `storage_key`, `checksum_sha256`, nullable `counterparty_id` FK (set later by extraction), filename/status/created indexes.
- `document_versions` — append-only/immutable (deny_mutation trigger + INSERT/SELECT-only grant), content-addressed by checksum, `UNIQUE(tenant,document,version_no)`.
- `document_metadata` — mutable; `detected_type`, `scan_status` CHECK, `scan_engine`, `scanned_at`, jsonb `extra`.
- All three ENABLE+FORCE RLS (company-scoped policies). Down migration drops cleanly (verified).

## 4. Security review
- **Tenant + company scoped, RLS-protected** on all three tables (proved B sees 0 of A).
- **Immutable storage:** WORM lock on finalize + append-only `document_versions` (DB-proven UPDATE/DELETE blocked; dev storage overwrite-after-lock throws).
- **Deterministic file-type validation** (magic bytes, not extension/MIME alone) + **size cap** (25 MB) enforced server-side on finalize.
- **Malware-scan pipeline** (port) — fail-closed: documents stay `scanning` until a real result; infected → `quarantined` and never served; downloads via short-lived (5-min) signed URLs into a sandboxed viewer.
- **Audited:** initiate, finalize (`docintel.document_received`), and scan-result each append a hash-chained audit event in the same transaction (chain validates).
- Uploaded content treated as DATA (no instruction-following) — relevant once OCR/AI consumes it.

## 5. Test results
- **Live DB proofs (ran):** create doc+version+metadata · version UPDATE blocked · version DELETE blocked · status update allowed · invalid status rejected · RLS isolation (B↮A) · archive filter scoped · audit chain valid after upload → **all PASS**.
- **Unit (jest, ran):** magic-byte detection for PDF/PNG/JPEG/TIFF/XML + rejects .exe/unknown · extension allowlist + 25 MB cap · LocalObjectStorage put/readPrefix/**WORM lock (overwrite denied)**/signed-URL → **PASS**.
- Maps to the required cases: upload success, upload validation, invalid type, invalid size, tenant isolation, archive retrieval, audit generation.
- Combined suite: **10/10**; `tsc` clean; `eslint` clean.

## 6. UI preview screenshots
Rendered inline above: Upload Center with drag-and-drop dropzone, multi-file queue showing **progress bar**, **scanning** state, a **validation error** (`Unsupported type .docx`), and a **ready** item; plus the Document Archive with search, status filter, and status badges (Ready / Scanning / Quarantined). Components shipped under `apps/web/components/domain/documents/` (React + TanStack Query; Upload Center, Archive, File Preview).

## 7. Known limitations
- **Storage & scan are dev adapters** (local FS WORM simulation; in-memory scan queue that logs). Prod S3-Object-Lock and BullMQ+ClamAV/vendor worker swap in behind the same ports (no service changes) — wired in the infrastructure task.
- **Frontend is representative screens + preview**, not a full app — `apps/web` App Shell/routing/tokens land in the frontend tasks; not type-checked in the backend harness.
- `counterparty_id` is a simple FK; same-company linking is enforced when extraction sets it (Task 008+), not at upload (it's null at upload time).
- No client-side resumable/chunked upload yet (single PUT); fine within the 25 MB cap.
- Scan-result endpoint is permission-guarded but not yet restricted to a dedicated worker identity (hardened with the workers task).

## 8. Next recommended task
**Task 008 — OCR & Extraction Pipeline.** Acceptance met: it consumes `IDocumentService` (`listDocuments({status:'ready'})`, `getDocument`, `getDownloadUrl`) to process clean documents and writes extractions + sets `counterparty_id`/`document_date` on top — no redesign of these tables.

---
*Production-ready backend + migration + ports/adapters + tests + representative frontend. Verified on PostgreSQL 16 + Node. Commit: `feat(docintel): document upload center with immutable storage + malware-scan pipeline`.*
