# IMPLEMENTATION_TASKS_MASTER_v1.md

## Purpose
Master execution roadmap for the AI Accounting Platform.

Read before every task:
- AI_ACCOUNTING_PLATFORM_MASTER_v1.md
- CLAUDE.md
- MONOREPO_STRUCTURE.md

---

# TASK 001 — Repository Bootstrap
Goal: Initialize monorepo (pnpm, Turborepo, apps, packages, docs, infra, CI).
Status: Completed

# TASK 002 — Modular Monolith Skeleton
Goal: Create bounded contexts and module structure.
Status: Completed

# TASK 003 — Multi-Tenancy + PostgreSQL RLS
Goal: Tenant isolation, company context, RLS, fail-closed behavior.
Status: Completed

# TASK 004 — Immutable Ledger + Append-Only Audit
Goal: JournalEntry, JournalLine, double-entry, reversals only, audit chain.

# TASK 005 — Authentication & Authorization
Goal: Login, MFA, RBAC, roles.

# TASK 006 — Master Data
Goal: Companies, counterparties, chart of accounts, VAT codes.

# TASK 007 — Document Upload Center
Goal: Upload PDFs/images/XML, malware scan, immutable storage.

# TASK 008 — OCR & Extraction Pipeline
Goal: OCR, parsing, extraction, confidence scoring.

# TASK 009 — Rules Engine MVP
Goal: VAT suggestions, posting suggestions, deterministic validation.

# TASK 010 — Review Queue
Goal: Human approval workflow.

# TASK 011 — Posting Workflow
Goal: Review → Approve → Journal Entries.

# TASK 012 — VAT Module MVP
Goal: Purchase register, sales register, VAT return.

# TASK 013 — Invoice Issuance
Goal: Invoice numbering, PDF generation, email delivery.

# TASK 014 — Reports
Goal: Trial Balance, General Ledger, VAT reports, P&L.

# TASK 015 — Dashboard
Goal: Business and accountant dashboards.

# TASK 016 — Production Infrastructure
Goal: AWS EU, PostgreSQL, Redis, monitoring, backups.

# TASK 017 — End-to-End MVP Validation
Goal: Upload → OCR → Review → Posting → VAT → Reports.

# TASK 018 — Pilot Readiness
Goal: First customer rollout.

---

## IMPORTANT REVIEW RULE

After every task Claude must provide:

1. What was implemented
2. Files created
3. Files modified
4. Database changes
5. Security considerations
6. Tests executed
7. Screenshots or UI preview (if applicable)
8. Known limitations
9. Next recommended task

---

## Deployment Goal

When MVP tasks are complete:

- Build production frontend
- Deploy frontend (Netlify or Vercel)
- Deploy backend (AWS EU)
- Deploy PostgreSQL
- Configure storage
- Configure monitoring
- Run E2E validation
- Launch pilot customers
