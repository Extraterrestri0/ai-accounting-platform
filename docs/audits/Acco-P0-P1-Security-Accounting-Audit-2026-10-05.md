# Acco — P0/P1 Security & Accounting-Correctness Hardening Audit

Date: 2026-10-05 · Baseline commit audited: `0d51977` (= current production API) · Working from `0c5a0f1` (API identical to `0d51977`).
Scope: verify the prior P0/P1 findings against real code, implement only the verified P0/P1 fixes, add regression tests. **No commit, no push, no deploy.** Nothing on the VPS, Caddy, Docker, `.env.deploy`, or production data was touched. The backup branch was not merged.

---

## 1. Executive summary

The previous audit's security findings were largely correct; its accounting findings were a mix of real issues and overstated ones. I verified each against the running code on a locally stood-up Postgres 16 + Redis with all 40 migrations applied and the project's own test lanes.

Three verified issues were fixed, each a minimal change at the correct architectural layer, with regression tests:

- **A (P0) — anonymous/guessable document reads.** The `GET /dev-storage/*` route (the production document-serving path, since prod runs `STORAGE_DRIVER=local`) was excluded from auth and its "signed" URL used an **unkeyed** hash the handler **never checked**, so any anonymous caller who knew or guessed a storage key could read another company's documents; `..` keys could escape the storage root. Fixed: real keyed **HMAC-SHA256**, time-limited, verified constant-time in the handler; traversal refused in the storage adapter.
- **C (P1) — ledger writes under-guarded.** `LedgerController` carried no permission decorators and the RBAC guard allows an undecorated route, so any authenticated user including a read-only **viewer** could `POST /ledger/entries` / `/reverse`, bypassing the review→approve gate. Fixed: `@RequirePermission(ledger.post/reverse/read)` on every route.
- **D (P1) — no runtime validation on the money endpoint.** The ledger DTOs were bare interfaces, so the global `ValidationPipe` validated nothing. Fixed: validated `class-validator` DTOs (ISO date, ≥2 lines, debit/credit enum, positive 2-dp decimal, UUID account, ISO currency, bounded strings).

Everything else is reported, not changed: **B** (demo seed in the deploy script — infra, report-only per the engagement constraint), **E** (posting date = today; no persisted tax-event date exists to use yet — needs a review-step capture + accountant rule, must not be changed silently), **F/G** (EUR literal; hard-coded BG VAT accounts — currently consistent, P2), **H** (invoice numbering is code-correct and concurrency-safe; the 10-digit/no-reset format is a legal-review item).

Regression status after the fixes: **typecheck ✓, lint ✓, jest 51 suites / 388 tests ✓ (+28 new), MVP e2e 14/14 ✓, SAF-T v2 e2e 17/17 ✓** (incl. signed download + cross-tenant denial), web typecheck/lint ✓. "AI cannot post / cannot approve" still proven by the e2e lane.

---

## 2. Baseline

- Branch `feat/mvp-modules`, HEAD `0c5a0f1`, working tree clean at start, `ahead 2` of origin. `git diff 0d51977 HEAD -- apps/api packages infra docker-compose*` is empty, so the audited API is exactly what is deployed.
- Local harness: Postgres 16.13 (`app_owner` owner role, `app_user` RLS-subject login), Redis 7, `DOC_STORAGE_DIR` on tmp. Applied migrations 0001→0040 cleanly; loaded `seed-e2e.sql`.
- **Pre-change baseline (verified before editing anything):** typecheck ✓, lint ✓, jest **48 suites / 360 tests ✓**, MVP e2e **14/14 ✓**.
- Architecture integration points confirmed by reading: auth = Bearer-JWT `JwtPrincipalResolver`; per-request tenant via `TenantContextMiddleware` (rejects no-principal; company set only after an assignment check); RLS enforced in-DB as `app_user` (NOBYPASSRLS, FORCE RLS, fail-closed); authorization via global `RbacGuard` + `@RequirePermission`; storage via `StorageService` port (local vs S3 by env); ledger writes only through `LedgerService` (balance + immutability + audit in one txn, deferred balance constraint, period-lock gate); posting via `PostingService.postFromReview` (human-only, duplicate-guarded); invoice numbering via row-locked gapless counter.

