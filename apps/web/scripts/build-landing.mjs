/* ============================================================================
   Static generator for the Acco marketing site (v3, English-first).
   One design system with the application. Product visuals are faithful
   miniatures of real Acco screens (shown in the app's English mode), composed
   as editorial scenes. Content rule: only capabilities that exist in the
   repository; planned items are labelled. No invented customers, numbers,
   certifications or integrations.
   Run:  node apps/web/scripts/build-landing.mjs
   Output: apps/web/public/landing/*.html + public/sitemap.xml + robots.txt
   ============================================================================ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'public', 'landing');
const PUB = join(__dir, '..', 'public');
const SITE = 'https://app.185-52-207-143.sslip.io'; // temporary public host until a real domain is configured
const BRAND = 'Acco';
// No public contact address is published: there is no verified, monitored inbox yet (see /contact).
const V = 'v=44';
mkdirSync(OUT, { recursive: true });

/* ---- icons --------------------------------------------------------------- */
const s = (p, w = 1.75) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  arrow: s('<path d="M5 12h14M13 6l6 6-6 6"/>', 2),
  chev: s('<path d="M9 6l6 6-6 6"/>', 2),
  check: s('<path d="M20 6 9 17l-5-5"/>', 2.2),
  checkc: s('<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
  upload: s('<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
  scan: s('<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M7 12h10"/>'),
  review: s('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  book: s('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  invoice: s('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>'),
  bank: s('<path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M12 3 3 8h18z"/>'),
  chart: s('<path d="M3 3v18h18"/><path d="M7 15l4-4 4 3 5-6"/>'),
  vat: s('<path d="M9 14l6-6"/><circle cx="9.5" cy="8.5" r="1.5"/><circle cx="14.5" cy="13.5" r="1.5"/><rect x="3" y="3" width="18" height="18" rx="3"/>'),
  spark: s('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
  shield: s('<path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>'),
  lock: s('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  eu: s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>'),
  chain: s('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  user: s('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  cite: s('<path d="M7 17h10M7 13h10M7 9h4"/><rect x="3" y="4" width="18" height="16" rx="2"/>'),
  menu: s('<path d="M4 7h16M4 12h16M4 17h16"/>', 2),
  mail: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cal: s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  xml: s('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>'),
  eye: s('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  ban: s('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
  layers: s('<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>'),
};

/* ---- brand ---------------------------------------------------------------- */
const LOGO = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1C6B4E"/><path d="M9.5 16.5l4.2 4.2L22.5 11.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const brand = (href = '/') => `<a class="brand" href="${href}" aria-label="${BRAND}">${LOGO}<span>acco</span></a>`;

/* ---- head / nav / footer --------------------------------------------------- */
const head = (p) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${p.title}</title>
<meta name="description" content="${p.desc}" />
<link rel="canonical" href="${SITE}${p.url}" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${BRAND}" />
<meta property="og:locale" content="en_GB" />
<meta property="og:title" content="${p.title}" />
<meta property="og:description" content="${p.desc}" />
<meta property="og:url" content="${SITE}${p.url}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${p.title}" />
<meta name="twitter:description" content="${p.desc}" />
<meta name="theme-color" content="#FFFFFF" />
<link rel="icon" href="/landing/assets/app-icon.svg" type="image/svg+xml" />
<link rel="preload" href="/landing/assets/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="/landing/assets/tokens.css?${V}" />
<link rel="stylesheet" href="/landing/assets/site.css?${V}" />
<script type="application/ld+json">${JSON.stringify(p.jsonld)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>`;

const NAVLINKS = [['/features', 'Product'], ['/#how', 'How it works'], ['/#ai-accountant', 'AI Accountant'], ['/pricing', 'Pricing'], ['/about', 'About']];
const nav = (active) => `
<header class="nav" id="nav">
  <div class="wrap inner">
    ${brand()}
    <nav class="nav-links" aria-label="Main">
      ${NAVLINKS.map(([h, t]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
    </nav>
    <div class="nav-actions">
      <a class="btn btn-out btn-sm" href="/login">Sign in</a>
      <a class="btn btn-ink btn-sm" href="/register">Get started</a>
      <button class="nav-burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="mobile-menu"><span class="ic-menu">${I.menu}</span><span class="ic-close">${s('<path d="M6 6l12 12M18 6 6 18"/>', 2)}</span></button>
    </div>
  </div>
</header>
<nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">
  ${[...NAVLINKS, ['/faq', 'FAQ'], ['/contact', 'Contact']].map(([h, t]) => `<a class="mm-link" href="${h}">${t} ${I.chev}</a>`).join('')}
  <div class="mm-actions"><a class="btn btn-ink" href="/register">Get started</a><a class="btn btn-out" href="/login">Sign in</a></div>
  <p class="mm-foot">Accounting that prepares the work. You approve it.</p>
</nav>
<main id="main">`;

const fcol = (h, links) => `<div><h2 class="fh">${h}</h2>${links.map(([href, t]) => `<a href="${href}">${t}</a>`).join('')}</div>`;
const footer = () => `</main>
<footer class="footer" aria-label="Site footer">
  <div class="wrap">
    <div class="cols">
      <div>
        ${brand()}
        <p class="about">Accounting software for Bulgarian businesses. Acco reads documents, proposes the accounting treatment and posts to an immutable ledger only after a person approves.</p>
      </div>
      ${fcol('Product', [['/features', 'Features'], ['/#how', 'How it works'], ['/#ai-accountant', 'AI Accountant'], ['/pricing', 'Pricing'], ['/faq', 'FAQ']])}
      ${fcol('Company', [['/about', 'About'], ['/contact', 'Contact'], ['/login', 'Sign in'], ['/register', 'Create account']])}
      ${fcol('Legal', [['/landing/legal/privacy.html', 'Privacy'], ['/landing/legal/terms.html', 'Terms'], ['/landing/legal/cookies.html', 'Cookies'], ['/landing/legal/gdpr.html', 'GDPR']])}
    </div>
    <div class="bottom"><span>© ${new Date().getFullYear()} ${BRAND}. All rights reserved.</span><span>EUR functional currency · Legal pages are in Bulgarian</span></div>
  </div>
</footer>
<script src="/landing/assets/site.js?${V}" defer></script>
</body>
</html>`;

/* ============================================================================
   Product fragments (miniatures of the real screens, English UI mode)
   ============================================================================ */
const bar = (crumb) => `<div class="ui-bar"><span class="brand">${LOGO}<span>acco</span></span><span class="crumb">${crumb}</span><span class="sp"><span class="av">AD</span></span></div>`;

const frPaper = (hl = '') => `
<div class="paper ui-paper">
  <p class="p-h5">Invoice</p><div class="no">No. 0000001180 · 30.09.2026</div>
  <div class="grid"><div><b>Supplier</b><span>Softuer Prima EOOD</span><span class="mono" style="font-size:10.5px">UIC 204117823</span></div><div><b>Customer</b><span>Demo Firma EOOD</span><span class="mono" style="font-size:10.5px">UIC 123456789</span></div></div>
  <div class="row"><span>Prima Cloud subscription · October</span><span class="num">190.00</span></div>
  <div class="row"><span>Tax base</span><span class="num${hl === 'net' ? ' hl' : ''}">190.00 €</span></div>
  <div class="row"><span>VAT 20%</span><span class="num">38.00 €</span></div>
  <div class="row total"><span>Total</span><span class="num${hl === 'total' ? ' hl' : ''}">228.00 €</span></div>
</div>`;

const frReviewMain = () => `
<div class="ui lift">
  ${bar('<span>Review</span><span>›</span><b>f-1180-softprima.pdf</b>')}
  <div class="ui-title"><p class="ui-h5">f-1180-softprima.pdf</p><div class="meta"><b>Softuer Prima EOOD</b><span>No. 0000001180</span><span>30.09.2026</span><b class="num">228.00 €</b></div></div>
  <div class="ui-h" style="border-top:1px solid var(--line);margin-top:10px"><b>Extracted data</b><span class="conf ok">overall confidence 94%</span></div>
  <div class="ui-fields">
    <div class="ui-group">Document</div>
    <div class="ui-field"><div><b>Invoice No.</b><strong>0000001180</strong></div><span class="conf ok">98%</span></div>
    <div class="ui-field"><div><b>Tax event date</b><strong>30.09.2026</strong></div><span class="conf ok">96%</span></div>
    <div class="ui-group">Amounts &amp; VAT</div>
    <div class="ui-field flag"><div><b>Tax base</b><strong>190.00 €</strong></div><span class="conf warn">71%</span></div>
    <div class="ui-field"><div><b>VAT 20%</b><strong>38.00 €</strong></div><span class="conf ok">checked</span></div>
    <div class="ui-field"><div><b>Total</b><strong>228.00 €</strong></div><span class="conf ok">checked</span></div>
    <div class="ui-field"><div><b>Treatment</b><strong>standard · 20%</strong></div><span class="conf ok">rule</span></div>
    <div class="ui-group">Supplier</div>
    <div class="ui-field"><div><b>Name</b><strong>Softuer Prima EOOD</strong></div><span class="conf ok">94%</span></div>
    <div class="ui-field"><div><b>UIC</b><strong>204117823</strong></div><span class="conf ok">checked</span></div>
  </div>
</div>`;

const frDecision = (state = 'review') => `
<div class="ui">
  <div class="ui-h"><b>Decision</b>${state === 'posted' ? '<span class="pill ok">posted</span>' : state === 'approved' ? '<span class="pill ok">approved</span>' : '<span class="pill warn">awaiting review</span>'}</div>
  <ul class="ui-steps">
    <li class="done"><i>✓</i>Extraction</li>
    <li class="${state === 'review' ? 'cur' : 'done'}"><i>${state === 'review' ? '' : '✓'}</i>Review fields</li>
    <li class="${state === 'review' ? '' : state === 'approved' ? 'done' : 'done'}"><i>${state === 'review' ? '' : '✓'}</i>Approval</li>
    <li class="${state === 'approved' ? 'cur' : state === 'posted' ? 'done' : ''}"><i>${state === 'posted' ? '✓' : ''}</i>Posting</li>
  </ul>
  <div class="ui-actions">${state === 'review' ? '<span class="ui-btn brand block">Approve</span><span class="ui-btn block">Reject</span>' : state === 'approved' ? '<span class="ui-btn brand block">Post to ledger</span>' : '<span class="ui-note" style="margin:0">Journal entry <b class="mono">JE-2026-00417</b></span>'}</div>
</div>`;

const frSuggestion = () => `
<div class="ui">
  <div class="ui-h"><b>Suggestion</b><span class="pill neu">from memory</span></div>
  <div class="ui-lines">
    <div class="ui-line"><code>602</code><span>Dr Services</span><span class="r">190.00 €</span></div>
    <div class="ui-line"><code>4531</code><span>Dr Input VAT</span><span class="r">38.00 €</span></div>
    <div class="ui-line"><code>401</code><span class="cr">Cr Suppliers</span><span class="r">228.00 €</span></div>
  </div>
  <div class="ui-note"><b>VAT:</b> standard 20% · BG supplier · matched code STD20</div>
</div>`;

const frTicket = () => `
<div class="ticket">
  <div class="t">${I.checkc} Posted to the ledger</div>
  <div class="m">JE-2026-00417 · 03.10.2026</div>
  <div class="by">Approved by <b>Ana Dimitrova</b> · recorded in the audit trail</div>
</div>`;

const frAR = () => `
<div class="ui ui-w">
  <div class="wt">Receivables <span>View all →</span></div>
  <div class="big">14 320.00 €</div>
  <div class="kv"><span>Current</span><b>11 900.00 €</b></div>
  <div class="kv"><span>Overdue · 3 documents</span><b class="warn">2 420.00 €</b></div>
</div>`;

const frAging = () => `
<div class="ui">
  <div class="ui-h"><b>Payables by due date</b><span>as of 03.10.2026</span></div>
  <table class="ui-table">
    <tr><th>Bucket</th><th class="r">Docs</th><th class="r">Amount</th><th class="hide-sm">Share</th></tr>
    <tr><td class="s">Current</td><td class="r">7</td><td class="r">4 180.00 €</td><td class="hide-sm"><span style="display:block;height:6px;border-radius:99px;background:var(--bg-warm);overflow:hidden"><span style="display:block;width:64%;height:100%;background:var(--brand);opacity:.8"></span></span></td></tr>
    <tr><td class="s">1–30 days</td><td class="r">2</td><td class="r">1 560.00 €</td><td class="hide-sm"><span style="display:block;height:6px;border-radius:99px;background:var(--bg-warm);overflow:hidden"><span style="display:block;width:24%;height:100%;background:var(--warn);opacity:.8"></span></span></td></tr>
    <tr><td class="s">31–60 days</td><td class="r">1</td><td class="r">640.00 €</td><td class="hide-sm"><span style="display:block;height:6px;border-radius:99px;background:var(--bg-warm);overflow:hidden"><span style="display:block;width:10%;height:100%;background:var(--err);opacity:.8"></span></span></td></tr>
    <tfoot><tr><td>Total open</td><td class="r">10</td><td class="r">6 380.00 €</td><td class="hide-sm"></td></tr></tfoot>
  </table>
</div>`;

const frBankMatch = () => `
<div class="ui">
  <div class="ui-h"><b>Bank statement · UniCredit</b><span>3 to reconcile</span></div>
  <table class="ui-table">
    <tr><th>Date</th><th>Description</th><th class="r">Amount</th><th>Status</th></tr>
    <tr><td>03.10</td><td class="s">Payment inv. 1180</td><td class="r">-228.00 €</td><td><span class="pill warn">suggested</span></td></tr>
    <tr><td>02.10</td><td class="s">Receipt · INV 2026-0031</td><td class="r">1 500.00 €</td><td><span class="pill ok">matched</span></td></tr>
    <tr><td>01.10</td><td class="s">Rent October</td><td class="r">-640.00 €</td><td><span class="pill ok">matched</span></td></tr>
  </table>
  <div class="ui-note" style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px"><span><b>Match:</b> invoice 0000001180 · Softuer Prima · 228.00 € <span class="conf ok" style="margin-left:6px">98%</span></span><span class="ui-btn brand">Confirm</span></div>
</div>`;

const frTB = () => `
<div class="ui">
  <div class="ui-h"><b>Trial balance</b><span>01.01.2026 – 03.10.2026</span></div>
  <table class="ui-table">
    <tr><th>Account</th><th>Name</th><th class="r">Debit</th><th class="r">Credit</th><th class="r hide-sm">Balance</th></tr>
    <tr><td class="m">401</td><td class="s">Suppliers</td><td class="r">6 120.00 €</td><td class="r">12 500.00 €</td><td class="r hide-sm">-6 380.00 €</td></tr>
    <tr><td class="m">411</td><td class="s">Customers</td><td class="r">18 400.00 €</td><td class="r">4 080.00 €</td><td class="r hide-sm">14 320.00 €</td></tr>
    <tr><td class="m">4531</td><td class="s">Input VAT</td><td class="r">1 880.00 €</td><td class="r">0.00 €</td><td class="r hide-sm">1 880.00 €</td></tr>
    <tr><td class="m">4532</td><td class="s">Output VAT</td><td class="r">0.00 €</td><td class="r">3 120.00 €</td><td class="r hide-sm">-3 120.00 €</td></tr>
    <tr><td class="m">702</td><td class="s">Revenue</td><td class="r">0.00 €</td><td class="r">15 900.00 €</td><td class="r hide-sm">-15 900.00 €</td></tr>
    <tfoot><tr><td colspan="2">Total</td><td class="r">26 400.00 €</td><td class="r">35 600.00 €</td><td class="r hide-sm"><span class="pill ok">balanced</span></td></tr></tfoot>
  </table>
</div>`;

const frVatKpis = () => `
<div class="ui-kpis">
  <div class="ui-kpi"><b>Output VAT</b><strong>3 120.00 €</strong><small>12 sales invoices</small></div>
  <div class="ui-kpi"><b>Input VAT</b><strong>1 880.00 €</strong><small>27 purchases</small></div>
  <div class="ui-kpi"><b>VAT payable</b><strong class="ok">1 240.00 €</strong><small>period 09/2026</small></div>
</div>`;

const frSaft = () => `
<div class="ui flat">
  <div class="ui-h"><b>SAF-T exports</b><span class="pill beta" style="background:var(--warn-soft);color:var(--warn)">beta</span></div>
  <table class="ui-table">
    <tr><th>Period</th><th>Status</th><th class="r">Errors</th><th class="r hide-sm">Warnings</th><th></th></tr>
    <tr><td class="s">September 2026</td><td><span class="pill ok">completed</span></td><td class="r">0</td><td class="r hide-sm">3</td><td class="r"><span class="ui-btn">XML</span></td></tr>
    <tr><td class="s">August 2026</td><td><span class="pill ok">completed</span></td><td class="r">0</td><td class="r hide-sm">1</td><td class="r"><span class="ui-btn">XML</span></td></tr>
  </table>
</div>`;

const frAssistant = () => `
<div class="ui">
  <div class="ui-h"><b>${I.spark.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px;margin-right:6px;color:var(--brand)"')}AI Accountant</b><span>reads only · never posts</span></div>
  <div class="ui-chips"><span class="ui-chip on">Why do I owe this much VAT?</span><span class="ui-chip">Where does the amount come from?</span><span class="ui-chip">What to check before filing</span></div>
  <div class="ui-qa">
    <div class="ui-q"><span>Why do I owe this much VAT?</span><span class="badges"><span class="conf ok">95%</span><span class="pill neu">deterministic</span></span></div>
    <div class="ui-a">For 09/2026 you owe <strong>1 240.00 €</strong>: output VAT of 3 120.00 € on 12 sales invoices, minus input VAT of 1 880.00 € on 27 purchases. The largest contribution is INV 2026-0031 to Delta Consult OOD (1 500.00 € base).</div>
    <div class="ui-src"><b>Sources</b><span>${I.cite.replace('<svg', '<svg style="width:11px;height:11px"')} Sales register 09/2026</span><span>${I.cite.replace('<svg', '<svg style="width:11px;height:11px"')} Purchase register 09/2026</span><span>${I.cite.replace('<svg', '<svg style="width:11px;height:11px"')} INV 2026-0031</span></div>
    <div class="ui-foot">${I.shield} Explanation built from your records. The assistant cannot post, approve or file anything.</div>
  </div>
</div>`;

const frJournal = () => `
<div class="ui ui-je">
  <div class="ui-h"><b>Journal</b><span>append-only · corrections are reversing entries</span></div>
  <div class="hd"><code>JE-2026-00417</code><span>Purchase invoice 0000001180 · Softuer Prima EOOD</span><span class="pill ok">posted</span></div>
  <table class="ui-table">
    <tr><th>Account</th><th>Description</th><th class="r">Debit</th><th class="r">Credit</th></tr>
    <tr><td class="m">602</td><td>External services</td><td class="r">190.00 €</td><td class="r">—</td></tr>
    <tr><td class="m">4531</td><td>Input VAT</td><td class="r">38.00 €</td><td class="r">—</td></tr>
    <tr><td class="m">401</td><td>Suppliers · Softuer Prima EOOD</td><td class="r">—</td><td class="r">228.00 €</td></tr>
    <tfoot><tr><td colspan="2">Balanced</td><td class="r">228.00 €</td><td class="r">228.00 €</td></tr></tfoot>
  </table>
</div>`;

const frDashboard = () => `
<div class="ui lift" style="font-size:12px">
  ${bar('<b>Dashboard</b>')}
  <div style="padding:16px;background:var(--bg-warm);display:flex;flex-direction:column;gap:12px">
    <div class="ui-kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <div class="ui-kpi"><b>Awaiting review</b><strong class="warn">4</strong><small>need approval</small></div>
      <div class="ui-kpi"><b>VAT payable</b><strong>1 240.00 €</strong><small>period 09/2026</small></div>
      <div class="ui-kpi"><b>Receivables</b><strong>14 320.00 €</strong><small>3 overdue</small></div>
      <div class="ui-kpi"><b>Net result · 2026</b><strong class="ok">18 420.50 €</strong><small>from the ledger</small></div>
    </div>
    <div class="ui flat">
      <div class="ui-h"><b>Recent documents</b><span>All →</span></div>
      <table class="ui-table">
        <tr><th>File</th><th class="hide-sm">Supplier</th><th>Status</th><th class="r">Date</th></tr>
        <tr><td class="s">f-1180-softprima.pdf</td><td class="hide-sm">Softuer Prima EOOD</td><td><span class="pill warn">awaiting review</span></td><td class="r">03.10.2026</td></tr>
        <tr><td class="s">energo-88213.pdf</td><td class="hide-sm">Energo-Pro</td><td><span class="pill ok">posted</span></td><td class="r">02.10.2026</td></tr>
        <tr><td class="s">kurier-0917.jpg</td><td class="hide-sm">—</td><td><span class="pill info">extracting</span></td><td class="r">02.10.2026</td></tr>
      </table>
    </div>
  </div>
</div>`;

const frUpload = () => `
<div class="ui">
  <div class="ui-h"><b>Upload documents</b><span>PDF · JPG · PNG · XML · up to 20 MB</span></div>
  <div class="ui-drop"><span class="ui-drop-ic">${I.upload}</span><b>Drop files here or choose from your computer</b><span>Each file is checked, stored immutably and queued for extraction.</span></div>
  <table class="ui-table">
    <tr><th>File</th><th class="hide-sm">Size</th><th>Status</th><th class="r">Uploaded</th></tr>
    <tr><td class="s">f-1180-softprima.pdf</td><td class="hide-sm">184 KB</td><td><span class="pill ok">extracted · 22 fields</span></td><td class="r">10:42</td></tr>
    <tr><td class="s">kurier-0917.jpg</td><td class="hide-sm">1.2 MB</td><td><span class="pill info">extracting</span></td><td class="r">10:41</td></tr>
    <tr><td class="s">invoice-2026-0031.xml</td><td class="hide-sm">9 KB</td><td><span class="pill ok">parsed · native XML</span></td><td class="r">10:39</td></tr>
  </table>
</div>`;

const frAudit = () => `
<div class="ui">
  <div class="ui-h"><b>Audit trail</b><span class="conf ok">chain verified · 1 284 events</span></div>
  <ul class="ui-log">
    <li><i class="a-human"></i><div><b>Ana Dimitrova</b> posted <code>JE-2026-00417</code> from review <code>f-1180-softprima.pdf</code></div><span>03.10 · 10:58</span><em>7f3a…c21e</em></li>
    <li><i class="a-human"></i><div><b>Ana Dimitrova</b> approved review · corrected <code>tax_base</code> 19.00 → 190.00 €</div><span>03.10 · 10:57</span><em>b91d…04af</em></li>
    <li><i class="a-ai"></i><div><b>AI suggestion</b> proposed 602 / 4531 / 401 · rule <code>STD20</code> · memory: Softuer Prima</div><span>03.10 · 10:44</span><em>e2c8…77b0</em></li>
    <li><i class="a-auto"></i><div><b>Extraction</b> completed · 22 fields · overall 94%</div><span>03.10 · 10:42</span><em>51aa…9d3c</em></li>
    <li><i class="a-human"></i><div><b>Ana Dimitrova</b> uploaded <code>f-1180-softprima.pdf</code></div><span>03.10 · 10:41</span><em>0c7e…b1f2</em></li>
  </ul>
</div>`;

const frPeriods = () => `
<div class="ui flat">
  <div class="ui-h"><b>Accounting periods</b><span>2026</span></div>
  <table class="ui-table">
    <tr><th>Period</th><th>Status</th><th class="r hide-sm">Entries</th><th class="r">Locked by</th></tr>
    <tr><td class="s">October 2026</td><td><span class="pill info">open</span></td><td class="r hide-sm">14</td><td class="r">—</td></tr>
    <tr><td class="s">September 2026</td><td><span class="pill ok">locked</span></td><td class="r hide-sm">61</td><td class="r">A. Dimitrova</td></tr>
    <tr><td class="s">August 2026</td><td><span class="pill ok">locked</span></td><td class="r hide-sm">57</td><td class="r">A. Dimitrova</td></tr>
  </table>
</div>`;

/* ============================================================================
   Home sections
   ============================================================================ */
const hero = () => `
<section class="hero">
  <div class="wrap inner">
    <span class="eyebrow"><span>Accounting software · Human approval<span class="hide-m"> · EUR</span></span></span>
    <h1 class="display">Accounting that prepares the work. <span class="dim">You approve it.</span></h1>
    <p class="lead">Acco reads your invoices, proposes the accounting treatment and VAT, and posts to an immutable ledger only when a person approves.<span class="hide-m"> Every number traces back to a document.</span></p>
    <div class="hero-cta">
      <a class="btn btn-ink btn-lg" href="/register">Get started ${I.arrow}</a>
      <a class="btn btn-out btn-lg" href="#how">See how it works</a>
    </div>
    <p class="hero-note"><span>Immutable ledger</span><span>Hash-chained audit trail</span><span>Built for Bulgarian VAT</span></p>
  </div>
  <div class="wrap-wide">
    <div class="scene" role="img" aria-label="The Acco review screen: extracted fields next to the source document, with the approval step and the posting result" data-reveal>
      <div class="sc-doc" aria-hidden="true">${frPaper('total')}</div>
      <div class="sc-main" aria-hidden="true">${frReviewMain()}</div>
      <div class="sc-sugg" aria-hidden="true">${frDecision('review')}</div>
      <div class="sc-ticket" aria-hidden="true">${frTicket()}</div>
    </div>
  </div>
</section>`;

const facts = () => `
<section class="section-sm">
  <div class="wrap">
    <div class="facts">
      <div>${I.user}<div><b>Human approval on every posting</b><span>Nothing reaches the ledger automatically.</span></div></div>
      <div>${I.book}<div><b>Immutable double-entry ledger</b><span>Balanced entries; corrections are reversals.</span></div></div>
      <div>${I.chain}<div><b>Hash-chained audit trail</b><span>Every action, human or AI, is recorded and verifiable.</span></div></div>
      <div>${I.vat}<div><b>EUR, Bulgarian VAT built in</b><span>Treatments, registers and checks follow Bulgarian rules.</span></div></div>
    </div>
  </div>
</section>`;

const MATRIX = [
  ['/features#capture', I.upload, 'Document capture', 'PDF, images and XML invoices. Validated, stored immutably, queued for extraction.', 'upload'],
  ['/features#extraction', I.scan, 'Extraction & checks', 'Field-by-field values with confidence. UIC, VAT number, IBAN and totals are verified by rules.', 'extract'],
  ['/features#review', I.review, 'Review queue', 'Low-confidence fields stand out. Correct, approve or reject — with a full history.', 'review'],
  ['/features#ledger', I.book, 'Ledger & periods', 'Balanced double-entry postings, reversing corrections, locked accounting periods.', 'ledger'],
  ['/features#invoicing', I.invoice, 'Invoicing', 'Sequential numbering, proformas, credit and debit notes, product catalogue with VAT codes.', 'invoices'],
  ['/features#banking', I.bank, 'Banking & reconciliation', 'CSV/XLSX statement import, ranked match suggestions, payments, receivables and payables.', 'banking'],
  ['/features#vat', I.vat, 'VAT & SAF-T', 'Purchase and sales registers, period summary, VIES dataset; SAF-T export in beta.', 'vat'],
  ['/features#reports', I.chart, 'Reports', 'Trial balance, P&L, general ledger, monthly revenue and expenses, cash flow. CSV export.', 'reports'],
  ['/#ai-accountant', I.spark, 'AI Accountant', 'Answers fixed questions from your records, cites sources, and never changes anything.', 'assistant'],
];
const matrix = () => `
<section class="section bg-warm hairline-top" id="product">
  <div class="wrap">
    <div class="split">
      <div class="sec-head"><span class="eyebrow">What Acco handles</span><h2 class="h2">The whole loop, from document to filing-ready records.</h2></div>
      <p class="lead">Built for sole traders, small companies and the accountants who serve them. Only what works in the product today is listed here.</p>
    </div>
    <div class="matrix">
      ${MATRIX.map(([href, ic, t, d, k]) => `<a href="${href}"><span class="ic">${ic}</span><h3>${t}</h3><p>${d}</p><span class="k">/${k}</span></a>`).join('')}
    </div>
  </div>
</section>`;

const FLOW = [
  ['auto', '01', 'Document', 'Upload a PDF, photo or XML. It is checked and stored immutably.', 'Automation'],
  ['auto', '02', 'Extraction', 'Fields are read with a confidence score. UIC, VAT number, IBAN and totals are verified by rules.', 'Automation'],
  ['human', '03', 'Review', 'You see the document and the fields side by side. Weak fields are flagged.', 'Your decision'],
  ['auto', '04', 'Suggestion', 'Accounts, expense category and VAT treatment are proposed from rules and memory.', 'Automation'],
  ['human', '05', 'Approval', 'Approve, correct or reject. Nothing proceeds without this step.', 'Your decision'],
  ['auto', '06', 'Ledger', 'A balanced entry is posted. It cannot be edited; corrections reverse it.', 'Automation'],
  ['ai', '07', 'Explain', 'Reports, VAT and the AI Accountant read from the ledger and cite it.', 'AI explanation'],
];
const flow = () => `
<section class="section" id="how">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">How it works</span><h2 class="h2">Seven steps. Two of them are yours, <span class="dim">and nothing moves past them without you.</span></h2></div>
    <div class="flow">
      ${FLOW.map(([k, n, t, d, who]) => `<div class="flow-step ${k}" data-reveal><span class="dot"></span><span class="k">${n}</span><h3>${t}</h3><p>${d}</p><span class="who">${who}</span></div>`).join('')}
    </div>
    <div class="legend"><span><i class="l-auto"></i> Automation — Acco prepares</span><span><i class="l-human"></i> Your decision — a person approves</span><span><i class="l-ai"></i> AI explanation — read-only, cited</span></div>
  </div>
</section>`;

const storyReview = () => `
<section class="section bg-warm hairline-top" id="review">
  <div class="wrap story wide">
    <div class="story-text">
      <span class="eyebrow">Review before anything is posted</span>
      <h2 class="h2">Check what was read. <span class="dim">Fix what needs fixing.</span></h2>
      <p class="body">The source document sits next to the extracted fields. Deterministic checks run first; the AI suggestion comes with its reasoning; the approval buttons belong to you.</p>
      <ul class="points">
        <li>${I.check}<div><b>Rules before probability</b><span>UIC checksum, VAT number format, IBAN mod-97 and base + VAT = total are decided by validators, not by a model.</span></div></li>
        <li>${I.eye}<div><b>Confidence you can act on</b><span>Each field shows a score and its origin. Anything below 70% or failing a check is highlighted.</span></div></li>
        <li>${I.user}<div><b>Correct, then approve</b><span>Edit fields, regenerate the suggestion, approve or reject. Every step lands in the audit trail.</span></div></li>
      </ul>
    </div>
    <div class="canvas" aria-hidden="true" data-reveal>
      <div class="rv-grid">
        <div class="ui">
          <div class="ui-h"><b>Extracted data</b><span class="conf ok">94%</span></div>
          <div class="ui-fields one">
            <div class="ui-field"><div><b>Supplier</b><strong>Softuer Prima EOOD</strong></div><span class="conf ok">94%</span></div>
            <div class="ui-field"><div><b>UIC</b><strong>204117823</strong></div><span class="conf ok">checked</span></div>
            <div class="ui-field flag"><div><b>Tax base</b><strong>190.00 €</strong></div><span class="conf warn">71%</span></div>
            <div class="ui-field"><div><b>VAT 20%</b><strong>38.00 €</strong></div><span class="conf ok">checked</span></div>
            <div class="ui-field"><div><b>Total</b><strong>228.00 €</strong></div><span class="conf ok">checked</span></div>
            <div class="ui-field bad"><div><b>IBAN</b><strong>BG80 BNBG 9661 1020 3456 7</strong></div><span class="conf err">invalid</span></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">${frDecision('review')}${frSuggestion()}</div>
      </div>
      <span class="callout" style="left:22px;bottom:22px"><i></i> Flagged: below 70% confidence</span>
    </div>
  </div>
</section>`;

const statement = () => `
<section class="section bg-ink on-ink">
  <div class="wrap">
    <div class="sec-head" style="max-width:820px"><span class="eyebrow">Three things that are never confused</span><h2 class="h2">Nothing is posted without a person. <span class="dim">Automation prepares, you decide, the assistant explains.</span></h2></div>
    <div class="defs">
      <div data-reveal><span class="tag-k"><i class="i-auto"></i> Automation</span><h3>Acco prepares</h3><p>Reads documents, verifies identifiers and totals, proposes accounts and VAT treatment, builds registers and reports.</p><p class="ex">In the product: <b>extraction, suggestions, registers</b></p></div>
      <div data-reveal><span class="tag-k"><i class="i-human"></i> Your decision</span><h3>A person approves</h3><p>Only a user with the right role can approve a document, post to the ledger, lock a period or issue an invoice. The AI identity cannot.</p><p class="ex">In the product: <b>approve, post, lock, issue</b></p></div>
      <div data-reveal><span class="tag-k"><i class="i-ai"></i> AI explanation</span><h3>The assistant explains</h3><p>Answers a fixed set of questions from your records, cites the entries it used, and abstains when the data is not there. It reads only.</p><p class="ex">In the product: <b>AI Accountant</b></p></div>
    </div>
  </div>
</section>`;

const storyMoney = () => `
<section class="section" id="position">
  <div class="wrap">
    <div class="split">
      <div class="sec-head"><span class="eyebrow">Receivables, payables, bank</span><h2 class="h2">Know who owes you, what you owe, <span class="dim">and what the bank says.</span></h2></div>
      <p class="lead">Issued invoices become receivables, approved purchase invoices become payables, and imported bank statements are matched against both. Everything by due date, in EUR.</p>
    </div>
    <div class="canvas" aria-hidden="true" data-reveal>
      <div class="collage">
        <div class="c1">${frAR()}</div>
        <div class="c2">${frAging()}</div>
        <div class="c3">${frBankMatch()}</div>
      </div>
    </div>
    <div class="grid-h three" style="margin-top:40px">
      <div>${I.invoice}<b>Receivables from issued invoices</b><p>Sequential numbering, proformas, credit and debit notes; open items and ageing by due date.</p></div>
      <div>${I.clock}<b>Payables from approved purchases</b><p>Posted purchase invoices appear as open payables, grouped by due-date bucket.</p></div>
      <div>${I.bank}<b>Statements matched, never auto-booked</b><p>CSV/XLSX import with duplicate detection; ranked match suggestions you confirm.</p></div>
    </div>
  </div>
</section>`;

const storyTax = () => `
<section class="section bg-warm hairline-top" id="vat">
  <div class="wrap story flip">
    <div class="story-text">
      <span class="eyebrow">Built for Bulgarian VAT and reporting</span>
      <h2 class="h2">Registers and reports computed from the ledger, <span class="dim">not typed into a form.</span></h2>
      <p class="body">Acco follows Bulgarian accounting and VAT rules out of the box: UIC and VAT-number checks, VAT treatments from 20% standard to reverse charge and intra-EU, purchase and sales registers per period, Cyrillic invoice PDFs and SAF-T preparation for the NRA. Every figure traces to a journal line and the document behind it.</p>
      <ul class="points">
        <li>${I.vat}<div><b>VAT registers and period summary</b><span>Purchase and sales registers, output and input VAT, the amount payable or refundable for the month. VIES dataset for intra-EU supplies.</span></div></li>
        <li>${I.chart}<div><b>Management reports</b><span>Trial balance, P&amp;L, general ledger, revenue and expenses by month, cash flow. CSV export.</span></div></li>
        <li>${I.xml}<div><b>SAF-T preparation <span class="tag beta">beta</span></b><span>Dataset validation, XML generation, export history. Binding to the official NRA schema is planned.</span></div></li>
      </ul>
    </div>
    <div class="canvas tint" aria-hidden="true" data-reveal>
      <div style="display:flex;flex-direction:column;gap:14px">${frVatKpis()}${frTB()}</div>
    </div>
  </div>
</section>`;

const ai = () => `
<section class="section bg-tint hairline-top" id="ai-accountant">
  <div class="wrap">
    <div class="split">
      <div class="sec-head"><span class="eyebrow">AI Accountant</span><h2 class="h2">Ask why. Get an answer with sources. <span class="dim">Nothing changes.</span></h2></div>
      <p class="lead">A fixed set of questions about your VAT, receivables, payables and results. Each answer is built from the ledger and the registers, cites the entries it used, and shows a confidence level. When the data is not there, it says so.</p>
    </div>
    <div class="story" style="align-items:start;grid-template-columns:minmax(0,5fr) minmax(0,7fr)">
      <div class="story-text">
        <ul class="points" style="border-top:0;margin-top:0">
          <li>${I.cite}<div><b>Figures come from your records</b><span>The assistant never generates numbers. It reads the journal, the registers and the documents.</span></div></li>
          <li>${I.book}<div><b>Versioned rule cards</b><span>Tax rules are explicit cards with a legal reference and a version. Cards awaiting accountant review are labelled and lower the confidence.</span></div></li>
          <li>${I.ban}<div><b>Read-only by design</b><span>No access to posting, approval, period locking or filing. Every question and answer is written to the audit trail.</span></div></li>
        </ul>
      </div>
      <div data-reveal aria-hidden="true">${frAssistant()}</div>
    </div>
  </div>
</section>`;

const control = () => `
<section class="section" id="control">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">Control and auditability</span><h2 class="h2">Built so you can trust the numbers <span class="dim">and show how you got them.</span></h2></div>
    <div class="grid-h">
      <div data-reveal>${I.shield}<b>Isolation per company</b><p>Each company is separated at the database level. A request outside its context is refused, not just hidden.</p></div>
      <div data-reveal>${I.user}<b>Roles, checked on the server</b><p>Approve, post, lock and issue are tied to roles. The server re-checks every action; the interface only reflects it.</p></div>
      <div data-reveal>${I.book}<b>Corrections by reversal</b><p>A posted entry is never edited. A mistake is corrected with a new, reversing entry, so the history stays visible.</p></div>
      <div data-reveal>${I.cal}<b>Accounting periods</b><p>Lock a period to close it. Posting into a locked period is refused.</p></div>
      <div data-reveal>${I.layers}<b>Documents kept as uploaded</b><p>Source files are stored immutably with versions, so every posting can be traced back to the original document.</p></div>
    </div>
  </div>
</section>`;

const AVAILABLE = [
  ['Document capture and extraction', 'PDF with a text layer and XML invoices, parsed natively'],
  ['OCR for photos and scanned PDFs', 'EU document-AI provider (Azure Document Intelligence, EU region enforced); enabled per deployment', 'beta'],
  ['Review queue with corrections and approval', ''],
  ['Immutable ledger, journal, accounting periods', ''],
  ['Invoicing: numbering, proformas, credit and debit notes', 'Invoice email delivery available; PDF generated on issue'],
  ['Bank import (CSV/XLSX), matching, payments', ''],
  ['VAT registers, period summary, VIES checks and dataset', ''],
  ['Reports: trial balance, P&L, balance sheet, GL, monthly, cash flow', 'CSV export'],
  ['AI Accountant with citations', ''],
  ['SAF-T dataset, validation and XML export', 'Binding to the official NRA schema is planned', 'beta'],
];

const PLANNED = [
  ['Extraction accuracy validation on real scanned invoices', 'Runbook and scoring tool exist; the labelled sample set is being collected'],
  ['Invoice PDF download and PDF attachment in customer emails', 'The PDF is generated and stored; the email currently carries a reference, not the file'],
  ['VAT return export in NRA format', 'DEKLAR / POKUPKI / PRODAGBI files for manual filing'],
  ['Official SAF-T XSD binding', 'Export today validates against the internal dataset schema'],
  ['Two-factor authentication (TOTP)', 'Enrolment from profile settings'],
];

const status = () => `
<section class="section-sm bg-warm hairline-top" id="status">
  <div class="wrap">
    <div class="split"><div class="sec-head"><span class="eyebrow">Honest about status</span><h2 class="h2 h2-sm">What is available today, and what is coming.</h2></div><p class="lead">Only capabilities that exist in the product are listed as available. Anything still being validated is marked beta.</p></div>
    <div class="status-cols">
      <div><h3>Available</h3><ul class="status-list">${AVAILABLE.map(([t, d, k]) => `<li><div><b>${t}</b>${d ? `<span class="d">${d}</span>` : ''}</div><span class="tag ${k === 'beta' ? 'beta' : 'live'}">${k === 'beta' ? 'Beta' : 'Live'}</span></li>`).join('')}</ul></div>
      <div><h3>Planned</h3><ul class="status-list">${PLANNED.map(([t, d]) => `<li><div><b>${t}</b><span class="d">${d}</span></div><span class="tag planned">Planned</span></li>`).join('')}</ul></div>
    </div>
  </div>
</section>`;

const FAQS = [
  ['Getting started', [
    ['Do I need an accountant to use Acco?', 'No. Acco is built so you can keep your own books: it reads documents, proposes the accounting treatment and VAT, and you approve. If you work with an accountant, invite them to the company with their own role (accountant, approver or viewer).'],
    ['What documents can I upload?', 'PDF invoices with a text layer and XML invoices are read directly. Photos and scanned PDFs go through an EU document-AI provider (beta) when it is enabled for your deployment. You can always correct or complete fields in the review screen.'],
    ['Which currency does Acco use?', 'EUR is the functional currency for all amounts, reports and registers.'],
    ['Can several people work in one company?', 'Yes. Users are invited to a company with a role. Roles decide who can approve, post, lock periods or issue invoices, and the server re-checks every action.'],
  ]],
  ['Posting, VAT and AI', [
    ['Does Acco post anything automatically?', 'No. Every posting is approved by a person in the review screen. Bank matches are suggested and confirmed by you. Nothing reaches the ledger on its own.'],
    ['How is VAT handled?', 'The VAT treatment is proposed per document from rules — standard 20%, reduced, zero, exempt, reverse charge, intra-EU — and resolved as of the tax-event date. Purchase and sales registers and the period summary are computed from posted entries.'],
    ['Does Acco submit anything to the NRA?', 'No. Registers, the period summary and the SAF-T export are prepared for you; filing remains your action. An export in the NRA return file format is planned.'],
    ['What does the AI do, and what can it not do?', 'It reads documents, proposes accounts, categories and VAT treatment, and explains figures with citations. It cannot post, approve, lock periods or file. Those actions belong to people and are recorded in the audit trail.'],
    ['What is currently in beta?', 'OCR for photos and scans (an EU document-AI provider, enabled per deployment, accuracy validation on real invoices in progress) and SAF-T XML export (binding to the official NRA schema is planned). Everything else listed as available is in use.'],
  ]],
  ['Records and data', [
    ['Can a posted entry be edited?', 'No. The ledger is append-only. A mistake is corrected with a reversing entry, so what happened stays visible.'],
    ['How are my data protected?', 'Each company is isolated at the database level, the ledger is append-only, and every action is written to a hash-chained audit trail. The document-AI provider used for scans is restricted to EU regions by configuration.'],
    ['What happens to my data at launch?', 'It stays in your company. Early-access companies keep their ledger, documents and history when public plans are introduced.'],
  ]],
  ['Access', [
    ['How does controlled access work?', 'Create an account and upload your first invoice. Acco is being validated with a limited number of companies; pricing is published at launch, and early-access companies see the plans first and keep their data.'],
    ['How much does it cost?', 'Acco is in controlled access and pricing is not public yet. No card is required during early access.'],
  ]],
];

const faqList = (groups, openFirst = true) => groups.map((g, gi) => `<div class="faq-group"><h3>${g[0]}</h3><div class="faq">${g[1].map(([q, a], i) => `<details${openFirst && gi === 0 && i === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div>`).join('');
const faqHome = () => `
<section class="section">
  <div class="wrap-narrow">
    <div class="sec-head"><span class="eyebrow">Questions</span><h2 class="h2">Frequently asked</h2></div>
    ${faqList([FAQS[1], FAQS[2]])}
    <p class="small" style="margin-top:22px"><a class="link" href="/faq">All questions ${I.arrow}</a></p>
  </div>
</section>`;

const cta = (h = 'Start with one invoice.', p = 'Create an account, upload a document and see the suggested posting. The decision, as always, is yours.') => `
<section class="section bg-ink on-ink">
  <div class="wrap cta">
    <div class="sec-head" style="margin-bottom:0"><h2 class="h2">${h}</h2><p class="lead">${p}</p><div class="cta-actions" style="margin-top:8px"><a class="btn btn-ink btn-lg" href="/register">Get started ${I.arrow}</a><a class="btn btn-out btn-lg" href="/features">See the product</a></div></div>
    <div class="cta-side"><p>Controlled access while we validate extraction and VAT on real documents.</p><p>EUR functional currency. Human approval on every posting. Hash-chained audit trail.</p><p><a class="link" style="color:var(--on-ink)" href="/pricing">How access works ${I.arrow}</a></p></div>
  </div>
</section>`;

/* ============================================================================
   Inner pages
   ============================================================================ */
const pageHero = (eyebrow, h1, lead, ctas = '', aside = '') => `
<section class="page-hero${aside ? ' has-aside' : ''}"><div class="wrap inner">
  <div class="ph-text">
    <span class="eyebrow">${eyebrow}</span>
    <h1 class="display">${h1}</h1>
    ${lead ? `<p class="lead">${lead}</p>` : ''}
    ${ctas ? `<div class="hero-cta">${ctas}</div>` : ''}
  </div>
  ${aside ? `<div class="ph-aside">${aside}</div>` : ''}
</div></section>`;

const FEATURE_ROWS = [
  ['capture', '01', 'Capture', 'Every document in, checked and kept.', ['PDF, JPG/PNG and XML invoices, by upload', 'File type and size validation, malware-scan hook', 'Immutable storage with versions; trash with restore', 'Every upload is written to the audit trail'], () => `<div class="canvas" aria-hidden="true">${frUpload()}</div>`, 'white'],
  ['extraction', '02', 'Extraction', 'Fields read with confidence, facts checked by rules.', ['Field-by-field values with confidence and origin', 'UIC checksum, VAT number, IBAN mod-97, base + VAT = total', 'Diagnostics: why a field is empty or was rejected', 'XML parsed natively; scans via an EU document-AI provider (beta)'], () => `<div class="canvas" aria-hidden="true"><div class="rv-grid"><div class="ui"><div class="ui-h"><b>Extracted data</b><span class="conf ok">overall 94%</span></div><div class="ui-fields one"><div class="ui-group">Supplier</div><div class="ui-field"><div><b>Name</b><strong>Softuer Prima EOOD</strong></div><span class="conf ok">94%</span></div><div class="ui-field"><div><b>UIC</b><strong>204117823</strong></div><span class="conf ok">checked</span></div><div class="ui-group">Amounts</div><div class="ui-field flag"><div><b>Tax base</b><strong>190.00 €</strong></div><span class="conf warn">71%</span></div><div class="ui-field"><div><b>VAT 20%</b><strong>38.00 €</strong></div><span class="conf ok">checked</span></div><div class="ui-field"><div><b>Total</b><strong>228.00 €</strong></div><span class="conf ok">checked</span></div></div></div><div>${frPaper('net')}</div></div><span class="callout" style="left:22px;bottom:22px"><i></i> 190.00 + 38.00 = 228.00 · verified by rule</span></div>`, 'white'],
  ['review', '03', 'Review and approve', 'The decision stays with a person.', ['Queue ordered by what needs attention', 'Source document next to the fields; weak fields flagged', 'Correct fields, add missing ones, regenerate the suggestion', 'Approve or reject; only a user with the right role can'], () => `<div class="canvas" aria-hidden="true"><div class="two">${frDecision('review')}${frSuggestion()}</div></div>`, 'white'],
  ['ledger', '04', 'Ledger and periods', 'Balanced, append-only, closeable.', ['Double-entry balance enforced in the database', 'No edits or deletes; corrections are reversing entries', 'Lock a period; posting into it is refused', 'Journal with every entry, line and source document'], () => `<div class="canvas" aria-hidden="true"><div class="stack">${frJournal()}${frPeriods()}</div></div>`, 'warm'],
  ['invoicing', '05', 'Invoicing', 'Issue, number, send.', ['Sequential numbering per series and year', 'Proformas, credit and debit notes, conversion to invoice', 'Catalogue of products and services with VAT codes', 'PDF generated on issue; email delivery (PDF attachment planned)'], () => `<div class="canvas" aria-hidden="true"><div class="ui"><div class="ui-h"><b>Invoices</b><span class="ui-btn ink">New document</span></div><table class="ui-table"><tr><th>Number</th><th>Customer</th><th class="hide-sm">Date</th><th class="hide-sm">Status</th><th class="r">Amount</th></tr><tr><td class="m">2026-0031</td><td class="s">Delta Consult OOD</td><td class="hide-sm">28.09.2026</td><td class="hide-sm"><span class="pill ok">issued</span></td><td class="r">1 800.00 €</td></tr><tr><td class="m">2026-0030</td><td class="s">Beta EOOD</td><td class="hide-sm">22.09.2026</td><td class="hide-sm"><span class="pill ok">issued</span></td><td class="r">360.00 €</td></tr><tr><td class="m">PF-0012</td><td class="s">Gamma AD</td><td class="hide-sm">20.09.2026</td><td class="hide-sm"><span class="pill neu">proforma</span></td><td class="r">2 400.00 €</td></tr><tr><td class="m">CN-0003</td><td class="s">Beta EOOD</td><td class="hide-sm">18.09.2026</td><td class="hide-sm"><span class="pill warn">credit note</span></td><td class="r">-120.00 €</td></tr></table></div></div>`, 'warm'],
  ['banking', '06', 'Bank, receivables, payables', 'Matched, never auto-booked.', ['CSV/XLSX statement import with row-level duplicate detection', 'Ranked match suggestions; you confirm each one', 'Payments and reversals posted to the ledger', 'Open items and ageing for receivables and payables'], () => `<div class="canvas" aria-hidden="true"><div class="stack">${frBankMatch()}<div class="two">${frAR()}<div class="ui ui-w"><div class="wt">Payables <span>View all →</span></div><div class="big">6 380.00 €</div><div class="kv"><span>Current</span><b>4 180.00 €</b></div><div class="kv"><span>Overdue · 3 documents</span><b class="warn">2 200.00 €</b></div></div></div></div></div>`, 'warm'],
  ['vat', '07', 'VAT and SAF-T', 'Bulgarian VAT, from the ledger.', ['Purchase and sales registers per period', 'Period summary: output, input, payable or refundable', 'Treatments: 20%, 9%, 0%, exempt, reverse charge, intra-EU', 'VIES dataset; SAF-T dataset, validation and XML export (beta)'], () => `<div class="canvas tint" aria-hidden="true"><div class="stack">${frVatKpis()}${frSaft()}</div></div>`, 'tint'],
  ['reports', '08', 'Reports', 'Figures that trace to a line.', ['Trial balance and general ledger', 'Profit and loss, balance sheet', 'Revenue and expenses by month, cash flow', 'CSV export of every report'], () => `<div class="canvas tint" aria-hidden="true">${frTB()}</div>`, 'tint'],
  ['assistant', '09', 'AI Accountant', 'Explains. Never posts.', ['Fixed questions about VAT, receivables, payables and results', 'Citations to the journal, registers and documents', 'Confidence level; abstains when data is missing', 'Read-only identity; every question is audited'], () => `<div class="canvas tint" aria-hidden="true">${frAssistant()}</div>`, 'tint'],
];

const BG_POINTS = [
  [I.checkc, 'UIC and VAT number checks', 'Checksum for the UIC (EIK), VAT-number format, IBAN mod-97 — decided by validators before any AI output.'],
  [I.vat, 'Bulgarian VAT treatments', '20% standard, 9% reduced, 0%, exempt, reverse charge, intra-EU, export and import, resolved as of the tax-event date.'],
  [I.book, 'Registers per period', 'Purchase and sales registers and the period summary built from posted entries; VIES dataset for intra-EU supplies.'],
  [I.invoice, 'Invoices the Bulgarian way', 'Sequential numbering per series and year; proformas, credit and debit notes; PDFs typeset in Cyrillic.'],
  [I.xml, 'SAF-T for the NRA', 'Dataset, validation and XML export in beta; binding to the official schema is planned.'],
  [I.scan, 'OCR restricted to EU regions', 'When OCR for scans is enabled, the document-AI provider is limited to EU Azure regions by configuration (beta).'],
];
const bgStrip = () => `
<section class="section bg-ink on-ink" id="bulgaria">
  <div class="wrap">
    <div class="split"><div class="sec-head"><span class="eyebrow">Made for Bulgarian requirements</span><h2 class="h2">European product. <span class="dim">Bulgarian accounting, built in.</span></h2></div><p class="lead">Acco is not a generic ledger with a translation layer. The checks, VAT treatments, registers and exports follow Bulgarian rules, so the work it prepares is the work your accountant expects.</p></div>
    <div class="grid-h three rows2">${BG_POINTS.map(([ic, t, d]) => `<div>${ic}<b>${t}</b><p>${d}</p></div>`).join('')}</div>
  </div>
</section>`;

const featuresBody = () => `
${pageHero('Product', 'Everything Acco does, <span class="dim">in the order the work happens.</span>', 'Nine chapters, each showing the real screen. Planned work is listed separately and labelled.', `<a class="btn btn-ink" href="/register">Get started ${I.arrow}</a><a class="btn btn-out" href="/#how">How it works</a>`,
  `<ol class="chapters">${FEATURE_ROWS.map(([id, n, t]) => `<li><a href="#${id}"><span class="k">${n}</span>${t}</a></li>`).join('')}</ol>`)}
${['white', 'warm', 'tint'].map((bg) => `<section class="section-sm${bg === 'warm' ? ' bg-warm hairline-top' : bg === 'tint' ? ' bg-tint hairline-top' : ''}"><div class="wrap">${FEATURE_ROWS.filter((r) => r[6] === bg).map(([id, n, t, sub, items, frag]) => `<div class="frow" id="${id}"><div class="frow-text"><span class="k">${n} · ${t}</span><h2>${sub}</h2><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></div><div data-reveal>${frag()}</div></div>`).join('')}</div></section>`).join('')}
${bgStrip()}
${status()}
${cta('See the product on your own invoices.', 'Create an account, upload a document and see the suggested posting: upload, review, approve, post.')}`;

const pricingBody = () => `
${pageHero('Pricing', 'Controlled access now. <span class="dim">Public pricing at launch.</span>', 'Acco is opening to a limited number of companies while we validate extraction and the VAT process on real documents. We publish plans when they are final, not before.',
  `<a class="btn btn-ink" href="/register">Create an account ${I.arrow}</a><a class="btn btn-out" href="/features">See the product</a>`)}
<section class="section-sm"><div class="wrap">
  <div class="access" data-reveal>
    <div>
      <span class="eyebrow">Early access</span>
      <h2>The full product, during controlled access.</h2>
      <p class="price">Controlled access <small>pricing announced at launch · no card required</small></p>
      <ul class="checks">
        <li>${I.check}<span>Document capture, extraction, review and approval</span></li>
        <li>${I.check}<span>Immutable ledger, journal, accounting periods</span></li>
        <li>${I.check}<span>Invoicing, banking, receivables and payables</span></li>
        <li>${I.check}<span>VAT registers, reports, SAF-T (beta)</span></li>
        <li>${I.check}<span>AI Accountant with citations</span></li>
        <li>${I.check}<span>EUR functional currency, hash-chained audit trail</span></li>
      </ul>
    </div>
    <div>
      <span class="eyebrow">How access works</span>
      <ol class="steps-v">
        <li><span class="n">1</span><div><b>Create an account</b><span>Registration is open. Set up your company with its UIC and VAT status.</span></div></li>
        <li><span class="n">2</span><div><b>Upload your first invoice</b><span>Review the extracted fields, approve the suggested treatment, post. On your own documents.</span></div></li>
        <li><span class="n">3</span><div><b>Keep the books</b><span>Invoices, bank statements, VAT registers and reports, with every posting approved by you.</span></div></li>
        <li><span class="n">4</span><div><b>Pricing at launch</b><span>Early-access companies see the plans first and keep their data either way.</span></div></li>
      </ol>
    </div>
  </div>
</div></section>
<section class="section-sm bg-warm hairline-top"><div class="wrap">
  <div class="split"><div class="sec-head"><span class="eyebrow">What access means</span><h2 class="h2 h2-sm">Three things you can count on during early access.</h2></div></div>
  <div class="grid-h three">
    <div>${I.layers}<b>The real product, not a demo</b><p>Your company, your documents, your ledger. Everything you post stays yours; nothing is reset at launch.</p></div>
    <div>${I.user}<b>Your data, your decisions</b><p>Human approval on every posting, an immutable ledger and a hash-chained audit trail apply from day one.</p></div>
    <div>${I.cal}<b>No surprises at launch</b><p>Plans are published when they are final. Early-access companies see them first and keep their ledger, documents and history.</p></div>
  </div>
</div></section>
<section class="section-sm"><div class="wrap">
  <div class="split last"><div class="sec-head"><span class="eyebrow">Who it is for</span><h2 class="h2 h2-sm">Sole traders, small companies and the accountants who serve them.</h2></div><p class="lead">If you receive and issue invoices in Bulgaria, file VAT monthly and want to see what was posted and why, Acco is built for you. Accountants can join a client's company with their own role.</p></div>
</div></section>
${faqSection([FAQS[3], FAQS[1]])}
${cta('Want to see Acco on your own documents?', 'Create an account and upload your first invoice. The decision, as always, is yours.')}`;

const faqSection = (groups) => `<section class="section-sm"><div class="wrap-narrow">${faqList(groups, false)}</div></section>`;

const aboutBody = () => `
${pageHero('About', 'Why Acco exists.', 'Because the owner of a small business should not have to choose between running it and fighting invoices, VAT and deadlines.')}
<section class="section-sm"><div class="wrap story">
  <div class="story-text">
    <p class="prose-lg">Manual data entry is slow and mistakes are expensive. Software can do the routine — reading, proposing, explaining — but it must never decide on money or on the state on a person's behalf.</p>
    <p class="body">That rule is built into Acco at every level: in the capability-limited identity the AI runs under, in the roles that gate approval and posting, in the database that refuses an unbalanced or back-dated entry, and in the audit trail that records who did what.</p>
  </div>
  <div class="canvas" aria-hidden="true" data-reveal>${frAudit()}</div>
</div></section>
<section class="section bg-ink on-ink"><div class="wrap">
  <h2 class="statement">Software should assist. <span class="dim">It should not silently decide.</span></h2>
  <div class="defs">
    <div><span class="tag-k"><i class="i-auto"></i> Deterministic first</span><h3>Rules before models</h3><p>Verifiable facts — UIC, VAT number, IBAN, totals, double-entry balance — are decided by validators. A model may read, classify and suggest; it does not get a vote on a checksum.</p></div>
    <div><span class="tag-k"><i class="i-human"></i> A person decides</span><h3>Approval is a human act</h3><p>Nothing is posted and nothing is filed without explicit approval by a user with the right role. The AI identity cannot post, lock a period, issue an invoice or change permissions.</p></div>
    <div><span class="tag-k"><i class="i-ai"></i> Traceable</span><h3>Every figure has a source</h3><p>Every number leads to a journal line and a document; every action leads to a hash-chained audit record. Explanations cite what they used and abstain when the data is not there.</p></div>
  </div>
</div></section>
<section class="section-sm"><div class="wrap">
  <div class="split"><div class="sec-head"><span class="eyebrow">What it takes off your desk</span><h2 class="h2 h2-sm">Less typing. Less guessing. Fewer surprises at month end.</h2></div><p class="lead">The repetitive part of bookkeeping — reading invoices, finding the right account, computing VAT, matching bank lines — is prepared for you. The part that needs judgement stays visible, and stays yours.</p></div>
  <div class="grid-h three">
    <div>${I.scan}<b>Reading and typing</b><p>Fields are extracted with confidence; identifiers and totals are verified; you correct what is flagged instead of retyping everything.</p></div>
    <div>${I.spark}<b>Finding the treatment</b><p>Accounts, expense category and VAT treatment are proposed from rules and per-supplier memory, with the reason shown.</p></div>
    <div>${I.bank}<b>Reconciling</b><p>Bank lines are matched to invoices with a ranked suggestion; you confirm, the ledger records.</p></div>
  </div>
</div></section>
<section class="section-sm bg-warm hairline-top"><div class="wrap-narrow">
  <div class="sec-head"><span class="eyebrow">What Acco does not do</span><h2 class="h2 h2-sm">Some things are deliberately missing.</h2></div>
  <ul class="status-list">
    <li><div><b>No automatic posting</b><span class="d">Every posting is approved by a person, in the review screen.</span></div><span class="tag planned">By design</span></li>
    <li><div><b>No silent changes to records</b><span class="d">Posted entries are never edited. Corrections are new, reversing entries.</span></div><span class="tag planned">By design</span></li>
    <li><div><b>No generated numbers</b><span class="d">The assistant explains figures from the ledger and cites them; it does not produce its own.</span></div><span class="tag planned">By design</span></li>
    <li><div><b>No filing on your behalf</b><span class="d">Registers and exports are prepared for you to file. Direct submission to the NRA is intentionally out of scope.</span></div><span class="tag planned">By design</span></li>
  </ul>
</div></section>
${cta()}`;

const faqBody = () => `
${pageHero('FAQ', 'Questions, answered plainly.', 'About documents, VAT, control and access.')}
<section class="section-sm"><div class="wrap faq-layout">
  <nav class="faq-nav" aria-label="FAQ sections">${FAQS.map((g, i) => `<a href="#faq-${i}">${g[0]}<span>${g[1].length}</span></a>`).join('')}<a class="faq-nav-contact" href="/contact">Contact ${I.arrow}</a></nav>
  <div>${FAQS.map((g, gi) => `<div class="faq-group" id="faq-${gi}"><h2 class="faq-h">${g[0]}</h2><div class="faq">${g[1].map(([q, a], i) => `<details${gi === 0 && i === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div>`).join('')}</div>
</div></section>
${cta()}`;

const contactBody = () => `
${pageHero('Contact', 'A public contact channel <span class="dim">is being set up.</span>', 'Direct contact requests are temporarily unavailable while the public contact channel is being configured. No address is published until it is verified and monitored. Until then, the product itself is the fastest way in.')}
<section class="section-sm"><div class="wrap contact">
  <aside class="contact-side">
    <div><b>Status</b><span>Contact channel: being configured. This page will carry the verified address once it is live.</span></div>
    <div><b>Who Acco is for</b><span>Sole traders and small companies in Bulgaria that receive and issue invoices; accountants who want to run client books in Acco.</span></div>
    <div><b>Legal</b><span>Privacy, terms, cookies and GDPR pages are linked in the footer (currently in Bulgarian).</span></div>
  </aside>
  <div class="contact-paths">
    <a class="path" href="/register">${I.user}<div><b>Create an account</b><span>Registration is open during controlled access. Set up the company and upload your first invoice.</span></div>${I.arrow}</a>
    <a class="path" href="/login">${I.lock}<div><b>Sign in</b><span>Already have a company in Acco? Continue where you left off.</span></div>${I.arrow}</a>
    <a class="path" href="/features">${I.layers}<div><b>See the product</b><span>Nine chapters, each showing the real screen, in the order the work happens.</span></div>${I.arrow}</a>
    <a class="path" href="/faq">${I.cite}<div><b>Read the FAQ</b><span>Documents, VAT, control and access, answered plainly.</span></div>${I.arrow}</a>
  </div>
</div></section>`;

const org = { '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: SITE, logo: `${SITE}/landing/assets/app-icon.svg` };
const PAGES = [
  { key: '/', file: 'index.html', url: '/', title: `${BRAND} · Accounting that prepares the work. You approve it.`,
    desc: 'Acco reads invoices, proposes the accounting treatment and VAT, and posts to an immutable ledger only after a person approves. EUR, Bulgarian VAT built in.',
    jsonld: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: BRAND, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: SITE, inLanguage: 'en', description: 'Accounting software for Bulgarian businesses: document extraction, human review, immutable ledger, VAT and reports.' },
    body: () => hero() + facts() + matrix() + flow() + storyReview() + statement() + storyMoney() + storyTax() + ai() + control() + status() + faqHome() + cta() },
  { key: '/features', file: 'features.html', url: '/features', title: `Product · ${BRAND}`, desc: 'What Acco does today: capture, extraction, review, immutable ledger, invoicing, banking, VAT, reports and the AI Accountant.', jsonld: org, body: featuresBody },
  { key: '/pricing', file: 'pricing.html', url: '/pricing', title: `Pricing · ${BRAND}`, desc: 'Acco is in controlled access; pricing will be published at launch. Request early access.', jsonld: org, body: pricingBody },
  { key: '/about', file: 'about.html', url: '/about', title: `About · ${BRAND}`, desc: 'Why Acco exists: deterministic before AI, a person decides, full traceability.', jsonld: org, body: aboutBody },
  { key: '/faq', file: 'faq.html', url: '/faq', title: `FAQ · ${BRAND}`, desc: 'Frequently asked questions about documents, VAT, control and access.', jsonld: org, body: faqBody },
  { key: '/contact', file: 'contact.html', url: '/contact', title: `Contact · ${BRAND}`, desc: 'How to reach Acco during controlled access. A public contact channel is being set up.', jsonld: org, body: contactBody },
];

for (const p of PAGES) {
  writeFileSync(join(OUT, p.file), head(p) + nav(p.key) + p.body() + footer(), 'utf8');
}
writeFileSync(join(PUB, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((p) => `  <url><loc>${SITE}${p.url}</loc></url>`).join('\n')}\n</urlset>\n`, 'utf8');
writeFileSync(join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /login\nDisallow: /register\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');
console.log(`built ${PAGES.length} pages → ${OUT}`);
