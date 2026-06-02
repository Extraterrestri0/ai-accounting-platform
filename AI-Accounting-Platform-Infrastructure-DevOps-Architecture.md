# AI Accounting Platform — Complete Infrastructure & DevOps Architecture

**Document type:** Infrastructure & DevOps architecture (conceptual — no code/IaC)
**Builds on:** the nine prior architecture documents (v1.0)
**Acting as:** Principal Cloud Architect · Senior DevOps Architect · Senior Security Architect · Senior SaaS Infrastructure Architect
**Status:** v1.0 — infrastructure baseline

---

## Non-negotiable requirements (carried through every section)

- **All infrastructure EU-based** (data, processing, backups, logs, AI/OCR endpoints).
- **PostgreSQL with Row-Level Security**; **object storage with immutability / object-lock (WORM)**.
- **Queue workers scale independently**; **AI/OCR stays EU + zero-retention**.
- **Secrets never in code**; **production data never copied unmasked** to dev/staging.
- **Backups encrypted and restore-tested**; **logs contain no sensitive PII**.
- **Modular monolith first**, with **future extraction of AI, Reporting, and Compliance services** preserved.

---

## 1. Cloud Architecture Overview

### 1.1 Principles
1. **EU-resident, sovereignty-aware.** Every byte of customer data and every processing step lives in the EU; the design minimizes non-EU exposure and keeps an upgrade path to an EU-sovereign provider.
2. **Managed-first for MVP velocity.** A small team ships a compliant fintech product faster and more safely on managed primitives (Postgres, object storage, Redis, KMS, secrets, OCR) than on self-managed infrastructure.
3. **Cloud-portable by design.** We standardize on **portable primitives** — containers, PostgreSQL, S3-compatible storage, Redis, OpenTelemetry — so the platform can migrate to a sovereign/cheaper EU cloud later without rewrites.
4. **Modular monolith first, decomposable later.** One application deployment + **independently scalable worker fleets**; AI/Reporting/Compliance are pre-drawn extraction seams.
5. **Zero-trust + least privilege + defense in depth.** Private networking, scoped identities, encryption everywhere, RLS as the data backstop, immutable infra, everything audited.
6. **Everything as code + observable.** IaC for all infrastructure; metrics/logs/traces from day one; PII-safe logs distinct from the immutable audit trail.

### 1.2 Topology (logical)
```
            Internet ──▶ [CDN/WAF/DDoS, EU edge] ──▶ [Load balancer]
                                                          │ (private)
   ┌──────────────────────────────────────────────────────────────────┐
   │ PRIVATE NETWORK (EU region, multi-AZ)                              │
   │  App tier (modular monolith, containers, autoscaled, stateless)    │
   │  Worker fleets (independent): OCR · AI · reports · SAF-T · submit · │
   │       bank-import · notifications · indexer  (queue-depth scaled)   │
   │  ── data subnets (no public ingress) ──                            │
   │  PostgreSQL (managed, RLS, multi-AZ, replicas, pgvector)           │
   │  Redis (managed, HA) + queues                                       │
   │  Object storage (S3-compatible, EU, object-lock, SSE-KMS)          │
   │  Search (PG FTS → OpenSearch EU)                                   │
   │  KMS · Secrets manager · Vault                                     │
   └───────────────┬───────────────────────────────────────────────────┘
                   │ controlled egress (EU endpoints only)
        External (EU/zero-retention): OCR/Document-AI · LLM endpoints
        External (via ACLs): NRA/НАП · KEP/QTSP · banks/PSD2 · VIES · email
```

---

## 2. EU Hosting Strategy & Cloud Provider Choice

### 2.1 Residency & sovereignty posture
- **Region:** a single EU region close to Bulgaria for latency — **Frankfurt (central EU)** as primary, with multi-AZ for HA.
- **Data residency:** all primary data, replicas, backups, object storage, search/vector indices, logs, and AI/OCR endpoints are **pinned to EU regions**; **egress controls** prevent data leaving the EU boundary.
- **Sovereignty mitigations** (for US-parented hyperscalers): EU-region-only data, **SCCs + EU adequacy/DPF** where applicable, **EU-resident OCR + zero-retention LLM endpoints**, KMS keys in-region (customer-managed where warranted), and a **portable design** enabling migration to an EU-sovereign provider if customer/regulatory demand hardens.

### 2.2 Provider comparison

