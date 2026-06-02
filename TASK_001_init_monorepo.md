# TASK 001 — Initialize the Monorepo

**Type:** Bootstrap (scaffolding only) · **Maps to:** Build Order step 1 (`CLAUDE.md` §14) · **PR:** one scoped PR.
**Grounded in:** `AI_ACCOUNTING_PLATFORM_MASTER_v1.md`, `CLAUDE.md`, `MONOREPO_STRUCTURE.md`.

> **Scope:** create the empty, installable, lint/typecheck-passing monorepo skeleton + workspace tooling + docs placement. **No business code, no domain logic, no DB, no framework features** — those start in Task 002+. Build **MVP (🟢)** workspaces only; Phase-2/3 (🔵) seams are left out until their phase.

---

## 0. Objective & Definition of Done

**Objective:** a clean monorepo where `install` resolves, the workspace graph builds, lint/format/typecheck run green on empty stubs, the docs + `CLAUDE.md` are in place, and CI/PR governance is wired — ready for Task 002 (NestJS modular-monolith skeleton).

**Done when (acceptance criteria):**
- [ ] Repo initialized; **`CLAUDE.md` at root**; `docs/` holds the MASTER + 11 architecture docs + `MONOREPO_STRUCTURE.md`.
- [ ] Workspace tooling configured (pnpm workspaces + Turborepo); `install` resolves with **zero feature dependencies** beyond the toolchain.
- [ ] All MVP apps/packages exist as **empty, named, buildable stubs** (no logic) and are linked in the workspace graph.
- [ ] `lint`, `format:check`, `typecheck` pass on the empty repo; Turbo pipeline runs.
- [ ] `.env.example` lists **variable names only** (no secrets, no values) — Invariant 10.
- [ ] `.gitignore`/`.dockerignore` exclude `node_modules`, build output, `.env`, Python venvs, Terraform state.
- [ ] `.github/` has CI skeleton, **CODEOWNERS** (safety-critical paths), and a **PR template carrying the §2 invariant checklist**.
- [ ] Conventional Commits enforced (commit-lint hook); pinned runtimes (`.nvmrc` / `.tool-versions`).
- [ ] No business code, no DB schema, no secrets, no production data anywhere.

**Out of scope (later tasks):** NestJS modules, RLS, ledger, auth, UI components, Python worker logic, migrations, infra apply, feature dependencies.

---

## 1. Folder Creation Plan

Create the MVP skeleton (empty dirs get a `.gitkeep`). Module *internals* and Phase-2/3 (🔵) folders are **not** created yet.

```
ai-accounting-platform/
├─ apps/
│  ├─ api/            (empty NestJS app stub — no modules yet)
│  ├─ web/            (empty Next.js app stub — shell scaffold only)
│  └─ workers/        (empty Python project stub — no workers yet)
├─ packages/
│  ├─ contracts/      design-tokens/      ui/
│  ├─ shared-kernel/  i18n/               formatting/
│  ├─ validators/     config/
│  └─ (each: src/ + manifest stubs only)
├─ docs/
│  ├─ AI_ACCOUNTING_PLATFORM_MASTER_v1.md
│  ├─ MONOREPO_STRUCTURE.md
│  ├─ architecture/   (01..11 source docs)
│  └─ adr/            (ADR-0000-template placeholder)
├─ infra/             (modules/ envs/ policy/ — empty placeholders, no resources)
├─ scripts/           (placeholders named in CLAUDE.md §14/§4 — empty)
├─ .github/           (workflows/ + CODEOWNERS + pull_request_template.md)
├─ CLAUDE.md
├─ README.md
└─ (root config files — see §4)
```

**Rules applied:** only 🟢 MVP folders; each bounded-context module folder inside `apps/api/src/modules/` is created in **Task 002**, not here; `docs/` is reference-only.

---

## 2. Package Creation Plan

