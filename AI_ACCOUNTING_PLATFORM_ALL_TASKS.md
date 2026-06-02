# AI Accounting Platform - Complete Implementation Tasks Master

## Completed
- TASK 001 Repository Bootstrap
- TASK 002 Modular Monolith Skeleton
- TASK 003 Multi-Tenancy + PostgreSQL RLS

## Remaining Build Tasks

### TASK 004 — Immutable Ledger + Append-Only Audit
Implement JournalEntry, JournalLine, double-entry accounting, immutable postings, reversing entries, append-only audit with hash chaining.

### TASK 005 — Authentication & Authorization
Login, Register, MFA, RBAC roles (Owner, Accountant, Employee, Approver, Admin).

### TASK 006 — Master Data
Companies, Counterparties, Chart of Accounts, VAT Codes, EIK/VIES validation.

### TASK 007 — Document Upload Center
PDF/JPG/JPEG/PNG/TIFF/XML upload, malware scan, immutable storage.

### TASK 008 — OCR & Extraction Pipeline
OCR processing, XML parsing, extraction confidence scoring.

### TASK 009 — Rules Engine MVP
VAT suggestions, posting suggestions, deterministic validation rules.

### TASK 010 — Review Queue
Approve / Reject / Correct workflow with audit trail.

### TASK 011 — Posting Workflow
Review → Approve → Journal Entry Creation.

### TASK 012 — VAT Module MVP
Purchase Register, Sales Register, VAT Return.

### TASK 013 — Invoice Issuance
Invoice numbering, PDF generation, email sending.

### TASK 014 — Reports
Trial Balance, General Ledger, VAT Reports, Profit & Loss.

### TASK 015 — Dashboard
Business dashboard, accountant dashboard, status widgets.

### TASK 016 — Production Infrastructure
AWS EU, PostgreSQL, Redis, monitoring, backups, restore testing.

### TASK 017 — End-to-End MVP Validation
Upload → OCR → Review → Posting → VAT → Reports.

### TASK 018 — Pilot Readiness
Customer onboarding, monitoring, support procedures.

---

## Mandatory Review After Every Task

Claude must provide:

1. What was implemented
2. Files created
3. Files modified
4. Database changes
5. Security review
6. Tests executed
7. Screenshots/UI preview
8. Known limitations
9. Next recommended task

---

## Deployment Targets

Frontend:
- Netlify or Vercel

Backend:
- AWS EU (Frankfurt)

Database:
- PostgreSQL (RDS)

Storage:
- S3 EU

Monitoring:
- CloudWatch / OpenTelemetry

---

## Final MVP Goal

Upload Document
→ OCR
→ Extraction
→ Review
→ Approval
→ Journal Entry
→ VAT Registers
→ Reports

Pilot-ready accounting SaaS for Bulgaria.
