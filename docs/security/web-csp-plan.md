# Web Content-Security-Policy plan (follow-up to Pass 1B.1)

Status: **plan only.** Pass 1B.1 deliberately ships no CSP on the web app. The NestJS API
already sends Helmet's CSP for its own responses. Rolling out an enforcing policy blind would
break the app, for the reasons below.

## What the pages contain today (measured on the production build)

| Surface | Inline script | Inline style | External origins |
|---|---|---|---|
| Next.js app routes (`/login`, `/dashboard`, …) | 6 inline `<script>` per page (React Server Components flight data `self.__next_f.push(...)` + bootstrap), 13 same-origin `/_next/static` chunks | ~9 `style="…"` attributes from components | `fetch` / XHR to `NEXT_PUBLIC_API_URL` (same host `/api/*` in production) |
| Landing pages (`/`, `/en`, `/features`, …, served from `public/landing`) | 1 inline `<script type="application/ld+json">` (data block, never executed); 1 same-origin `/landing/assets/site.js?v=…` | ~26 `style="…"` attributes | none (fonts, icons, CSS all same-origin) |
| SAF-T / document downloads | — | — | opened with `window.open` in a new tab (top-level navigation, not governed by `connect-src`) |

## Constraints

1. **Next.js inline scripts.** The flight-data scripts differ per build and per render, so hashes are not practical. The supported way is a **per-request nonce** generated in `middleware.ts`, put in the CSP header, and read by Next.js. A nonce requires **dynamic rendering**: statically prerendered HTML cannot carry a fresh nonce. That means `export const dynamic = 'force-dynamic'` (or reading `headers()`) on the app layout, a small server-render cost per request. Pass 1B.1 already makes the app HTML `private, no-store`, so caching is not lost.
2. **Inline style attributes.** Both surfaces use `style="…"`. CSP `style-src` without `'unsafe-inline'` blocks them (nonces do not apply to style attributes). Use `style-src 'self' 'unsafe-inline'` initially. Removing it means refactoring those attributes into classes. The risk is low: inline-style injection is a much weaker vector than script.
3. **Landing JSON-LD.** `type="application/ld+json"` is a data block, not script execution, so `script-src` does not block it. Confirm this in Report-Only before enforcing. If a browser does report it, add the block's `'sha256-…'` hash (the landing HTML is generated, so the build script can compute and emit the hash).
4. **Two policies.** The landing pages are static files and cannot use nonces, but they need no inline script: `script-src 'self'` is enough there. The app routes use the nonce policy.

## Proposed policies

Landing (`/`, `/en`, marketing pages, `/landing/*`):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'; upgrade-insecure-requests
```

App routes (nonce from middleware):

```
default-src 'self'; script-src 'self' 'nonce-{N}' 'strict-dynamic'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self'; connect-src 'self' {API origin if not same-origin};
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`frame-ancestors 'none'` supersedes `X-Frame-Options: DENY` (keep both for older browsers).

## Rollout

1. Ship both policies as **`Content-Security-Policy-Report-Only`** with a `report-to` / `report-uri` endpoint (a small API route that logs to the audit or ops log, rate-limited). Run for at least one release cycle across BG/EN and every app screen.
2. Fix violations: the API origin in `connect-src`, any third-party widget, and JSON-LD if reported.
3. Add header tests (same harness as `apps/web/scripts/test-headers.test.mjs`) asserting the policy and that a nonce is present and differs between two requests.
4. Switch to enforcing `Content-Security-Policy`. Keep Report-Only for a stricter candidate (no `'unsafe-inline'` styles) as the next step.

## Rollback

Remove the header entries (web-only redeploy). Nothing persists client-side, unlike HSTS.