Each entry = an empty, named, buildable workspace member (manifest + `src/` stub that exports nothing meaningful yet). **No logic.**

### Apps (deployable)
| Path | Name | Purpose (this task = stub only) | Build target |
|------|------|----------------------------------|--------------|
| `apps/api` | `@app/api` | NestJS modular monolith host (empty bootstrap entry, no modules) | Node service |
| `apps/web` | `@app/web` | Next.js frontend (App Router scaffold, no routes/logic) | Next app |
| `apps/workers` | `workers` (Python) | Python worker project (project skeleton, no workers) | Python (uv/poetry) |

### Packages (shared libraries — TypeScript)
| Path | Name | Purpose (declared now, filled later) |
|------|------|--------------------------------------|
| `packages/contracts` | `@pkg/contracts` | Shared api↔web types + event payload schemas (single source) |
| `packages/shared-kernel` | `@pkg/shared-kernel` | Money/Currency/Ids/Result/Error/TenantContext primitives |
| `packages/design-tokens` | `@pkg/design-tokens` | Design-system tokens (→ Tailwind preset; Figma parity) |
| `packages/ui` | `@pkg/ui` | React component library (primitive/pattern/domain/template) |
| `packages/i18n` | `@pkg/i18n` | bg/en message catalogs + ICU helpers |
| `packages/formatting` | `@pkg/formatting` | Intl money/date/number utils (EUR primary + BGN ref) |
| `packages/validators` | `@pkg/validators` | Deterministic validators (EIK/VIES/IBAN/sum/duplicate) |
| `packages/config` | `@pkg/config` | Shared eslint/tsconfig/prettier/tailwind presets |

**Notes:**
- Internal dependency direction (declared, even while empty): `ui` → `design-tokens`; `web` → `ui`, `contracts`, `i18n`, `formatting`; `api` → `contracts`, `shared-kernel`, `validators`; `formatting`/`validators` may use `shared-kernel`. **No cycles.**
- `apps/workers` is **not** an npm workspace member — it has its own Python manifest and is excluded from pnpm globs.
- Scope names: `@app/*` for deployables, `@pkg/*` for libraries (keeps boundaries obvious).

---

## 3. Dependency Plan

Install **only the toolchain + framework scaffolds** now. **Feature libraries are added in the slice that needs them** (token-efficient; avoids premature, unused installs). Names + purpose below; versions pinned via lockfile.

### Root (dev only — workspace toolchain)
| Dependency | Purpose |
|------------|---------|
| `pnpm` (packageManager) | workspace package manager |
| `turbo` | task pipeline / caching across workspaces |
| `typescript` | base compiler for all TS workspaces |
| `eslint` + `prettier` | lint + format (configs live in `@pkg/config`) |
| `@commitlint/*` + `husky` | enforce Conventional Commits (PR Rules §13) |
| `lint-staged` | pre-commit checks on staged files |

