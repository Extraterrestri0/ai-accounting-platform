# TASK 006 — Master Data

**Roadmap:** `IMPLEMENTATION_TASKS_MASTER_v1.md` Task 006 · **Depends on:** 002–005 · **PR:** one scoped PR.
**Deliverable:** `task006-masterdata.zip` → unzip into repo root over Tasks 002–005 (later files win).

> **Verified during build (live PostgreSQL 16 + the cumulative repo):** migration 0007 applied; RLS isolation, duplicate detection, country FK, account-hierarchy integrity, and audit-chain-after-writes all proved; `tsc` clean, `eslint` clean, **7/7 tests pass** (auth + masterdata); 0007 down→up round-trips. No redesign of prior tasks; no new frameworks.

## 1. Files created
- DB: `db/migrations/0007_masterdata.{up,down}.sql`.
- masterdata domain: `models.ts`, `errors.ts`, `validation/eik.ts`, `validation/vat-number.ts`.
- application: `masterdata.service.interface.ts`, `masterdata.service.ts`, `index.ts`.
- infrastructure: `counterparty/account/vat-code/reference/company-settings` repositories + `index.ts`.
- api: 5 controllers (`counterparties`, `accounts`, `vat-codes`, `company-settings`, `reference`) + `dto/masterdata.dto.ts`.
- module/index: `masterdata.module.ts`, `index.ts`; runtime doc `docs/MASTER_DATA.md`.
- tests: `test/masterdata/masterdata-logic.spec.ts`.
- frontend: `apps/web/components/domain/counterparties/CounterpartiesScreen.tsx` (representative CRUD screen).

## 2. Files modified
- `modules/identity/domain/roles.ts` — **additive**: added `masterdata.read` / `masterdata.write` permissions and mapped them to roles (owner=all, accountant=read+write, approver/viewer/member=read). No behavior change to existing permissions. (Needed so Task 006 endpoints are RBAC-guarded.)
- `src/app.module.ts` — `MasterDataModule` import already present from the Task 002 skeleton; now resolves to the real module (no edit required).

## 3. Database changes (migration 0007)
- **Global reference (read-only, not RLS — universal data):** `countries` (ISO-2 + `is_eu`, 15 seeded), `currencies` (ISO-3 + `minor_units`, 4 seeded incl. EUR/BGN). SELECT granted to `app_user`.
- **Company-scoped (ENABLE+FORCE RLS):** `vat_codes`, `counterparties`, `company_settings` — policies `tenant_id = app.current_tenant_id() AND company_id = app.current_company_id()`.
- **`accounts` enriched (additive):** `parent_account_id` (composite self-FK — cannot parent across companies), `category`, `is_postable`; name/parent indexes.
- **Duplicate detection:** unique partial indexes on `(tenant,company,eik)` and `(tenant,company,vat_number)`.
- Down migration drops all of the above cleanly (verified).

## 4. Security review
- **Tenant + company scoped, RLS-protected** on all new tenant tables; cross-tenant read/write proven impossible (B sees 0 of A). Account hierarchy cannot cross companies (composite FK).
- **Audited:** counterparty/account/company-settings writes append a hash-chained audit event in the **same transaction**; chain still validates after writes.
- **RBAC:** every endpoint guarded by `@RequirePermission` + the global server-side guard (UI hints untrusted, Invariant 9).
- **Deterministic validation** (Invariant 6): EIK/BULSTAT checksum, EU VAT format (+ EIK for BG), country existence — all decided by validators, not AI.
- Reference tables hold no tenant data, so leaving them un-RLS'd is correct (documented decision), and they're read-only to the app.

## 5. Test results
- **Live DB proofs (ran):** valid-EIK insert commits · duplicate EIK blocked · unknown country rejected · RLS isolation (B↮A) · cross-company account parent rejected · reference data present · audit chain valid after writes → **all PASS**.
- **Unit (jest, ran):** EIK validator (incl. known EIK 131071587, bad checksum, wrong length, non-digit); VAT format (BG=BG+EIK, bad BG, DE ok, junk rejected); chart-of-accounts tree nesting → **PASS**. Combined with auth: **7/7**.
- **Gate:** `tsc --noEmit` clean · `eslint` clean (masterdata + roles).

## 6. Screenshots / UI preview
Rendered inline above: the Counterparties screen — search + kind filter + paginated table + create form showing an inline `Invalid EIK/BULSTAT` validation error. Component shipped at `apps/web/components/domain/counterparties/CounterpartiesScreen.tsx` (React + TanStack Query — chosen stack).

## 7. Known limitations
- **Frontend is one representative screen + preview**, not a full app — `apps/web` (Next.js App Shell, routing, design tokens, the other CRUD screens) is wired in the frontend tasks. The component is production-shaped and talks to the Task 006 API.
- **VIES** (VAT existence) is format-validated only; the online check is a later worker (deferred, EU + zero-retention).
- **Validators live in `modules/masterdata/domain/validation`** for now; intended home is `packages/validators` (relocatable without API change).
- **No standard BG chart-of-accounts / VAT-code seeding** on company setup yet (tables + create APIs exist; a seed template can be added without redesign).
- Counterparty/account/vat **update & deactivate** endpoints are minimal (create + read + settings update shipped); edit endpoints follow the same pattern when needed.
- Frontend component not type-checked in the backend harness (no `apps/web` tsconfig yet); validated by inspection + the API contract.

## 8. Next recommended task
**Task 007 — Document Upload Center** (upload PDFs/images/XML, malware scan, immutable storage). Acceptance met: it can resolve **Companies/Counterparties/Accounts/VAT Codes** via `IMasterDataService` (+ `getCompanySettings`) without redesign.

---
*Production-ready backend + migration + validators + tests + a representative frontend screen. Verified on PostgreSQL 16 + Node. Commit: `feat(masterdata): counterparties, chart of accounts, VAT codes, reference data + validation`.*
