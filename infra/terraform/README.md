# infra/terraform — AWS EU (Frankfurt) deployment

Infrastructure-as-code for the decided stack (CLAUDE.md §3: **AWS EU `eu-central-1`, multi-AZ**),
deploying the existing container images (`infra/Dockerfile.{api,web,worker}`) on **ECS Fargate**,
backed by **RDS PostgreSQL**, **ElastiCache Redis**, and an **S3** documents bucket with Object Lock.

> **Status: reviewable scaffold, not yet applied.** It was authored without an AWS account or a
> `terraform` binary available, so it has **not** been `terraform validate`/`plan`-checked. Treat it
> as a starting point: run `terraform init && terraform plan` and review every resource before `apply`.
> Per CLAUDE.md §13/§15, foundation/stack changes need human sign-off + an ADR — this directory is
> that proposal.

---

## ⚠️ Blocker you must resolve first: `BYPASSRLS` on managed PostgreSQL

The schema relies on a dedicated **`auth_lookup`** role with the **`BYPASSRLS`** attribute (migration
`0006`, and the signup functions fixed in `0021`). It is required so pre-auth email lookup and
self-service registration — which run with **no tenant context** — are not blocked by `FORCE ROW LEVEL
SECURITY`. Granting `BYPASSRLS` requires a **true PostgreSQL superuser**.

**AWS RDS and Aurora do not give you a true superuser** — the master user holds `rds_superuser`, which
**cannot** set `BYPASSRLS`. So `node scripts/migrate.js` will fail on stock RDS at `0006`
(`ALTER ROLE auth_lookup BYPASSRLS` → "must be superuser to change bypassrls attribute").

Pick one before deploying (all keep data in `eu-central-1`):

| Option | EU-resident | Superuser / BYPASSRLS | Managed backups/HA | Notes |
|---|---|---|---|---|
| **A. Self-managed PostgreSQL** on EC2 / ECS+EBS in `eu-central-1` | ✅ | ✅ | self-run | Drop-in; keeps all invariants. Set `var.use_rds = false` (see `database.tf`). **Recommended for MVP.** |
| **B. RDS + refactor** to remove the `BYPASSRLS` dependency | ✅ | n/a | ✅ | Replace bypass with owner-run `SECURITY DEFINER` + explicit RLS policies for the definer role. **Needs an ADR + ledger/RLS sign-off** (CLAUDE.md §13). |
| **C. RDS Custom for PostgreSQL** | ✅ | ✅ (SUPERUSER allowed) | ✅ | More setup/cost; you get OS + superuser access. |

This `terraform` ships the **RDS** resources (the option you chose) **and** an EC2 self-managed
fallback toggle, so you can take Option A immediately and migrate to B/C later. See `database.tf`.

---

## Layout

| File | Contents |
|---|---|
| `versions.tf` | Terraform + AWS provider pins, `default_tags`, **region guard (eu-* only)**, shared data sources |
| `variables.tf` | All inputs (sizes, image tags, domain, retention, toggles) |
| `network.tf` | VPC, 2×public + 2×private subnets, IGW, NAT, routes |
| `security.tf` | KMS CMK (encrypts RDS/Redis/S3/secrets/logs) + security groups |
| `database.tf` | RDS PostgreSQL **or** self-managed EC2 Postgres (toggle), ElastiCache Redis |
| `storage.tf` | S3 documents bucket (Object Lock/WORM, SSE-KMS, versioning, no public) + ALB-logs bucket |
| `registry-secrets.tf` | ECR repos (api/web/worker) + Secrets Manager entries (+ generated passwords) |
| `iam.tf` | ECS execution role + least-privilege api/worker task roles |
| `alb.tf` | Public ALB, HTTPS listener (ACM), host-routing `api.` → api, `app.` → web |
| `ecs.tf` | Cluster, log groups, task defs (api/web/worker/migrate), services |
| `outputs.tf` | ALB DNS, ECR URLs, DB/Redis endpoints, secret ARNs |
| `terraform.tfvars.example` | Copy to `terraform.tfvars` and fill in |

## Prerequisites

- An AWS account; credentials with admin (for the first apply).
- A **registered domain + ACM certificate** in `eu-central-1` covering `api.<domain>` and `app.<domain>`
  (TLS is mandatory — CLAUDE.md §11). Pass `domain_name` + `acm_certificate_arn`.
- A **remote state backend** (S3 + DynamoDB lock) — see commented block in `versions.tf`.
- Docker images built and pushed to the ECR repos this stack creates (the runbook covers ordering:
  apply infra → push images → run `migrate` task → start services).

Full step-by-step: [`docs/runbooks/deploy-aws-eu.md`](../../docs/runbooks/deploy-aws-eu.md).
