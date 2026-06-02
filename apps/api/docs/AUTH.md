# Authentication & Authorization — How It Works

## Login flow (pre-tenant-context)
1. `POST /auth/login {email,password}` → `AuthService.login`.
2. **Pre-auth lookup** finds the user by email across tenants via the SECURITY DEFINER
   function `app.authenticate_lookup`, owned by a NOLOGIN/BYPASSRLS role `auth_lookup`.
   `app_user` may only EXECUTE it; it cannot read users cross-tenant directly. (Verified.)
3. Argon2id verifies the password. Failures increment `failed_login_attempts`; ≥5 ⇒ 15-min lock.
4. If `mfa_enabled`, return `{status:'mfa_required', mfaToken}` (a short-lived, audience-marked
   token), NOT a session. `POST /auth/mfa/verify {mfaToken,code}` reads the MFA secret **under
   tenant context** (RLS-allowed) and verifies the RFC-6238 TOTP.
5. On success, issue a short-lived **access JWT** (`{sub:userId, tid:tenantId}`) + an opaque
   **refresh token** whose SHA-256 hash is stored in `auth_sessions` (tenant-scoped, RLS).

## Per-request authorization
- `JwtPrincipalResolver` verifies the access JWT and yields `{userId, tenantId}` — **tenantId
  comes from the signed claim, never client input**. It feeds Task 003's `TenantContextMiddleware`,
  which establishes the tenant context for the request.
- `@RequirePermission('ledger.post')` + the global `RbacGuard` re-authorize on the server using
  effective permissions = union(tenant membership role, active-company assignment role), with
  **hard guardrails** (e.g. `vat.submit` only for approver/owner; +KEP step-up later).
- UI permission hints are never trusted (Invariant 9).

## RBAC model
- Tenant roles (`memberships`): `tenant_admin`, `member`.
- Company roles (`company_assignments.role`, from Task 003): `owner`, `accountant`, `approver`, `viewer`.
- Static catalog + maps in `domain/roles.ts`; **separation of duties** enforced (accountant posts
  but cannot submit VAT; approver submits VAT but cannot post).

## Security properties
- `app_user` stays NOBYPASSRLS; the ONLY RLS-exempt path is the minimal pre-auth lookup.
- Refresh tokens are stored hashed; rotated on use; revocable (logout).
- MFA secrets stored in `users.mfa_secret` — encrypt at rest via KMS at the app layer (TODO marker).
- Uniform failure + constant hashing work mitigate user-enumeration/timing oracles.
- JWT secret from the vault (`AUTH_JWT_SECRET`); never in code. (Consider RS256 + JWKS in prod.)

## For later tasks
- Ledger/Tax endpoints add `@RequirePermission('ledger.post' | 'vat.submit' | ...)`.
- KEP step-up (state submission) layers on top of `vat.submit` without changing this model.
