# Module Communication Rules

Each folder here is a **bounded context** (Identity, Tenancy, MasterData, DocIntel,
Ledger, Tax, Invoicing, Reporting, Audit, Notification). The skeleton enforces:

## Public surface
- A context exposes ONLY: its `*.Module`, its `I<Context>Service` interface + DI token,
  and its **event contracts** — all re-exported from `modules/<name>/index.ts`.
- Everything in `domain/`, `infrastructure/`, `api/`, and the `*.service.ts` stub is **private**.

## How contexts talk
1. **Synchronous (in-process):** inject another context's service **by its token**, typed as
   `I<Context>Service`, imported from `modules/<name>` (the public index). Never construct or
   import another context's classes directly.
2. **Asynchronous (decoupled):** publish a `DomainEvent` via the `EVENT_BUS` port
   (shared-kernel). Subscribers react. Events are the only way Audit/Reporting/Notification
   learn about changes. (The outbox-backed bus is implemented in the platform task.)

## Hard rules
- ❌ No module imports another module's `domain/`, `infrastructure/`, `api/`, or stub service.
- ❌ No module touches another module's tables/data.
- ✅ Dependency direction: Identity/Tenancy underpin all → MasterData referenced →
  DocIntel proposes → Ledger is the source of truth → Tax/Reporting read it →
  Audit/Notification observe via events.
- ✅ Decomposition seams (later): DocIntel/AI, Reporting, Compliance extract first —
  they already talk via events + the public service interface, so callers don't change.

Boundaries are enforced by ESLint (`apps/api/.eslintrc.cjs`). A violation fails lint/CI.
