# TASK 002 — Modular Monolith Skeleton

**Type:** Architecture skeleton (production-ready scaffolding) · **Maps to:** Build Order step 2 (`CLAUDE.md` §14) · **Depends on:** Task 001 · **PR:** one scoped PR.
**Deliverable:** `task002-modular-monolith-skeleton.zip` → unzip into the repo root (populates `apps/api/`).

> **Scope:** the complete NestJS modular structure for the 10 MVP contexts, with module wiring, public-interface ports, event contracts, and ESLint-enforced boundaries. **No business logic, no entities, no database access** — `domain/` and `infrastructure/` are intentionally empty placeholders. 111 files.

---

## 0. Definition of Done

- [ ] 10 contexts created (identity, tenancy, masterdata, docintel, ledger, tax, invoicing, reporting, audit, notification), each with `domain/ application/ infrastructure/ api/ events/`.
- [ ] Each context exposes a single **public surface** via `modules/<name>/index.ts` (module + service interface + token + events) — internals private.
- [ ] `AppModule` imports the global `PlatformModule` + all 10 context modules; app boots.
- [ ] **Dependency boundaries enforced by ESLint** (`apps/api/.eslintrc.cjs`) — cross-module deep imports fail lint.
- [ ] `shared-kernel` provides type-only contracts (`DomainEvent`, `TenantContext`, `EventBus` port, `ApplicationService` marker).
- [ ] No entities, no DB access, no business logic, no secrets. `typecheck` + `lint` pass.

---

## 1. Folder Structure (generated)

```
apps/api/
├─ .eslintrc.cjs                      # dependency-boundary enforcement (module privacy)
└─ src/
   ├─ main.ts                         # minimal bootstrap (NestFactory + listen)
   ├─ app.module.ts                   # imports PlatformModule + all 10 contexts
   ├─ shared-kernel/                  # type/contract only — no logic, no entities
   │  ├─ domain-event.ts              # DomainEvent<TPayload> base contract
   │  ├─ tenant-context.ts            # TenantContext + TENANT_CONTEXT token
   │  ├─ event-bus.ts                 # EventBus port + EVENT_BUS token
   │  ├─ application-service.ts       # ApplicationService marker
   │  └─ index.ts
   ├─ platform/                       # global cross-cutting wiring (stubs only)
   │  ├─ platform.module.ts           # @Global — provides EVENT_BUS
   │  └─ event-bus.stub.ts            # NotImplementedEventBus (real one = platform task)
   └─ modules/
      ├─ README.md                    # module communication rules
      └─ <context>/                   # ×10, identical shape:
         ├─ <context>.module.ts       # @Module: controller + service(token→stub) + exports token
         ├─ index.ts                  # PUBLIC surface (module + service iface/token + events)
         ├─ domain/index.ts           # EMPTY placeholder (entities later) — no entities
         ├─ application/
         │  ├─ <context>.service.interface.ts   # I<Ctx>Service + <CTX>_SERVICE token (public)
         │  ├─ <context>.service.ts             # stub impl (PRIVATE; not exported)
         │  └─ index.ts                          # exports ONLY the interface + token
         ├─ infrastructure/index.ts   # EMPTY placeholder (no DB access)
         ├─ api/<context>.controller.ts          # empty controller (routes added later)
         └─ events/
            ├─ <context>.events.ts    # PUBLISHED event name contracts (stable names)
            └─ index.ts
```

---

## 2. Module Definitions

Every context is wired identically: the module declares its (empty) controller, **binds its service stub to a DI token**, and **exports only the token**.

```ts
@Module({
  controllers: [LedgerController],
  providers: [{ provide: LEDGER_SERVICE, useClass: LedgerService }],
  exports: [LEDGER_SERVICE],   // the ONLY thing other modules can inject
})
export class LedgerModule {}
```

- Provider stub (`LedgerService`) is **private** — not re-exported from the public index, so other modules can never import the implementation, only the token + interface.
- `PlatformModule` is `@Global()` and provides `EVENT_BUS` (stub) so every context can publish events once the bus is implemented.

