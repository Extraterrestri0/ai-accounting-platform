// The header policy lives IN this file on purpose: the production image (infra/Dockerfile.web.node)
// copies only next.config.mjs into its runtime stage, so a separate module would be missing at
// `next start`. Named exports are read by the header tests.

// HTTP response-header policy for the web app (Pass 1B.1). The same rules are exported for the tests.
//
// Ordering matters: Next.js applies every matching rule in order and a LATER rule that sets
// the same header key wins. So the fail-safe default comes first and the explicit
// public/static exceptions come after it. A new app route is therefore private by default.

/** Marketing pages served from public/landing via rewrites (must stay in sync with rewrites()). */
export const MARKETING_PAGES = ['features', 'pricing', 'about', 'faq', 'contact'];

export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Nothing in the app or the landing pages is meant to be framed (no iframe embedding exists).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The app uses none of these features (no camera/mic capture, no geolocation).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/**
 * HSTS only on responses that reached the edge over HTTPS. Caddy terminates TLS and forwards
 * X-Forwarded-Proto: https, so plain-HTTP/local requests never get it. No includeSubDomains and
 * no preload: the host is under sslip.io, a shared domain that must never be pinned for siblings.
 */
export const HSTS_HEADER = { key: 'Strict-Transport-Security', value: 'max-age=15552000' };

/** Sensitive application HTML: never stored by shared caches or the browser cache. */
export const PRIVATE_NO_STORE = 'private, no-store';
/** Public, non-versioned marketing HTML and assets: cacheable but always revalidated (as before). */
export const PUBLIC_REVALIDATE = 'public, max-age=0, must-revalidate';

/** @param {{ production?: boolean }} [opts] */
export function buildHeaderRules(opts = {}) {
  const production = opts.production ?? process.env.NODE_ENV === 'production';
  const marketingSources = [
    '/', '/en',
    ...MARKETING_PAGES.map((p) => `/${p}`),
    ...MARKETING_PAGES.map((p) => `/en/${p}`),
    '/landing/:path*', '/robots.txt', '/sitemap.xml',
  ];
  const rules = [
    // 1) Every response: security headers + fail-safe private, no-store.
    { source: '/:path*', headers: [...SECURITY_HEADERS, { key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
    // 2) Public marketing pages and their (non-hashed) assets: keep the previous revalidating policy.
    ...marketingSources.map((source) => ({ source, headers: [{ key: 'Cache-Control', value: PUBLIC_REVALIDATE }] })),
    // 3) Content-hashed build output: immutable for a year (what Next.js serves it with anyway).
    { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  ];
  if (production) {
    rules.push({ source: '/:path*', has: [{ type: 'header', key: 'x-forwarded-proto', value: 'https' }], headers: [HSTS_HEADER] });
  }
  return rules;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // Security headers + cache policy (buildHeaderRules above; verified by scripts/test-headers.test.mjs).
  async headers() {
    return buildHeaderRules();
  },
  // Client-rendered SaaS app talking to the NestJS API (NEXT_PUBLIC_API_URL).
  // Clean marketing URLs → the generated static pages in public/landing/*.html.
  // App routes (/login, /register, /dashboard, …) are untouched.
  async rewrites() {
    const pages = MARKETING_PAGES;
    return {
      beforeFiles: [
        // Bulgarian (default) at the root, English under /en. Same generator, same files.
        { source: '/', destination: '/landing/index.html' },
        ...pages.map((p) => ({ source: `/${p}`, destination: `/landing/${p}.html` })),
        { source: '/en', destination: '/landing/en/index.html' },
        ...pages.map((p) => ({ source: `/en/${p}`, destination: `/landing/en/${p}.html` })),
      ],
    };
  },
};
export default nextConfig;