### apps/api (bootstrap subset)
| Dependency | Type | Purpose |
|------------|------|---------|
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-*` | runtime | NestJS app shell (empty bootstrap) |
| `@nestjs/cli` | dev | scaffolding/build |
| `reflect-metadata`, `rxjs` | runtime | NestJS peer requirements |
| *(deferred to later tasks)* | — | TypeORM/Prisma, BullMQ, auth, zod, pg driver, etc. |

### apps/web (bootstrap subset)
| Dependency | Type | Purpose |
|------------|------|---------|
| `next`, `react`, `react-dom` | runtime | Next.js App Router scaffold |
| `tailwindcss`, `postcss`, `autoprefixer` | dev | styling pipeline (consumes `@pkg/design-tokens` later) |
| *(deferred)* | — | TanStack Query/Table, react-hook-form, zod, next-intl — added in their slices |

### apps/workers (Python, separate)
| Dependency | Purpose |
|------------|---------|
| `uv` (or poetry) | Python env/dep management |
| `ruff` | lint/format |
| `pytest` | test runner (no tests yet) |
| *(deferred)* | queue client, AI/OCR SDK, etc. — added in Task 009 |

### Packages
- TS packages depend only on `typescript` + the shared `@pkg/config` presets at bootstrap; runtime libs added when implemented.

**Constraint:** no AI/OCR/cloud SDKs, no DB drivers, no feature UI libs installed in Task 001. Keep the dependency surface minimal until a slice requires it.

---

## 4. Workspace Configuration Plan

Create these config files; described as **settings to apply**, not literal contents (no code).

| File | Sets / declares |
|------|-----------------|
| `pnpm-workspace.yaml` | Workspace globs: `apps/*` and `packages/*` (excludes `apps/workers` — Python). |
| `package.json` (root) | `packageManager: pnpm`; private; root scripts that delegate to Turbo (`build`, `lint`, `format:check`, `typecheck`, `dev`, `test`); dev deps from §3. |
| `turbo.json` | Pipeline tasks `build / lint / typecheck / test / dev` with dependency wiring (`^build` ordering) + caching; no app logic. |
| `tsconfig.base.json` | Strict TS base (per `CLAUDE.md` §5); **path aliases** for `@pkg/*` and `@app/*`; each workspace extends it. |
| `@pkg/config` presets | Shared `eslint-config`, `prettier-config`, base `tsconfig`, `tailwind-preset` (referenced by apps/packages). |
| `.nvmrc` / `.tool-versions` | Pinned Node (+ pnpm) and Python versions. |
| `.gitignore` / `.dockerignore` | Ignore `node_modules`, build output, `.env*`, Python `.venv`, Terraform state/`.terraform`. |
| `.env.example` | **Variable NAMES only**, grouped by app, with comments — **no values, no secrets** (Invariant 10). |
| `.github/workflows/ci.yml` | Skeleton: install → `lint` → `typecheck` → `build` (placeholders for test/security stages added in Task 017). |
| `.github/CODEOWNERS` | Require human review on safety-critical paths (e.g. `apps/api/src/modules/ledger`, `**/rls-*`, `apps/api/src/modules/tax`). |
| `.github/pull_request_template.md` | Includes the **§2 invariant checklist** + "one vertical slice" + "tests included" reminders (PR Rules §13). |
| `commitlint` + `husky` hooks | Enforce Conventional Commits; run `lint-staged` pre-commit. |
| `README.md` | One-screen: what the repo is, how to install/run, link to `docs/` + `CLAUDE.md`. |

**Config principles:** TS strict on; path aliases match the `@pkg/@app` scopes; Turbo orchestrates; secrets never appear (only names in `.env.example`); Python tooling configured in `apps/workers` independently of pnpm.

---

## 5. Verification (no business code required)

1. `pnpm install` resolves cleanly; lockfile committed.
2. `pnpm turbo run build typecheck lint` passes across all stub workspaces.
3. `pnpm format:check` passes.
4. Workspace graph shows the declared `@pkg/@app` dependency edges with **no cycles**.
5. `apps/workers` Python env sets up; `ruff`/`pytest` run (no tests yet).
6. `CLAUDE.md` at root; `docs/` populated; `.env.example` has names only; CODEOWNERS + PR template present.
7. A test commit is rejected if it violates Conventional Commits (hook works).

---

## 6. PR & Handoff

- **One PR**, Conventional Commit: `chore(repo): initialize monorepo workspace and tooling`.
- PR description ticks the §0 acceptance criteria.
- **No business logic, no DB, no secrets, no infra applied.**
- **Next:** **Task 002 — modular-monolith skeleton** (create `apps/api/src/modules/<context>` folders + `shared-kernel`/`platform` scaffolding, still no domain logic), then Task 003 (tenancy + RLS) per `CLAUDE.md` §14.

*Bootstrap only — folders, packages, dependencies, and workspace configuration plans. No business code.*