---

## 3. Findings verified (with code evidence)

**A — Document access / storage security — VERIFIED (P0).**
`src/app.module.ts` excludes `{ path: 'dev-storage/(.*)', method: GET }` from `TenantContextMiddleware`. `DevStorageController.get` took the key from the URL and called `storage.readObject(key)` with no auth and no signature check. `LocalObjectStorage.getDownloadUrl` built `sig = sha256(key + exp)` — **no secret → forgeable**, and the GET handler ignored `exp`/`sig` entirely. Keys are `tenant/company/docId/filename`, i.e. guessable/enumerable. `full(key) = path.join(root, key)` → a `..` key escaped the root. Production deploy sets `STORAGE_DRIVER=local` + `DOC_STORAGE_DIR=/var/lib/doc-storage` (docker-compose.deploy.yml), so this is the live document path, not dev-only.
- Anonymous read: **was possible.** Same-tenant legitimate read: via signed URL. Cross-tenant read: **possible** with a known/guessed key. Guessed document ID: **possible.** Direct storage path / traversal: **possible.**

**B — Production demo credentials / dev seed — VERIFIED (P0, report-only).**
`infra/deploy-sofia.sh` step "8/8" runs `apps/api/scripts/seed-dev.sql`, which `INSERT … ON CONFLICT DO UPDATE` on `demo@demo.bg` with a real argon2id hash of `Demo1234!` and prints the credentials. `ON CONFLICT DO UPDATE SET password_hash=…` means every run **re-seeds/﻿re-enables** the predictable account. This is a deploy/infra script; per the engagement constraint I report it and do not modify it.

**C — Ledger write authorization — VERIFIED (P1).**
`LedgerController` had no `@RequirePermission`. `RbacGuard.canActivate` returns `true` when no permission metadata is present. Middleware + RLS still prevent anonymous and cross-tenant writes, but **any authenticated user with an active company — including `viewer` — could POST a journal entry or reverse one directly**, bypassing the review/approval workflow (breaks the spirit of Invariant 5 at the role layer). AI/worker identities have no HTTP principal and `created_by_actor_type` is hard-coded `user`, so this was a human-role escalation, not an AI-posting hole.

**D — DTO / input validation — VERIFIED (P1).**
No `class-validator` usage anywhere in `src/modules`; every DTO is an `interface`, which compiles away, so the global `ValidationPipe({whitelist,transform})` had no metatype to validate and passed bodies through. The ledger post endpoint accepted arbitrary/negative/garbage amounts, bad dates, unknown fields.

**E — Posting date — VERIFIED (behaviour), fix DEFERRED.**
`PostingService.postFromReview` posts with `postingDate: new Date()…` and the ledger's own manual path also defaults to today when none is supplied (the raw `LedgerService.postEntry` correctly uses the caller's `postingDate` with **no** silent today-fallback). Extraction captures `tax_event_date`/`invoice_date`, but **`documents.document_date` is never written** and no tax-event date is threaded into the approved posting — there is currently no reliable, persisted date source other than today. A correct fix requires the review step to capture/confirm the tax-event date, persist it, validate it against the open period, and an accountant-confirmed rule (tax-event date vs today for late-entered documents). Changing it now would silently move entries between VAT periods — explicitly out of bounds for this pass. See §17.

---

## 4. Findings disproved or reclassified

**F — "literal EUR / inconsistent currency" — PARTIALLY VERIFIED → P2.** `postFromReview` hard-codes `currency:'EUR'` and `LedgerService` defaults to `'EUR'`. But `companies.base_currency` is `EUR` for every company and the platform is EUR-functional by design (CLAUDE.md §8), so no incorrect currency is produced today. The clean fix is to derive the journal currency from the company's base currency at one boundary (fail-closed if absent) rather than scattering literals — hardening, not a live defect. Not changed this pass.

