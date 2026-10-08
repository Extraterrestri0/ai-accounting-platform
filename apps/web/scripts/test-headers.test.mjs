// Security-header and cache-policy tests (Pass 1B.1).
//
//   npm run build && npm run test:headers
//
// Part A checks the policy data itself. Part B starts the REAL production server
// (`next start` on the current .next build) and checks actual HTTP responses for every app
// route found in the build manifest (so new routes are covered automatically), every
// rewritten marketing URL, public assets and content-hashed /_next/static assets.
import { describe, test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import nextConfig, {
  buildHeaderRules, SECURITY_HEADERS, HSTS_HEADER, PRIVATE_NO_STORE, PUBLIC_REVALIDATE,
} from '../next.config.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMMUTABLE = 'public, max-age=31536000, immutable';
// Resolve the Next CLI the way Node does (it is hoisted to the monorepo root node_modules).
const NEXT_BIN = createRequire(import.meta.url).resolve('next/dist/bin/next');

// ---------------------------------------------------------------- A. policy (pure)
describe('A. header policy', () => {
test('A1: first rule is the fail-safe default for every path (security headers + private, no-store)', () => {
  const [first] = buildHeaderRules({ production: true });
  assert.equal(first.source, '/:path*');
  for (const h of SECURITY_HEADERS) assert.ok(first.headers.some((x) => x.key === h.key && x.value === h.value), h.key);
  assert.ok(first.headers.some((x) => x.key === 'Cache-Control' && x.value === PRIVATE_NO_STORE));
});

test('A2: every rewritten marketing URL has a public cache exception (lists stay in sync)', async () => {
  const { beforeFiles } = await nextConfig.rewrites();
  const publicSources = new Set(buildHeaderRules({ production: true })
    .filter((r) => r.headers.some((h) => h.key === 'Cache-Control' && h.value === PUBLIC_REVALIDATE)).map((r) => r.source));
  for (const r of beforeFiles) assert.ok(publicSources.has(r.source), `missing public cache rule for rewrite ${r.source}`);
  assert.ok(publicSources.has('/landing/:path*'));
});

test('A3: HSTS only in production, only for HTTPS-forwarded requests, no includeSubDomains/preload', () => {
  const hsts = (rules) => rules.filter((r) => r.headers.some((h) => h.key === HSTS_HEADER.key));
  assert.equal(hsts(buildHeaderRules({ production: false })).length, 0);
  const [rule] = hsts(buildHeaderRules({ production: true }));
  assert.deepEqual(rule.has, [{ type: 'header', key: 'x-forwarded-proto', value: 'https' }]);
  assert.equal(HSTS_HEADER.value, 'max-age=15552000');
  assert.doesNotMatch(HSTS_HEADER.value, /includeSubDomains|preload/i);
});

test('A4: no Content-Security-Policy is introduced by this patch', () => {
  for (const r of buildHeaderRules({ production: true })) {
    assert.ok(!r.headers.some((h) => /content-security-policy/i.test(h.key)), r.source);
  }
});

});

// ---------------------------------------------------------------- B. real production server
describe('B. production server responses', () => {
let server; let BASE;
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

before(async () => {
  assert.ok(existsSync(path.join(WEB, '.next', 'BUILD_ID')), 'no production build found: run `npm run build` first');
  const port = await freePort();
  BASE = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port), '-H', '127.0.0.1'],
    { cwd: WEB, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/robots.txt`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('next start did not become ready');
});
after(() => { server?.kill(); });

const get = (p, headers = {}) => fetch(BASE + p, { redirect: 'manual', headers });
const assertSecurityHeaders = (res, label) => {
  for (const h of SECURITY_HEADERS) assert.equal(res.headers.get(h.key), h.value, `${label}: ${h.key}`);
  assert.equal(res.headers.get('content-security-policy'), null, `${label}: no CSP in this patch`);
};

/** All app-router routes from the build, with dynamic segments filled in. */
function appRoutes() {
  const manifest = JSON.parse(readFileSync(path.join(WEB, '.next/server/app-paths-manifest.json'), 'utf8'));
  return Object.keys(manifest)
    .map((k) => k.replace(/\/page$/, '').replace(/\/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, 'test-id') || '/')
    .filter((r) => r !== '/_not-found' && r !== '/'); // '/' is rewritten to the landing page (tested in B3)
}

test('B1: every app route serves HTML with private, no-store + security headers', async () => {
  const routes = appRoutes();
  assert.ok(routes.length >= 20, `expected the full app route set, got ${routes.length}`);
  for (const r of ['/login', '/register', '/dashboard', '/auth/callback', '/review/test-id']) assert.ok(routes.includes(r), r);
  for (const r of routes) {
    const res = await get(r);
    assert.equal(res.status, 200, r);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/, r);
    assert.equal(res.headers.get('cache-control'), PRIVATE_NO_STORE, `${r}: cache-control`);
    assertSecurityHeaders(res, r);
  }
});

test('B2: client-navigation RSC payloads and prefetches are private, no-store too', async () => {
  for (const h of [{ RSC: '1' }, { RSC: '1', 'Next-Router-Prefetch': '1' }]) {
    const res = await get('/dashboard?_rsc=t', h);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/x-component/);
    assert.equal(res.headers.get('cache-control'), PRIVATE_NO_STORE);
  }
});

test('B3: every rewritten marketing URL still serves its landing file, publicly revalidated', async () => {
  const { beforeFiles } = await nextConfig.rewrites();
  for (const { source, destination } of beforeFiles) {
    const res = await get(source);
    assert.equal(res.status, 200, source);
    assert.equal(res.headers.get('cache-control'), PUBLIC_REVALIDATE, `${source}: cache-control`);
    assertSecurityHeaders(res, source);
    const body = await res.text();
    assert.equal(body, readFileSync(path.join(WEB, 'public', destination), 'utf8'), `${source}: rewrite target content`);
  }
});

test('B4: public landing assets stay publicly cacheable (revalidated, not no-store)', async () => {
  for (const p of ['/landing/assets/site.css', '/landing/assets/site.js', '/landing/assets/fonts/InterVariable.woff2', '/landing/legal/privacy.html', '/robots.txt']) {
    const res = await get(p);
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get('cache-control'), PUBLIC_REVALIDATE, p);
    assertSecurityHeaders(res, p);
  }
});

test('B5: content-hashed /_next/static CSS and JS remain immutable', async () => {
  const html = await (await get('/login')).text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"']+\.(?:css|js)/g) ?? [])];
  assert.ok(assets.some((a) => a.endsWith('.css')) && assets.some((a) => a.endsWith('.js')), 'found css + js assets');
  for (const a of assets) {
    const res = await get(a);
    assert.equal(res.status, 200, a);
    assert.equal(res.headers.get('cache-control'), IMMUTABLE, a);
  }
});

test('B6: HSTS only when the edge forwarded HTTPS', async () => {
  assert.equal((await get('/login')).headers.get('strict-transport-security'), null);
  assert.equal((await get('/login', { 'X-Forwarded-Proto': 'http' })).headers.get('strict-transport-security'), null);
  for (const p of ['/login', '/', '/_next/static/x-missing.js']) {
    assert.equal((await get(p, { 'X-Forwarded-Proto': 'https' })).headers.get('strict-transport-security'), 'max-age=15552000', p);
  }
});

test('B7: unknown routes (404) are never cacheable and carry security headers', async () => {
  const res = await get('/definitely-not-a-route');
  assert.equal(res.status, 404);
  assert.match(res.headers.get('cache-control') ?? '', /no-store/);
  assertSecurityHeaders(res, '404');
});
});