**Context responsibilities (declared in each service interface's doc-comment):** identity (auth/roles), tenancy (tenants/companies), masterdata (counterparties/CoA/VAT codes), docintel (documents/extractions/suggestions), **ledger (immutable double-entry — system of record)**, tax (VAT/registers/return/export), invoicing (sales docs/numbering), reporting (read-model projections), audit (append-only log), notification (alerts/delivery).

---

## 3. Public Interfaces (the ports)

Each context's synchronous contract is an interface + DI token:

```ts
export interface ILedgerService extends ApplicationService {}   // operations added per feature task
export const LEDGER_SERVICE = Symbol('Ledger.Service');
```

- Interfaces are intentionally **empty markers** in the skeleton — operations are declared per feature task (no business API invented prematurely).
- Other modules depend on the **interface + token**, never the concrete class → swappable, testable, decomposition-ready.
- Re-exported from `modules/<name>/index.ts` together with the module and event contracts — that file **is** the context's API.

**Event contracts** (the async surface) are real and stable now, e.g. Ledger publishes `entry_posted`, `entry_reversed`, `period_opened`, `period_locked`; DocIntel publishes `document_received … suggestion_ready … feedback_recorded`. Payload *shapes* are finalized in each context's feature task.

---

## 4. Dependency Boundaries (enforced, not just documented)

`apps/api/.eslintrc.cjs` makes the rules **fail CI** if broken:
- A context is reachable **only** via `modules/<name>` (its public index).
- `domain/`, `infrastructure/`, `api/`, the `*.service.ts` stub, and the raw `*.service.interface.ts` are **private** to their module (cross-module deep imports are blocked by `no-restricted-imports` patterns + `import/no-restricted-paths` zones).
- A module may import its own internals freely (override for `src/modules/*/**`).

**Allowed dependency direction:** Identity/Tenancy underpin all → MasterData referenced → DocIntel proposes → **Ledger = source of truth** → Tax/Reporting read it → Audit/Notification observe via events. No cycles.

---

## 5. Module Communication Rules

(Full text in `apps/api/src/modules/README.md`.)
1. **Synchronous:** inject another context's service **by token**, typed as `I<Ctx>Service`, imported from `modules/<name>`. Never import/construct another context's classes.
2. **Asynchronous:** publish a `DomainEvent` via the `EVENT_BUS` port; Audit/Reporting/Notification react via subscriptions. Events are the only cross-context change notification.
3. **Hard rules:** no module touches another's tables; no deep imports; decomposition seams (DocIntel/AI, Reporting, Compliance) already speak via events + the public interface, so extraction needs no caller changes.

---

## 6. Intentionally Absent (later tasks)

- **Entities / value objects** → Task 003+ (`domain/` is empty now).
- **Database access / repositories / RLS** → Task 003 (`infrastructure/` is empty; no DB).
- **Service operations, controllers' routes, DTOs** → per feature task.
- **Real EventBus (transactional outbox)** → platform/outbox task (currently a throwing stub).
- **Compliance & Banking modules (🔵)** → Phase 2 (not part of the 10 MVP contexts).

---

## 7. Verification

1. Unzip into repo root; `pnpm install` (from Task 001) resolves.
2. `pnpm --filter @app/api typecheck` passes (empty stubs compile).
3. `pnpm --filter @app/api lint` passes; **a deliberate cross-module deep import fails lint** (proves boundaries).
4. App boots (`AppModule` wires PlatformModule + 10 contexts); calling the stub `EventBus` throws the explicit "not implemented" error (expected).
5. No entities, no DB, no secrets present.

---

## 8. PR & Handoff

- **One PR**, Conventional Commit: `feat(api): scaffold modular-monolith skeleton (10 bounded contexts)`.
- Safety-critical paths (`modules/ledger`, `modules/tax`) already exist as folders → CODEOWNERS review applies from now on.
- **Next:** **Task 003 — Tenancy + RLS** (data model + Row-Level Security + per-request `SET LOCAL` context wiring + release-blocking isolation tests), then Task 004 (immutable ledger + audit). Foundations before any data writes (`CLAUDE.md` §14).

*Skeleton only — folder structure, module definitions, dependency boundaries, public interfaces, communication rules. No business logic, no entities, no database access.*