**G — "registers depend on hard-coded accounts" — PARTIALLY VERIFIED → P2.** `tax/domain/vat/calculator.ts` keys registers on `4531/4532/401/411`. These are the **standard Bulgarian national-chart VAT and settlement accounts**, seeded deterministically by migration `0040` when a company is created. It is a deliberate chart rule consistent with the seeded chart, not an unsafe shortcut; it would only misbehave for a company using non-standard VAT account codes, which the product does not create. Making it configurable via the existing `account_mappings` (migration 0023) is P2. Not a correctness defect for the shipped chart.

**H — "invoice numbering insufficient (4-digit/yearly)" — CODE CORRECT / LEGAL REVIEW.** `allocateNumber` is gapless and concurrency-safe: `UPDATE invoice_numbering_series SET next_number = next_number + 1 … RETURNING next_number - 1` takes a row lock, so concurrent issues serialize; the result is unique per `(company, kind, series, year)` with a DB uniqueness constraint. The **format** `2026-0001` (4-digit, yearly reset) vs the commonly-cited ЗДДС 10-digit continuous rule is **not established anywhere in the repository**; per the brief I flag it as accountant/legal review, not a code bug, and did not invent the requirement. No concurrency or uniqueness defect exists.

---

## 5. P0 findings (this pass)

| ID | Issue | Status |
|----|-------|--------|
| A | Anonymous/guessable/traversal document reads via `GET /dev-storage/*` with an unverified, unkeyed "signature" (live under the production local storage driver) | **Fixed** |
| B | `deploy-sofia.sh` re-seeds predictable `demo@demo.bg / Demo1234!` on every deploy | **Reported** (infra; see §17) |

## 6. P1 findings (this pass)

| ID | Issue | Status |
|----|-------|--------|
| C | Ledger write routes had no permission check → a viewer could post/reverse | **Fixed** |
| D | Financial write DTOs had no runtime validation | **Fixed** (ledger money endpoint) |
| E | Posting uses `new Date()`; no persisted tax-event date to use instead | **Reported / deferred** (needs review-step capture + accountant rule) |

---

## 7. Fixes implemented

