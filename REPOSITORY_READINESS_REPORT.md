# Repository Readiness Report

**Repository:** `ai-accounting-platform` (AI Accounting Platform — Bulgarian-first, EUR-native)
**Date:** 2026-06-03
**Scope:** Repository assembly + root-file verification + install/build/test verification. **No new features.**

---

## 1. What was done

The repository on disk was a set of architecture docs plus per-task code **zips** — no assembled source tree and no canonical root. The latest cumulative artifact, `task018a-production-gap-closure.zip`, is the **single canonical repository** (536 entries, no `node_modules`). Assembly performed:

1. **Extracted** `task018a-production-gap-closure.zip` into the repo root → materialized `apps/`, `infra/`, `.github/` and all root files.
2. **Verified the canonical structure and root files** (all present — nothing missing to generate; see §3).
3. **Applied one portability fix** to make the documented `npm run build` succeed on every OS (see §4).
4. **Ran install → build → tests → typecheck → lint** from the repo root (see §5).

---

## 2. Assembled structure

```
ai-accounting-platform/
├─ apps/
│  ├─ api/        NestJS modular monolith — 251 .ts src files, 30 SQL migrations, 11 test suites
│  └─ web/        Next.js App Router (static export) — 43 .tsx, 14 routes
├─ infra/         Dockerfile.api · Dockerfile.worker · Dockerfile.web · nginx.conf · docker-validate.sh
├─ .github/workflows/ci.yml   api · web · docker jobs (Postgres + Redis services)
├─ package.json · package-lock.json · pnpm-workspace.yaml   (npm workspaces; pnpm file vestigial)
├─ README.md · CONTRIBUTING.md · LICENSE · DEPLOYMENT.md
├─ docker-compose.yml   (db · redis · minio · migrate · api · worker · web)
├─ .gitignore · .env.example
```
~452 source/config files assembled (excluding `node_modules`, `dist`, `.next`).

---

## 3. Root-file audit — all present, none missing

| Required artifact | Status | Notes |
|---|---|---|
| `package.json` (root) | ✅ present | npm workspaces `apps/*`; orchestrates build/typecheck/lint/test/e2e |
| Workspace config | ✅ present | npm `workspaces` field (authoritative) + `pnpm-workspace.yaml` (vestigial) |
| `README.md` | ✅ present | quickstart + structure |
| CI config | ✅ present | `.github/workflows/ci.yml` |
| GitHub workflow | ✅ present | 3 jobs: `api` (typecheck/lint/build/test on PG+Redis), `web` (typecheck/lint/build), `docker` (`compose config`) |
| `LICENSE` | ✅ present | proprietary (`LicenseRef-Proprietary`) |
| `.gitignore` | ✅ present | excludes `node_modules`, `dist`, `.next`, `.env`*, logs |
| `.env.example` | ✅ present | documents every env var |
| `CONTRIBUTING.md` | ✅ present | bootstrap guide |

**No root files were missing** — the canonical zip already supplies all five requested artifacts (package.json, workspace config, README, CI, GitHub workflow) plus license/gitignore/env template. Nothing had to be generated from scratch.

---

## 4. Fix applied (portability, behavior-preserving)

**Defect:** `apps/api` `build` script ended with `mkdir -p … && cp …*.ttf …`, a POSIX-only command. It builds on Linux/CI/Docker but **fails on Windows `cmd.exe`** (npm's default shell on Windows) with "The syntax of the command is incorrect" — so the documented `npm run build` was not cross-platform.

**Fix:** replaced the inline shell with `node scripts/copy-fonts.js` ([apps/api/scripts/copy-fonts.js](apps/api/scripts/copy-fonts.js)) — a 15-line Node script that does the same `mkdir -p` + `*.ttf` copy via `fs`. Identical behavior on POSIX; now also works on Windows. No dependency, feature, or output change. The two Cyrillic fonts (`DejaVuSans.ttf`, `DejaVuSans-Bold.ttf`) are confirmed copied into `dist/`.

---

## 5. Verification results (this host: Windows 10, Node 24.15.0, npm 10.9.0)

| Gate | Command | Result |
|---|---|---|
| **Install** | `npm ci` (root) | ✅ 845 packages, lockfile in sync, 0 errors |
| **Build — api** | `tsc -p tsconfig.build.json` + fonts | ✅ `dist/main.js`, `dist/worker.js`, fonts copied |
| **Build — web** | `next build` | ✅ compiled, **14 static routes** prerendered |
| **Build — root** | `npm run build` | ✅ green end-to-end after §4 fix |
| **Tests** | `npm test` (jest) | ✅ **60/60 passed, 11 suites** |
| **Typecheck** | `npm run typecheck` | ✅ exit 0 (api + web) |
| **Lint** | `npm run lint` | ✅ "No ESLint warnings or errors" |
| **Docker compose** | `docker compose config` | ⏸ docker daemon unavailable on this host — covered by CI `docker` job |

> Note: the jest run emits non-fatal `ts-jest` TS151002 warnings (hybrid module kind / `isolatedModules`). Cosmetic only — all 60 tests pass.

---

## 6. Observations (not blocking; no change made)

- **Docs not foldered.** The 11 architecture docs + MASTER live as loose `.md` files at the repo root rather than under `docs/` as CLAUDE.md §4 describes. Left as-is to avoid churn; consider moving to `docs/` in a dedicated housekeeping commit.
- **`packages/` absent.** The CLAUDE.md canonical layout lists `packages/` (shared-kernel, contracts, etc.); the MVP keeps shared code inside `apps/api`. This matches the as-built state described in PROJECT_STATUS — not a regression.
- **Task zips remain at root.** `task0NN-*.zip` and per-task `.md` files are still present alongside the assembled tree. They are historical build artifacts; safe to archive once the tree is committed to git.
- **`pnpm-workspace.yaml` is vestigial** — the toolchain is npm (root `package-lock.json`, CI uses `npm ci`). Harmless; remove if pnpm is definitively not used.
- **Not yet a git repo.** Working tree is not under version control (`git status` → not a repository). First commit recommended (see §7).
- **`npm audit`:** 14 advisories (7 moderate, 7 high), predominantly Next.js server-runtime items. The frontend is a **static export with no Next server**, so these are outside the deployed attack surface (documented in TASK_018A §5). A scheduled Next 15 upgrade clears them.

---

## 7. Verdict

**REPOSITORY_READY = YES** for push and CI.

- Canonical structure assembled ✅
- All required root files present (none missing) ✅
- `npm install` / `npm run build` / `npm test` all green ✅ (build now cross-platform)
- Typecheck + lint clean ✅

**Recommended next steps (operational, outside this task's scope):**
1. `git init` → first commit of the assembled tree; add CODEOWNERS for ledger/RLS/tax paths.
2. Archive the `task0NN-*.zip` artifacts out of the working tree.
3. Run `docker compose up --build` once on a Docker host to exercise image builds.
4. Optionally relocate architecture docs into `docs/` and drop `pnpm-workspace.yaml`.

*Verification environment: Windows 10, Node 24.15.0, npm 10.9.0. CI target: Ubuntu + Node 20 + Postgres 16 + Redis 7.*