| Provider | Managed services breadth | PostgreSQL+RLS | Object-lock (WORM) | EU OCR/Doc-AI | Sovereignty | Cost (MVP) | MVP fit |
|----------|--------------------------|----------------|--------------------|---------------|-------------|-----------|---------|
| **AWS EU** (Frankfurt) | **Widest** (RDS/Aurora, S3, SQS, ElastiCache, ECS/EKS, KMS, Secrets Mgr, OpenSearch, WAF/Shield, GuardDuty) | ✓ | **S3 Object Lock (gold standard)** | Textract (EU) | US-parented; EU regions + (emerging) EU Sovereign Cloud | Medium | **Strong** |
| **Azure EU** | Wide (PG Flexible Server, Blob immutability, Service Bus, Cache, AKS/Container Apps, Key Vault, Sentinel, WAF) | ✓ | ✓ (immutable Blob WORM) | **Document Intelligence (excellent, EU)** | US-parented; strong EU programs | Medium | **Strong** |
| **Google Cloud EU** | Wide (Cloud SQL/AlloyDB, GCS bucket-lock, Pub/Sub, Memorystore, GKE/Cloud Run, KMS, Secret Mgr, Cloud Armor) | ✓ | ✓ (bucket lock) | Document AI (EU) | US-parented | Medium | Strong |
| **Hetzner + managed** | IaaS-centric (servers, S3-compatible storage, LBs); managed PG/Redis limited → self-manage or 3rd-party | ✓ (self/3rd-party) | depends (verify object-lock) | none native → use EU vendor | **EU-owned, cheap** | **Lowest** | Ops-heavy |
| **EU sovereign** (OVHcloud, Scaleway, STACKIT, IONOS …) | Growing (managed PG, S3-compatible, Redis, K8s, KMS) | ✓ | provider-dependent (verify) | limited → use EU vendor | **Highest (EU-owned/operated)** | Low–Medium | Sovereignty-first |

### 2.3 Recommendation for MVP: **AWS in an EU region (Frankfurt)** — with Azure EU the co-leading alternative

**Choose AWS EU (eu-central-1, Frankfurt) for MVP.** Reasoning:

1. **Cleanest satisfaction of the hard requirements out of the box:** **S3 Object Lock** is the gold-standard WORM/immutability for our immutable originals, signed artifacts, and SAF-T files (a direct hard requirement); **RDS/Aurora PostgreSQL** supports RLS natively; managed **Redis, queues, KMS, Secrets Manager, OpenSearch, WAF/Shield/GuardDuty** cover the rest with minimal ops.
2. **Velocity + security maturity** for a small team building a compliant fintech product — the broadest managed ecosystem and the strongest compliance certifications, in an EU region near Bulgaria.
3. **EU-resident AI path:** OCR via an EU-region document-AI service and **zero-retention LLM endpoints** (EU) regardless of base cloud.
4. **Portability preserved:** containers + PostgreSQL + S3-compatible storage + Redis + OpenTelemetry mean we can migrate to a sovereign/cheaper EU provider later if needed.

**Honest alternatives and when to pick them:**
- **Azure EU** is co-equal and arguably **better if we lean on Azure Document Intelligence** for OCR/invoice extraction (best-in-class) — its immutable Blob storage + Key Vault + PG Flexible Server are excellent. A very defensible alternative; choose it if the team is Azure-strong or the OCR quality tips the balance.
- **EU-sovereign (OVHcloud/Scaleway/STACKIT/IONOS) or an AWS/Azure EU-sovereign offering** if **data sovereignty is a hard customer/regulatory requirement** (plausible for a tax platform integrating with НАП) — accept thinner managed-AI ecosystems (call EU AI vendors separately) and slightly more ops.
- **Hetzner + managed** if **cost is the dominant constraint** and the team has ops capacity — dramatically cheaper, EU-owned, but you self-manage Postgres/Redis (or use a managed-DB partner) and must verify object-lock support.

**Net:** **AWS EU (Frankfurt) for MVP**, portable by design, with a documented path to EU-sovereign hosting as scale/sovereignty demands grow. The architecture below names AWS-equivalent services but is written cloud-portably.

---

## 3. Environment Strategy

- **Environments:** **dev → staging → production**, plus optional **ephemeral preview** environments per pull request and a **demo/sandbox** tenant. Each is **fully isolated** (separate networks, databases, buckets, secrets, keys) — no shared state across environments.
- **Production data protection (hard requirement):** **production data is never copied unmasked** to lower environments. Lower envs use **synthetic or anonymized/pseudonymized** datasets; any rare prod-derived data is irreversibly masked (PII removed/tokenized) before leaving prod, under a controlled, audited process.
- **Config & secrets per environment:** environment-specific configuration via the secrets manager / parameter store; **no secrets in code or images**; least-privilege service identities per environment.
- **Parity:** staging mirrors production topology (same managed services, RLS, queues, object-lock) so tests are representative; preview envs are lighter but functionally faithful.
- **Promotion:** code promotes through environments via CI/CD with gated approvals; infrastructure changes promote via IaC with plan/review.
- **Access:** production access is least-privilege, audited, and break-glass-controlled; developers do not have standing prod data access.

---

## 4. Network Architecture