**A — signed, expiring, traversal-safe local document URLs.**
- New `docintel/infrastructure/signed-url.ts`: `storageUrlSecret()` (reuses the already-required, already-validated `JWT_SECRET`; optional `STORAGE_URL_SECRET` override — **no new mandatory env**, so prod boot/env-validation is unchanged), `signStorageKey` (HMAC-SHA256 over `key\nexp`), `buildSignedLocalUrl`, `verifyStorageSignature` (expiry + constant-time `timingSafeEqual`, length-checked).
- `LocalObjectStorage.getDownloadUrl` now returns `buildSignedLocalUrl(key, ttl)`; `full(key)` resolves against the root and throws on any path that escapes it (every read/write is now traversal-safe, defence in depth).
- `DevStorageController.get` verifies `exp`+`sig` before reading; invalid/forged/expired/unsigned → `404` (same shape as a missing object, so there is no key-existence oracle). The `PUT` route is unchanged and remains behind the auth middleware.
- *Why this layer:* the GET route is intentionally token-authenticated (an `<iframe>` can't send a bearer header), mirroring S3 presigned URLs, so the right fix is to make that token real and verify it where it is consumed; the adapter owns path safety for all callers. Legitimate downloads are unaffected — the frontend always mints a fresh URL via `getDownloadUrl` (5-minute TTL), so there are no durable URLs to break.

**C — ledger RBAC.** `@RequirePermission(LEDGER_POST | LEDGER_REVERSE | LEDGER_READ)` on the four `LedgerController` routes; DTOs imported as values so the pipe binds. The role matrix already withholds `ledger.post`/`ledger.reverse` from `viewer` and `approver` (segregation of duties). *Why this layer:* the controller is where the global guard reads the required permission; no service or DB change needed.

**D — validated ledger DTOs.** `post-entry.dto.ts` is now `class-validator` classes: `postingDate` ISO-8601; `description/sourceType/sourceRef` bounded optional strings; `currency` `^[A-Z]{3}$`; `lines` array `@ArrayMinSize(2)` of `PostEntryLineDto` (`accountId` UUID, `direction` in `debit|credit`, `amount` `^\d{1,17}\.\d{2}$` i.e. positive exact 2-dp, `narrative` bounded). The global pipe's `whitelist` strips unknown fields; I did **not** flip the global `forbidNonWhitelisted` (too broad a blast radius). *Why this layer:* validation belongs at the HTTP boundary DTO; the domain/ledger still re-validates balance authoritatively.

---

## 8. Security model after fixes

- **Documents:** served only via a keyed, 5-minute HMAC URL; anonymous, forged, expired, key-swapped, and traversal requests are denied; cross-tenant key reuse fails (signature is bound to the exact key, and RLS still scopes the metadata/issuing path). Production should additionally move to the S3/MinIO driver (presigned URLs) — recommended in §16, not required for the fix.
- **Ledger:** writable only by principals holding `ledger.post`/`ledger.reverse` for the active company; anonymous (middleware) and cross-tenant (RLS) remain blocked; AI/worker cannot post (no HTTP principal; actor type fixed to `user`); period lock + immutability + deferred balance unchanged.
- **Input:** the money endpoint rejects malformed/negative/garbage payloads and strips unknown fields before the service runs.

## 9. Accounting invariants after fixes

Unchanged and still proven by the e2e lanes: double-entry balance enforced at COMMIT; append-only ledger (UPDATE/DELETE/TRUNCATE blocked); corrections are reversing entries; one reversal per original; period-lock refuses posting; hash-chained audit validates; RLS cross-tenant = 0; AI cannot post or approve. No accounting semantics were changed in this pass (posting date deliberately left as-is pending §17).

## 10. Tests added (28, all passing)

- `test/documents/dev-storage-security.spec.ts` — HMAC verify/forge/expire/key-swap; controller GET serves on valid, 404s on unsigned/forged/re-pointed and never touches storage then; `LocalObjectStorage` traversal refusal.
- `test/ledger/ledger-authz.spec.ts` — role matrix (viewer/approver denied post+reverse; accountant/owner allowed; none-role denied) **and** controller-metadata assertions proving every route carries a permission (regression guard for Finding C).
- `test/ledger/ledger-dto-validation.spec.ts` — valid body passes; bad date, <2 lines, bad direction, negative/float/non-numeric amount, non-UUID account, bad currency all rejected; unknown fields stripped under whitelist.
- `jest.config.cjs` — added `**/test/ledger/**/*.spec.ts` to `testMatch` (additive; no suite weakened or removed).

## 11. Full test results

| Gate | Before | After |
|------|--------|-------|
| API typecheck | ✓ | ✓ |
| API lint | ✓ | ✓ |
| API jest | 48 suites / 360 | **51 suites / 388** |
| MVP e2e workflow (real PG) | 14/14 | **14/14** (fresh DB) |
| SAF-T v2 e2e (real PG, local storage download) | 17/17 | **17/17** |
| Web typecheck / lint | ✓ | ✓ |

(The one transient "3 failed" seen mid-run was the e2e workflow's known non-idempotency when run twice against the same DB — doubled totals, invoice `2026-0002`; it passes 14/14 on the fresh DB that `e2e.sh` always creates. Not a regression.)

## 12. Files changed

Modified (5): `apps/api/jest.config.cjs`, `apps/api/src/modules/docintel/api/dev-storage.controller.ts`, `apps/api/src/modules/docintel/infrastructure/local-object-storage.ts`, `apps/api/src/modules/ledger/api/dto/post-entry.dto.ts`, `apps/api/src/modules/ledger/api/ledger.controller.ts`.
Added (4): `apps/api/src/modules/docintel/infrastructure/signed-url.ts`, `apps/api/test/documents/dev-storage-security.spec.ts`, `apps/api/test/ledger/ledger-authz.spec.ts`, `apps/api/test/ledger/ledger-dto-validation.spec.ts`.
Plus this report. No web, infra, Docker, Caddy, `.env`, migration, or SQL file was changed.

## 13. Migrations

**None.** No schema change was required. No production data transformation is needed.

## 14. Deployment implications

- API-only code change; rebuild/redeploy the `api` (and `worker`, which shares the image) containers; `web` is unaffected by this pass.
- No new required env var. The HMAC secret defaults to the existing `JWT_SECRET` (present in prod), so `api` and `worker` already share it; optionally set `STORAGE_URL_SECRET` to rotate independently of the JWT secret.
- Behaviour change for clients: document/SAF-T downloads must use a URL freshly issued by the API (they already do; 5-min TTL). Any old-style link is rejected — acceptable, as these are short-lived. Viewers that were (incorrectly) hotlinking unsigned keys will stop working, which is the intended effect.
- Ledger API now returns `403` for users lacking `ledger.post`/`ledger.reverse`, and `400` for malformed ledger bodies. The normal review→approve→post flow is unchanged (posting goes through `PostingService` as a human with the right role).

## 15. Rollback implications

Pure code; roll back by redeploying the previous `api`/`worker` image (the existing `mgi-delta-web` rollback image is unrelated and untouched). No data migration to unwind. Reverting re-opens findings A/C/D.

## 16. Remaining P2/P3 work

- **P2** Switch production to the S3/MinIO storage driver (presigned URLs; MinIO is already running with Object-Lock) so document serving no longer depends on the app route at all.
- **P2** Derive journal currency from `companies.base_currency` at one boundary (finding F).
- **P2** Make VAT register account roles configurable via `account_mappings` instead of literals (finding G).
- **P2** `JWT_SECRET` vs `AUTH_JWT_SECRET` naming: `TokenService` reads `AUTH_JWT_SECRET ?? 'dev-only-not-for-prod'` while env validation requires `JWT_SECRET`; compose sets both to the same value so prod is fine, but the fallback should be removed and the names unified to prevent a future mis-set signing with the dev secret.
- **P2** Google OAuth `state`/nonce validation and `email_verified` enforcement; fail-closed malware scan when `AV_SCAN_URL` is unset.
- **P3** Password reset, MFA enrolment UI, per-route auth rate limiting, off-host backups incl. documents.

## 17. Accountant / legal review items

- **Posting date rule (finding E):** confirm the required rule — post at the document's **tax-event date** (дата на данъчното събитие), the invoice date, or today for late entries — and the handling when that date falls in a locked period. Once confirmed, the fix is: capture/confirm the date in the review step, persist it (e.g. `documents.document_date` / on the approved posting), pass it to `postFromReview`, and validate it via the existing period gate. This is a deliberate, accountant-owned decision, not a silent code change.
- **Invoice number format (finding H):** confirm whether ЗДДС requires a 10-digit continuous (non-yearly-reset) number. If so, this is a format/migration change to `formatInvoiceNumber` + numbering series, to be scheduled with sign-off (the allocation mechanism is already gapless and safe).
- **VAT treatment coverage:** golden cases currently cover the standard rate; confirm 9%/0%/exempt/reverse-charge/intra-EU expected treatments and amounts for a fuller test set.

## 18. Production smoke-test plan (after a future deploy — not executed here)

1. `GET /api/health/ready` → ok, uptime not reset for db/redis/storage.
2. Sign in as a real user; open a document in the viewer → loads (fresh signed URL).
3. Copy that document URL, strip/alter `sig` → `404`; wait past 5 min and retry the original → `404`.
4. As a `viewer` role, `POST /api/ledger/entries` → `403`; as `accountant`, the normal review→approve→post flow still posts.
5. `POST /api/ledger/entries` with a negative amount / bad date → `400`.
6. SAF-T export → download works; a second user in another company cannot download it.
7. Confirm no `demo@demo.bg` login exists in production (and remove the seed step per §5/B before any future full `deploy-sofia.sh` run).

## 19. Recommended next product pass

1. **Finish the security posture (P2):** S3/MinIO driver in production, unify the JWT secret env, OAuth `state`, fail-closed malware scan, per-route auth throttling.
2. **Posting-date correctness (E) + VAT golden cases:** with accountant sign-off, capture and use the tax-event date end-to-end and expand VAT tests.
3. **Then** the product UI pass (Acco palette on the app) previously scoped — unchanged by this work.

---

## Per-concern verdicts

- A (document access): **VERIFIED** → fixed.
- B (demo seed): **VERIFIED** → reported (infra, report-only).
- C (ledger authorization): **VERIFIED** → fixed.
- D (DTO validation): **VERIFIED** → fixed (money endpoint).
- E (posting date): **VERIFIED** → deferred (needs tax-event-date capture + accountant rule; not changed silently).
- F (currency EUR literal): **PARTIALLY VERIFIED** → P2 (currently harmless).
- G (hard-coded VAT accounts): **PARTIALLY VERIFIED** → P2 (deliberate BG chart rule).
- H (invoice numbering): **NOT VERIFIED** as a code defect (gapless + concurrency-safe); format is a legal-review item.

---
---

# ROUND 2 ADDENDUM (2026-10-05) — closing B and E

The Round-1 security review was accepted conditionally, with two items to close before the commit: the P0 demo seed (B) and the posting-date P1 (E). This addendum records that work. The original findings above are left intact. All Round-1 A/C/D fixes and their tests are preserved unchanged. Still **no commit, no push, no deploy**; Caddy/MONIX untouched; backup branch not merged; no production data touched.

## R2.1 — Finding B: demo seed — VERIFIED → **FIXED**

Re-traced every seed/credential path (deploy script, `seed-dev.sql`, `seed-e2e.sql`, all 41 migrations, docker-compose, Docker entrypoints, CI). Results:
- The **only** path that creates/resets a predictable credential is `apps/api/scripts/seed-dev.sql` (`demo@demo.bg` / `Demo1234!`), invoked by `infra/deploy-sofia.sh` step 8.
- Migration `0022_cms.up.sql` **links** an existing `demo@demo.bg` as CMS owner via a conditional `SELECT … WHERE email='demo@demo.bg'`; it does **not** create a user or a password. Harmless once the seed no longer runs (no demo user ⇒ no link). Verified no `*.up.sql` inserts a `users` row carrying a password hash, and none hardcodes `Demo1234`.
- CI (`.github/workflows/ci.yml`) and the local e2e lane use `seed-e2e.sql`, which seeds tenants/companies/accounts/VAT codes/counterparties only — **no users, no credentials**. Unaffected.

Fix (two layers):
1. **`infra/deploy-sofia.sh`** — removed the automatic `seed-dev.sql` execution (step 8 is now just the backup cron) and removed the printed demo credentials. Added a comment explaining the first user registers via `POST /api/auth/register`. This is a deploy-script change the Round-2 brief explicitly authorized ("Fix this now").
2. **`apps/api/scripts/seed-dev.sql`** — made **fail-closed**: a `psql` guard at the very top aborts (`\quit`) before any write unless the caller explicitly opts in with `-v allow_dev_seed=1`. So even a manual/accidental `psql < seed-dev.sql` against a real database writes nothing. The file header now states DEV-ONLY in bold.

Proven locally: running `seed-dev.sql` without the flag refuses and creates no demo user; running it with `-v allow_dev_seed=1` on a fresh migrated DB still seeds (dev path intact).

Regression test (`test/security/deploy-no-dev-seed.spec.ts`, 5 cases): deploy script does not execute the dev seed and does not print the credential; `seed-dev.sql` has the opt-in guard and `\quit` *before* the first `INSERT`; no migration inserts a password-bearing user or hardcodes the demo credential.

## R2.2 — Finding E: posting date — VERIFIED → **FIXED** (end to end)

Product invariant implemented (as specified in the Round-2 brief; no tax-law semantics invented): the document-driven review→post flow uses a **human-confirmed** accounting posting date. AI proposes it; a human confirms/corrects it in Review; it is persisted; posting uses that exact date. **No silent fallback to today.** If no confirmed date exists → posting is refused. If the confirmed date is in a locked period → refused via the existing period gate (never moved to an open period). UI label is neutral: **"Дата за осчетоводяване" / "Posting date"**.

### Exact posting-date data flow (after fix)
1. **Extraction** persists `tax_event_date` / `invoice_date` as extraction fields (unchanged).
2. **Review API — `getDetail`** now returns `proposedPostingDate` = already-confirmed value, else extracted/corrected `tax_event_date`, else `invoice_date` (strict `YYYY-MM-DD`, never today). Nothing is proposed if the document carries no usable date — the reviewer must enter it.
3. **Review UI** (`review/[id]`) shows a "Дата за осчетоводяване" date field pre-filled with the proposal; the reviewer can correct it. **Approve** sends the confirmed date and is disabled until one is set. For an already-approved package without a date (e.g. legacy), a "Запази"/save control sets it and the **Осчетоводи (post)** button is disabled until a confirmed date exists.
4. **Persistence** — confirmed date is stored on `review_packages.approved_posting_date` (migration 0041). Set via `POST /reviews/:id/posting-date`, via `POST /reviews/:id/edit`, or at `POST /reviews/:id/approve`. All go through `ReviewService`, which validates the date (`parsePostingDate`, strict calendar check) and refuses non-human actors.
5. **Posting — `PostingService.postFromReview`** reads `pkg.approvedPostingDate`; if absent/invalid → `422 "No confirmed posting date…"` (fail closed, **no `new Date()`**). It then gates the **confirmed** date through `periods.assertOpen` (friendly early check) and passes it as `postEntry({ postingDate })`.
6. **Ledger — `LedgerService.postEntry`** re-asserts the period on that date authoritatively and stores it as the journal `posting_date`. Balance/immutability/audit unchanged.

### Persistence model (smallest correct)
New nullable column `review_packages.approved_posting_date date` (migration `0041_review_posting_date`). Chosen over overloading `documents.document_date` (which is never written and whose semantics are "the document's own date", not "confirmed posting date"). One review package per document, and posting already consumes the review package, so this is the natural, non-duplicative home. Nullable + **no default** ⇒ existing/unconfirmed packages are NULL ⇒ posting fails closed; **no backfill with today** (§R2.4).

### Migration details
- `0041_...up.sql`: `ALTER TABLE review_packages ADD COLUMN approved_posting_date date;` + a column comment. Adding a nullable column with no default is a **metadata-only** change in PostgreSQL — no table rewrite, no long lock, safe online.
- `0041_...down.sql`: `DROP COLUMN IF EXISTS`. Verified down→up round-trips (column count 1→0→1); `migrate:validate` passes.

### Tests added for E
- `test/posting/posting-date.spec.ts` (8): `parsePostingDate` accept/reject (incl. `2026-02-30`, `30/09/2026`, empty, non-string); `postFromReview` posts with the confirmed date and **not** today, gates the confirmed date, and fails closed on: missing date, locked period, duplicate, non-human actor (deterministic, mocked deps).
- `test/review/review-posting-date.spec.ts` (11): `getDetail` proposes tax-event→invoice→none; `setPostingDate`/`edit`/`approve` persist the validated date; invalid dates rejected; decisions human-only (AI cannot approve).
- `test/e2e/posting-date-e2e.ts` (4, real PostgreSQL): confirmed date round-trips through the real repo as `YYYY-MM-DD`; the real `LedgerService` stores the confirmed date (not today); debit = credit; a confirmed date in a locked period fails closed. Wired into `scripts/e2e.sh` (step 6b).

## R2.3 — Task 3: adversarial review of the A (signed-URL) fix

Reviewed and hardened; tests added (`test/documents/dev-storage-security.spec.ts`, now 17 cases):
- **URL encode/decode** cannot alter the signed key — the sig is bound to the decoded key; a key with spaces/Cyrillic/`%`/`+` round-trips and verifies; any change ⇒ 404.
- **Duplicate `exp`/`sig`** params arrive as arrays → `verifyStorageSignature` now rejects non-string inputs.
- **Malformed signatures** never throw (odd-length, non-hex, empty, 100k-char) — hex-shape checked, length equalized before `timingSafeEqual`, wrapped in try/catch → false.
- **Expiry** must be a strict integer ms, finite, not past, **and not absurdly far future** (new 24h upper bound) — `NaN`/`Infinity`/`-1`/`1e9`/`12.5` all rejected.
- **Traversal / absolute / backslash / NUL** keys are refused by the adapter (`../`, encoded `..`, `/etc/passwd`, `..\\..\\`, `a\0b`).
- **Key OR expiry tamper** invalidates the signature (HMAC over `key\nexp`).
- **No existence oracle**: unsigned/forged/expired and missing-object both return identical `404 {Object not found}` without reaching storage on a bad signature; a valid signature for an arbitrary key cannot be forged.

## R2.4 — Transition impact on existing records (IMPORTANT: no backfill)

- `approved_posting_date` is added **NULL**. Existing documents/review packages — including already-approved-but-not-yet-posted ones — have **no** confirmed posting date and are **not** backfilled with today or any invented date.
- Consequence: such a package **cannot be posted** until a human opens Review and confirms the posting date (UI provides the field + "Запази"; post is disabled until then). This is the intended fail-closed behaviour.
- Already-**posted** journal entries are untouched (immutable ledger); their historical `posting_date` is unchanged.
- No data migration/transformation is required or performed. If the team later wants a controlled transition for a known backlog, that is a separate, accountant-approved decision — not done here.

## R2.5 — Full gates (Round 2)

| Gate | Round 1 | Round 2 |
|------|---------|---------|
| API typecheck | ✓ | ✓ |
| API lint | ✓ | ✓ |
| API jest | 51 suites / 388 | **54 suites / 418** |
| MVP e2e workflow (fresh DB) | 14/14 | **14/14** |
| posting-date e2e (real PG) | — | **4/4** |
| SAF-T v2 e2e (real PG, signed download) | 17/17 | **17/17** |
| Web typecheck / lint | ✓ | ✓ |
| Web production build | (n/a R1) | **✓ compiled, 27/27** |
| Migration 0041 down→up + `migrate:validate` | — | **✓** |

Explicitly re-verified: anonymous document read denied; forged/expired/traversal signed URL denied; viewer ledger post denied; malformed ledger DTO denied; normal accountant review→approve→post succeeds (MVP e2e); AI cannot approve; AI cannot post; locked-period posting denied; posting uses the confirmed date, not today; debit = credit.

## R2.6 — Deployment impact (Round 2)

- **API image:** changes (docintel + ledger + review code). **Worker image:** shares the API image → rebuilt; no worker behaviour change. **Web image:** changes (Review screen gains the posting-date field + two client calls).
- **Infra:** `infra/deploy-sofia.sh` changed (removed auto dev-seed) — **report + change were authorized for Task 1**; no Caddy/MONIX/compose/.env change.
- **DB migration:** **yes — one**, `0041_review_posting_date` (additive, nullable, metadata-only; forward+rollback provided). Apply via the existing `migrate` service (`node scripts/migrate.js`) before/at API rollout; it is backward-compatible so old API code tolerates the new column.
- **Existing production data:** no transformation; unconfirmed packages become unpostable until a human confirms the date (§R2.4).
- **Recommended deployment sequence (NOT executed):** 1) back up the DB; 2) build API+worker+web images for the commit; 3) run `migrate` (applies 0041); 4) roll `api`, then `worker`, then `web`; 5) smoke-test §18 plus: open an approved document → confirm the posting date → post → journal `posting_date` equals the confirmed date; a document with a locked-period date is refused; no `demo@demo.bg` login exists.
- **Rollback:** redeploy the previous `api`/`worker`/`web` images. The `0041` column is additive and harmless to leave in place on a code rollback; if full reversal is wanted, apply `0041_...down.sql` **after** reverting code (no data loss — the column only held confirmed dates). The existing web rollback image is unrelated and untouched.

## R2.7 — Updated per-concern verdicts

- A (document access): **VERIFIED → FIXED** (hardened; adversarial tests added).
- B (demo seed): **VERIFIED → FIXED** (deploy no longer seeds; seed is fail-closed; regression test).
- C (ledger authorization): **VERIFIED → FIXED**.
- D (DTO validation): **VERIFIED → FIXED** (ledger money endpoint).
- E (posting date): **VERIFIED → FIXED** end to end (human-confirmed, persisted, fail-closed; migration 0041; UI + tests).
- F (currency EUR literal): **PARTIALLY VERIFIED → P2** (currently harmless).
- G (hard-coded VAT accounts): **PARTIALLY VERIFIED → P2** (deliberate BG chart rule).
- H (invoice numbering): **NOT VERIFIED as a code defect** (gapless + concurrency-safe); format is accountant/legal review.