- **VPC with tiered subnets:** **public** (load balancer/NAT only), **private app** (containers/workers — no public IPs), **private data** (PostgreSQL, Redis, search — no internet ingress or egress except controlled). Multi-AZ across the EU region.
- **No public data stores:** databases, caches, queues, and storage are reachable only from private subnets; **object storage has no public buckets** (access via signed URLs through the app).
- **Ingress:** internet → **CDN/WAF/DDoS edge** → **load balancer** → app tier; TLS terminated at the edge/LB; everything internal over private networking (mTLS where warranted).
- **Egress control:** outbound traffic restricted to **approved EU endpoints** (OCR/LLM vendors, NRA/КЕП/bank/VIES via ACLs, email) through NAT + egress allowlists; **no uncontrolled internet egress** from data/worker tiers — a key control for the "AI stays EU/zero-retention" and "data stays in EU" requirements.
- **Administrative access:** no standing SSH; access via a bastion/SSM-style session manager, MFA-gated, time-boxed, and audited; immutable infrastructure (rebuild, don't log in).
- **Service connectivity:** in-monolith calls are in-process; worker↔queue↔DB over private networking; future extracted services communicate over the private network/event bus (service mesh introduced if/when decomposed).
- **DNS & certificates:** managed DNS (EU), automated TLS certificate issuance/rotation, HSTS.
ENDOFDOC
echo "part1 done"; wc -l /home/claude/infra-devops.md
---

## 5. Application Deployment Architecture

- **Containers + managed orchestration.** The modular monolith and each worker fleet are **containerized**; run on a managed container platform (e.g. ECS Fargate for serverless-container simplicity at MVP, or EKS/Kubernetes if richer orchestration is needed). Cloud-portable (containers run anywhere).
- **One app service, many worker services.** The **modular monolith deploys as a single service** (autoscaled, stateless); the **OCR, AI, report, SAF-T, submission, bank-import, notification, and indexer workers deploy as separate services** that **scale independently on queue depth** (hard requirement) — a slow SAF-T build never starves OCR.
- **Stateless app tier:** no local session/state (state in PG/Redis/object storage), enabling horizontal scale and zero-downtime deploys.
- **Deployment strategy:** **blue/green or rolling** with health checks and automatic rollback; the app deploys as one unit; workers roll independently.
- **Autoscaling:** app tier on CPU/RPS/latency; each worker fleet on its queue depth/age; min/max bounds; scale-to-low off-peak.
- **Decomposition path:** **AI/DocIntel, Reporting, and Compliance** are the first services to extract — they already communicate via events/contracts, so each becomes an additional deployed service consuming the same queue/event bus with **no caller changes**.
- **Capability-scoped runtime identities:** workers run under **least-privilege identities** — notably the **AI/OCR workers have no permission to call privileged commit paths** (ledger/NAP/KEP/permissions), enforcing the AI-exclusion guarantee at the infrastructure identity layer.

## 6. Database Architecture

- **Managed PostgreSQL** (RDS/Aurora-class), **multi-AZ** for HA with automatic failover; **read replicas** for reporting/dashboards/projection reads (isolating them from the write path).
- **Connection pooling** (RDS Proxy / PgBouncer) sized for the container fleet — critical for many small connections and for RLS context handling (Section 7).
- **Partitioning** for high-volume append-only tables (journal lines, bank transactions, audit events, domain events, notifications) by **time/period + tenant**; hot/cold tiering; old partitions archivable.
- **pgvector** extension for AI retrieval embeddings (MVP), tenant-partitioned.
- **Performance:** composite indexes leading with `tenant_id`/`company_id` + date/status; query insights/slow-log monitoring; parameter groups tuned for OLTP + the append-heavy ledger.
- **Upgrades & maintenance:** managed minor patching in maintenance windows; major upgrades rehearsed in staging; storage autoscaling.
- **Large-tenant promotion:** the `tenant.placement` attribute allows a large firm to be moved to a **dedicated database instance/cluster** (or stricter residency) without schema change.

## 7. PostgreSQL RLS Deployment Considerations

RLS is the **guaranteed tenant-isolation backstop** — but it interacts subtly with pooled connections, so the operational design is explicit.

- **Policies on every tenant-scoped table** keyed on `tenant_id` (and `company_id`), restricting reads/writes to rows matching the **current request's tenant context**.
- **Setting context safely with pooling:** the app sets the tenant/company context on the connection **per request/transaction** using **transaction-scoped settings (`SET LOCAL`)** inside an explicit transaction, **never session-level `SET`** on a pooled connection (which would leak across requests). With **transaction-pooling proxies**, context is bound to the transaction and reset at commit — no cross-request bleed.
- **Application role vs RLS:** the app connects as a **non-superuser role subject to RLS** (RLS does not apply to table owners/superusers). The application database role is **never a bypass role**.
- **Bypass isolation:** any maintenance/migration/analytics role that can bypass RLS is **separate, tightly restricted, audited, and never used by the application path**.
- **Workers too:** background jobs **re-apply the tenant context** from the job payload before any query (jobs are RLS-scoped exactly like requests).
- **Connection hygiene:** pool returns reset context; health checks verify no lingering context; a "no tenant context set" condition **fails closed** (deny) rather than open.
- **Testing in CI:** automated tests run **with RLS active** and assert that no query/endpoint/job can read or write across tenants, including attempts to forge `tenant_id` — a failure is a release-blocking sev-1.

## 8. Redis & Queue Infrastructure

- **Managed Redis** (ElastiCache-class), **HA (replica + automatic failover)**, EU region, encrypted at rest + in transit, private-subnet only.
- **Uses:** application cache (reference/master data, permission decisions with short TTL + event invalidation), session/coordination state, and the **job queues**.
- **Queues:** **BullMQ on Redis** (matching the NestJS choice) — **separate queues per worker class** (OCR, AI, reports, SAF-T, submissions, bank-import, notifications, indexer) so each scales/limits independently; (managed **SQS** is a viable alternative if decoupling from Redis is preferred).
- **Reliability:** retries with backoff, **dead-letter queues**, visibility timeouts, idempotency keys (no double effects), per-tenant fairness, priority lanes (critical submission/sign-prep > interactive OCR > bulk reports).
- **Scaling:** worker fleets autoscale on **queue depth/age**; Redis scaled vertically + replicas; eviction policy tuned so cache pressure never drops queue data (or queues use a separate Redis/SQS to isolate durability from cache).

## 9. Object Storage Architecture

- **S3-compatible storage, EU region**, for all binaries: **immutable original documents**, generated invoice PDFs, **signed submission artifacts**, **SAF-T files**, exports.
- **Immutability (hard requirement):** **Object Lock / WORM** (compliance mode) + **versioning** on buckets holding originals and signed/submitted artifacts — never overwritten or deleted before retention expiry; new versions are new objects (mirrors `DocumentVersion`).
- **Encryption:** **SSE-KMS** at rest + TLS in transit; per-tenant key scoping where warranted.
- **Access:** **no public buckets**; the app issues **short-lived, scoped signed URLs**; access logged; **tenant-namespaced key prefixes**; **no PII in object keys**.
- **Lifecycle/tiering:** hot for recent → cold/archive for closed years; **disposition only when the retention schedule allows and no legal hold** (GDPR vs statutory reconciliation).
- **Integrity:** content hashes stored in PG (dedup + tamper detection); artifact hashes referenced by signatures/audit.
- **Quarantine bucket** for unscanned/suspicious uploads (Section 10), isolated from processing buckets.

## 10. File Security & Malware Scanning

- **Scan-before-process pipeline:** uploads land in a **quarantine bucket**; a **malware-scan worker** (e.g. ClamAV-based or a managed scanning service, EU) scans on ingest; **only clean files** are promoted to processing buckets and enqueued for OCR/extraction.
- **Sandboxed parsing:** document parsing (PDF/XML/ZIP/image) runs in **isolated, least-privilege workers**; defenses against **XXE (XML external entities), ZIP bombs, and malicious macros**; resource limits prevent decompression/parser abuse.
- **Untrusted by default:** all file content is untrusted — never executed, never treated as instructions (ties to the AI prompt-injection defense).
- **Access:** files served only via signed URLs; the document **viewer renders in a sandbox**; image/PDF proxied to avoid SSRF and to apply signed access.
- **Auditing:** scan results and quarantine actions logged; infected files blocked, quarantined, and the user notified.

## 11. AI / OCR Worker Infrastructure

- **Dedicated worker fleet**, separate from the app and from each other, **autoscaled on queue depth**, EU region.
- **Compute:** mostly **CPU workers calling EU AI/OCR endpoints** (vendor APIs do the heavy ML); GPU only if/when self-hosted models are introduced for sensitive/cost-sensitive tasks.
- **EU + zero-retention (hard requirement):** all model/OCR calls go to **EU-region endpoints under zero-retention / no-training contracts**; **egress allowlist** restricts these workers to approved EU AI endpoints only — uncontrolled egress is blocked, enforcing residency at the network layer.
- **Capability isolation:** workers run under an **identity that can read scoped documents and write extraction/suggestion data only** — **no permission to post to the ledger, file to NAP, sign with KEP, or change permissions** (the AI-exclusion guarantee enforced by IAM, not just code).
- **Tenant context** re-applied per job (RLS-scoped); **API keys** for AI vendors held in the secrets manager, rotated, never in code/images.
- **Resilience:** retries/backoff; vendor-outage handling (queue + flag, never block capture); per-tenant cost metering tied to billing; full tracing of model/prompt versions for audit.

## 12. Vector Store Infrastructure

- **MVP: pgvector inside the managed PostgreSQL** — fewer moving parts, same RLS/backup/residency guarantees, **tenant-partitioned** retrieval.
- **Scale-out:** a dedicated **EU-resident vector database** later if volume/latency demands; still tenant-partitioned, EU-only, encrypted.
- **Isolation (critical):** vectors are **partitioned by `tenant_id`**; retrieval can never reach another tenant's embeddings (the AI-doc requirement enforced operationally) — a cross-tenant retrieval is a sev-1.
- **Embeddings** generated via EU/zero-retention endpoints; the **tax knowledge base** (shared, non-sensitive) is a separate, read-only corpus from per-tenant company data.

## 13. Search Infrastructure

- **MVP: PostgreSQL full-text search** — adequate for documents/counterparties/invoices, one fewer dependency, inherits RLS/backups/residency, **tenant-scoped**.
- **Scale-out: managed OpenSearch/Elasticsearch (EU)** when relevance/volume demands; **tenant-partitioned indices**; populated by the **indexer worker** subscribing to domain events; encrypted, private-subnet.
- **Dedup fingerprints** (content hash + fuzzy match) support duplicate detection.
- **Isolation:** every search/index operation is tenant-scoped at the index/partition level — cross-tenant hits are sev-1.

---

## 14. Secrets Management

- **Central secrets manager / vault** (AWS Secrets Manager or HashiCorp Vault) — **no secrets in code, repos, images, or env files** (hard requirement); CI injects secrets at deploy/run time only.
- **Scope:** per-environment and per-service secrets; least-privilege access via service identities; **dynamic database credentials** (short-lived, rotated) where supported.
- **Rotation:** automated rotation for DB credentials, API keys (AI/OCR vendors, email, bank/NRA/KEP integration credentials), and signing/JWT keys; rotation events audited.
- **Distribution:** secrets fetched at runtime via the service identity (no baking into images); cached in memory only, never written to disk/logs.
- **Detection:** **secret-scanning in CI** (pre-commit + pipeline) blocks accidental commits; alerts on leaked-credential patterns.
- **KEP private keys are never stored** — signing happens in the holder's/QTSP's secure environment (the platform holds only signature evidence).

## 15. KMS & Encryption

- **KMS** for envelope encryption; keys **EU-region**, customer-managed where warranted; **automatic key rotation**; key usage audited.
- **At rest:** PostgreSQL, replicas, **backups**, Redis, object storage (SSE-KMS), search/vector — all encrypted; **field-level encryption** for the most sensitive identifiers.
- **In transit:** TLS everywhere (edge, internal, DB, storage); mTLS for service-to-service where warranted; HSTS.
- **Per-tenant key scoping** for object storage / sensitive fields where the threat model warrants; **large-tenant dedicated keys** as an option.
- **Key access control:** strict IAM on KMS; separation of duties (those who manage keys ≠ those who access plaintext); break-glass procedures audited.

## 16. CI/CD Pipeline

- **Pipeline stages:** commit → **build** → **test** (unit/integration/contract, **RLS-isolation tests**, a11y, **AI eval gates**) → **security scans** (SAST, dependency/SCA, **secret scan**, container image scan) → **build signed image** → push to **private registry (EU)** → deploy **staging** → automated/e2e checks → **gated approval** → deploy **production** (blue/green) → post-deploy verification → auto-rollback on failure.
- **Monorepo/polyrepo:** NestJS app, Python workers, and the Next.js frontend build via shared pipelines with affected-only builds; **shared contract types** validated for drift (release-blocking).
- **Database migrations:** run as a **controlled, ordered pipeline step** using the **expand/contract** pattern (backward-compatible migrations decoupled from code deploy) so deploys are zero-downtime; **RLS policies are part of the migration set** and tested.
- **Supply chain:** **signed container images**, **SBOM** generation, provenance attestation, pinned base images, no `latest` tags.
- **Promotion & approvals:** environment-gated; production requires approval + green checks; change recorded for audit.
- **Rollback:** image + migration rollback strategy (contract-phase reversible); feature flags decouple release from deploy.

## 17. Infrastructure as Code

- **All infrastructure as code** — **Terraform/OpenTofu** (or Pulumi) — networks, clusters, databases, storage, queues, KMS, secrets, monitoring, IAM; no click-ops.
- **Modular & environment-parameterized:** reusable modules; environments as **workspaces/stacks** (dev/staging/prod) from the same modules → parity.
- **State management:** **remote, encrypted, locked state** (EU); least-privilege state access; no state in repos.
- **Policy-as-code:** **OPA/Sentinel-style guardrails** enforce org rules in CI (e.g. no public buckets, encryption required, EU-region only, no unencrypted volumes, mandatory tags) — **residency and security are enforced by policy, not convention**.
- **Drift detection** + reconciliation; **GitOps** review for all infra changes (plan → review → apply via pipeline).
- **Immutable infrastructure:** rebuild over mutate; no manual changes in production.

## 18. Monitoring & Observability

- **Telemetry standard:** **OpenTelemetry** across app + workers (portable, vendor-neutral); backend a managed EU observability stack or self-hosted **Prometheus/Grafana + Tempo/Jaeger**.
- **Metrics:** infra (CPU/mem/IO), app (latency/RPS/error rate per module), **queue depth/age per worker class**, DB (connections/replication lag/slow queries), cache hit rate, and **business/AI** metrics (documents processed, suggestion acceptance, filings, per-tenant cost/usage).
- **Tracing:** distributed traces with a **correlation id** spanning API → events → workers → DB → vendor calls — one user action traceable end-to-end.
- **Dashboards:** ops health, **AI quality** (acceptance/override/hallucination/calibration), **compliance pipeline** (returns due/filed/failed), **tenant usage/cost**, and security.
- **SLOs** with error budgets; **synthetic checks** on critical journeys (login, upload→review, filing) and external dependency health (NRA/KEP/bank/VIES).
- **Distinct from the audit trail:** observability is operational/ephemeral; the **audit trail is immutable evidence** (never conflated).

## 19. Logging

- **Centralized, structured (JSON) logging** in the EU, with a **correlation id** propagated everywhere; tenant id logged for scoping.
- **PII-free (hard requirement):** **no sensitive personal data in logs** — PII is **redacted/tokenized** at the logging layer; financial identifiers, document contents, credentials, and tokens are never logged; redaction is tested.
- **Levels & sampling:** sensible levels; high-volume debug sampled; security/audit-relevant events always captured (to the audit trail, separately).
- **Retention & access:** log retention aligned to operational need and policy (shorter than statutory record retention); **access-controlled** and audited; logs are not the system of record.
- **Separation:** operational logs ≠ the **append-only, hash-chained audit trail** (which holds the who/what/when evidence and lives in Postgres/immutable storage).

## 20. Alerting

- **Alert sources:** SLO/error-budget burn, error-rate/latency spikes, **queue depth/age** (backlog), DB replication lag/connection exhaustion, **security signals** (cross-tenant guard trips, injection attempts, auth anomalies, WAF blocks), **cost anomalies**, failed backups, expiring certificates/KEP certs, external-dependency outages (NRA/KEP/bank/VIES).
- **Routing:** severity-tiered, deduplicated, routed to an **on-call rotation** with escalation policies; sev-1 pages immediately.
- **Runbooks:** every actionable alert links to a runbook (diagnosis + remediation).
- **Noise control:** thresholds tuned, flapping suppressed, business-hours vs urgent distinction.
- **Compliance-aware alerts:** filing-deadline pipeline failures and submission failures are first-class (a missed NAP filing is a customer-impacting event).

---

## 21. Backup & Restore

- **What's backed up:** PostgreSQL (automated snapshots + **point-in-time recovery / WAL**), object storage (**versioning + cross-AZ/region EU replication**), search/vector (rebuildable from events + periodic snapshots), configuration/secrets metadata, and the **audit/event log** (treated as critical).
- **Encryption (hard requirement):** all backups **encrypted** (KMS); stored **EU-only**; access tightly controlled and audited.
- **Restore-tested (hard requirement):** **scheduled restore drills** validate that backups actually restore within RPO/RTO (a backup is not "real" until a restore has succeeded); drills documented; failures block release readiness.
- **RPO/RTO:** defined targets (e.g. low-minutes RPO via PITR; RTO per service criticality); ledger/audit data prioritized.
- **Immutability:** backups of immutable data retain WORM properties; ransomware resilience via versioning + isolated backup accounts/keys.
- **Retention:** backup retention aligned to operational + statutory needs; **disposition reconciled with retention policy and legal holds** (no premature deletion of records under hold).

## 22. Disaster Recovery

- **HA first:** **multi-AZ** for DB, cache, and app/workers within the EU region → automatic failover for common failures.
- **DR posture:** **cross-region EU DR** (warm standby / restore-to-second-EU-region) for region-level disasters; data replicated EU→EU only.
- **RPO/RTO targets** documented per tier; ledger, audit, and compliance data have the tightest targets.
- **Runbooks + drills:** documented failover/restore runbooks; **periodic DR exercises** (game days) verify RTO and team readiness.
- **External dependencies:** NRA/KEP/bank/VIES outages handled by graceful degradation (queue + flag, retry) — the platform's core capture/processing keeps working; submissions resume when the channel returns.
- **Statefulness:** because reads are **rebuildable projections** over an append-only event log, read models can be **reconstructed** after recovery — a strong resilience property.

## 23. Security Hardening

- **Defense in depth + zero trust:** network segmentation (Section 4), least-privilege IAM, RLS data backstop, encryption everywhere, immutable infra.
- **IAM:** least-privilege service identities; **no standing human prod access** (break-glass, MFA, time-boxed, audited); separation of duties; **AI/OCR identities cannot reach privileged commit paths**.
- **Host/image hardening:** minimal hardened base images, no shells where avoidable, **no SSH** (session-manager only), CIS-benchmark alignment, automated patching, **vulnerability scanning** (images + dependencies) with remediation SLAs.
- **Supply chain:** signed images, SBOMs, pinned dependencies, secret scanning, provenance.
- **Application security:** OWASP Top 10 coverage, parameterized queries, input validation, output encoding, sandboxed file parsing, **document-borne prompt-injection defenses** (content is data, not instructions).
- **Testing:** SAST/DAST in CI; periodic **penetration tests** and security reviews; **tenant-isolation tests** as release gates.
- **ISO 27001-ready** controls and documentation; audited everything sensitive.

## 24. WAF & DDoS Protection

- **WAF** at the edge: managed rule sets (OWASP) + custom rules (rate limits, geo/bot rules, payload limits), tuned to reduce false positives on legitimate upload/AI traffic.
- **DDoS protection:** provider DDoS service (Shield/Cloud Armor-class) at L3/4 and L7; autoscaling absorbs bursts; rate limiting and connection caps protect upload and AI endpoints (cost + abuse control).
- **Bot/abuse protection:** challenge suspicious traffic; protect auth endpoints (credential stuffing) and signup; **never use CAPTCHAs that block legitimate accountants unnecessarily** — risk-based.
- **Edge/CDN (EU):** static assets and API edge caching where safe (never authed data); TLS termination + modern ciphers; HSTS.
- **Per-tenant rate limiting / fairness** so one tenant can't degrade others.

## 25. GDPR & Data Residency

- **EU-only everything:** data, replicas, backups, object storage, search/vector indices, logs, and **AI/OCR endpoints** — **region-pinned and policy-enforced** (IaC policy-as-code blocks non-EU resources; egress allowlists block non-EU data flows).
- **Sub-processors:** DPAs with all (cloud, AI/OCR, email, etc.) on **zero-retention/no-training** terms; a maintained **records-of-processing** and sub-processor register.
- **Data subject rights (operational):** export and **erasure** executed via controlled jobs, **reconciled with statutory retention + legal holds** — where deletion is legally barred (tax records), **anonymization/partial erasure** is applied and documented; erasure scope includes backups (via crypto-erase/key destruction where full deletion isn't feasible), learned profiles, and embeddings.
- **Minimization:** only necessary data sent to AI vendors; redaction where possible; PII mapped (domain model) for targeted handling.
- **Breach readiness:** detection → assessment → **GDPR 72-hour notification** process; audit trail supports forensics; DPIA maintained for high-risk processing (AI on financial/personal data).
- **Sovereignty path:** documented migration route to an EU-sovereign provider if customer/regulatory requirements harden.

## 26. Multi-Tenant Isolation Operations

Isolation is enforced and **operationally verified** across every layer, not assumed.

- **Data layer:** **RLS active in production** with the connection-context discipline of Section 7; the application role is never a bypass role; bypass roles isolated/audited.
- **Everywhere else:** tenant context carried onto **jobs, events, logs, object-storage key prefixes, search indices, vector partitions, and cache keys** — isolation holds beyond Postgres.
- **Monitoring:** **cross-tenant access detection** (a query/retrieval/storage access crossing `tenant_id`) raises a **sev-1**; anomaly detection on tenant-context handling.
- **CI gates:** automated **tenant-isolation tests** (including forged-`tenant_id` and RLS-bypass attempts) are **release-blocking**.
- **Support access:** **impersonation/elevated support access requires justification, is time-boxed, RLS-scoped to one tenant, and fully audited** (the support actor is a named principal); **no standing god-mode**.
- **Large-tenant isolation:** promotion to a **dedicated database/keys/residency** via `tenant.placement` for firms needing physical separation.
- **Noisy-neighbor controls:** per-tenant rate limits, queue fairness, and (optionally) per-tenant resource quotas so one tenant cannot degrade others.

---

## 27. Cost Management

- **Tagging & attribution:** every resource tagged (environment, service, **tenant where attributable**); enables per-service and **per-tenant cost visibility**.
- **Per-tenant cost metering:** **AI/OCR consumption and storage are metered per tenant** (ties to the billing/entitlement model) — so heavy users are visible and chargeable, protecting margins.
- **AI cost controls** (from the AI doc): native-parse-before-OCR, model tiering, caching by content hash, batching, confidence gating — the single biggest variable-cost lever.
- **Right-sizing & elasticity:** autoscale up for spikes (month-end / the 14th) and **down off-peak**; scale workers to near-zero when idle; serverless-container billing (Fargate-style) avoids paying for idle.
- **Commitments:** savings plans/reserved capacity for steady baseline (DB, baseline compute) once usage is predictable; spot for fault-tolerant batch workers (reports/SAF-T) where safe.
- **Storage tiering:** hot→cold→archive for closed-year documents; lifecycle policies automate it.
- **Budgets & alerts:** budget thresholds with **anomaly alerts**; FinOps review cadence; cost dashboards alongside ops dashboards.

## 28. Scaling Strategy

- **App tier:** stateless → **horizontal autoscale** on CPU/RPS/latency behind the load balancer.
- **Workers:** each fleet **scales independently on queue depth/age** — the core elasticity mechanism for OCR/AI/reports/SAF-T/submissions; absorbs deadline spikes; priority lanes keep critical work fast.
- **Database:** **read replicas** for reporting/projections; **partitioning** for append-heavy tables; **connection pooling**; large tenants promotable to dedicated instances; vertical scale + storage autoscale.
- **Reads from projections:** dashboards/reports never live-aggregate the ledger (CQRS-lite), so read scale is decoupled from write volume.
- **Caching & CDN:** reference data + permission decisions cached; static assets via EU CDN.
- **Decomposition for scale:** extract **AI/DocIntel, Reporting, Compliance** into independent services (distinct scaling/cost/security profiles) — event/contract interfaces make it caller-transparent; introduce a message broker + service mesh at that point.
- **Multi-region (later):** active-passive EU DR → potential active-active EU for scale; tenant `placement` supports residency/scale segmentation.

## 29. Incident Response

- **Severity model:** sev-1 (customer-impacting outage, data-isolation breach, missed-filing pipeline failure, security breach) → sev-3 (minor/degraded); each with response/resolution targets.
- **On-call & escalation:** rotation, paging, escalation chains; **runbooks** per alert; a designated incident commander for sev-1.
- **Comms:** internal incident channel + **status page** for customers; clear, honest updates; for accountants, **proactive notice** if a compliance/filing capability is degraded near a deadline.
- **Security & data incidents:** containment → eradication → recovery; **GDPR 72-hour breach assessment/notification**; the **immutable audit trail supports forensics**; cross-tenant access is an automatic sev-1 with isolation review.
- **Postmortems:** blameless, with corrective actions tracked to closure; learnings feed runbooks, alerts, and tests.
- **Drills:** periodic incident + DR game days validate readiness.

## 30. Release Strategy

- **Cadence:** frequent, small, reversible releases (continuous delivery to staging; gated, scheduled prod releases — avoiding high-risk deploys near VAT deadlines / the 14th).
- **Feature flags:** decouple deploy from release; enable **per-tenant rollout**, dark launches, and instant disable; gate Phase-2/3 features (SAF-T export, direct NAP submission, AI CFO) and entitlements.
- **Deployment technique:** **blue/green or canary** with health checks + automatic rollback; workers roll independently.
- **Zero-downtime DB changes:** **expand/contract migrations** (add → backfill → switch → remove) so schema changes never require downtime and are reversible; **RLS policies versioned with migrations and tested**.
- **Change management:** changes reviewed, recorded (audit), and communicated; maintenance windows minimized and announced; backward-compatible API/event versioning so mobile/clients lagging a version keep working.
- **Rollback plan** for every release (image + migration contract-phase + flag kill-switch).

## 31. Production Readiness Checklist

A go-live gate — all must be true before serving real tenant data.

**Residency & data**
- [ ] All resources EU-region; IaC **policy-as-code blocks non-EU** resources/egress.
- [ ] AI/OCR via **EU + zero-retention** endpoints; egress allowlisted.
- [ ] **No production data unmasked** in dev/staging; lower envs use synthetic/anonymized data.

**Data integrity & isolation**
- [ ] **RLS enabled on all tenant-scoped tables**; app role is non-bypass; connection-context discipline verified.
- [ ] **Tenant-isolation tests pass** in CI (incl. forged-tenant/RLS-bypass attempts) — release-blocking.
- [ ] **Immutable ledger** + **append-only, hash-chained audit** verified; **object-lock (WORM)** on immutable buckets.

**Security**
- [ ] Secrets in vault, **none in code/images**; rotation configured; secret-scanning in CI.
- [ ] Encryption at rest (DB/replicas/backups/Redis/storage/search) + in transit (TLS); KMS key rotation.
- [ ] WAF + DDoS + rate limiting live; least-privilege IAM; no standing prod human access (break-glass audited).
- [ ] SAST/DAST/dependency/image scans green; signed images + SBOM; pen-test findings remediated.
- [ ] **AI/OCR identities cannot reach ledger/NAP/KEP/permission paths** (verified).

**Reliability**
- [ ] Multi-AZ DB/cache/app; **backups encrypted + restore-tested**; **DR runbook + drill** completed; RPO/RTO documented and met.
- [ ] Workers scale independently on queue depth; DLQs + idempotency verified.

**Observability & ops**
- [ ] Metrics/traces/logs live; **logs PII-redacted (tested)**; correlation ids end-to-end.
- [ ] Alerts + on-call + runbooks for sev-1/2; compliance-pipeline + isolation + cost alerts configured.
- [ ] SLOs defined with error budgets; synthetic checks on login/upload→review/filing.

**Compliance & process**
- [ ] DPAs + zero-retention with all sub-processors; records-of-processing + **DPIA** done.
- [ ] DSAR/erasure ops reconciled with retention + legal holds; **GDPR breach process** ready.
- [ ] CI/CD with gated approvals, expand/contract migrations, rollback + feature-flag kill-switches.
- [ ] Status page + incident process live; change management + postmortem practice in place.

---

## Closing — how the infrastructure holds together

- **EU-resident and sovereignty-aware:** one EU region (Frankfurt) on **AWS for MVP**, every byte EU-pinned, AI/OCR EU + zero-retention, **policy-as-code enforcing residency**, and a **portable design** with a documented path to an EU-sovereign provider.
- **Managed-first, portable, decomposable:** managed Postgres (RLS, multi-AZ, replicas), S3 Object-Lock storage, managed Redis/queues, KMS/secrets — all on portable primitives, with the **modular monolith + independently scaling worker fleets** ready to split AI/Reporting/Compliance into services.
- **Isolation guaranteed and verified:** **RLS as the data backstop** (with disciplined connection context), tenant scoping across jobs/logs/storage/search/vectors/cache, **cross-tenant access = sev-1**, and **release-blocking isolation tests**.
- **Safe by construction:** secrets never in code, encryption everywhere, WAF/DDoS, sandboxed file scanning, **AI identities barred from privileged paths**, **immutable ledger + append-only audit**, and **PII-free logs** distinct from the evidentiary audit trail.
- **Resilient and operable:** multi-AZ + EU DR, **encrypted, restore-tested backups**, rebuildable projections, full observability, on-call + runbooks + drills, GDPR breach readiness, and a **production-readiness gate** that makes all of the above provable before launch.
- **Lean and elastic:** autoscaling that scales to near-zero off-peak, per-tenant cost metering, AI cost controls, and storage tiering keep MVP economics sane while absorbing month-end/14th-of-month spikes.

With this, the platform's architecture is complete end to end — product, UX, design system, screens, domain/data, rules engine, AI, backend, frontend, and now the EU-resident, secure, compliant, observable infrastructure that runs it: **capture → understand → propose → human approve → record (immutable) → comply** — every step EU-resident, tenant-isolated, audited, and recoverable.

*End of v1.0 Infrastructure & DevOps Architecture.*
