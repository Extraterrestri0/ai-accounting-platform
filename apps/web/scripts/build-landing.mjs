/* ============================================================================
   Static multi-page generator for the Acco marketing site.
   Editorial finance: warm cream + deep forest green + brass/gold.
   Newsreader display · Inter UI · IBM Plex Mono. Faithful port of the Acco
   design export: sticky blurred nav, scroll-reveal, magnetic buttons, parallax
   floating hero cards, FAQ accordion, billing toggle, validated contact form.
   Inline styles preserved for fidelity; hover/focus are real CSS classes
   (.j-dark/.j-out/.j-gold/.lift*) handled in site.css; logic in site.js.
   Run:  node apps/web/scripts/build-landing.mjs
   Output: apps/web/public/landing/*.html + public/sitemap.xml + robots.txt
   ============================================================================ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'public', 'landing');
const PUB = join(__dir, '..', 'public');
const SITE = 'https://mgi-delta.bg';
const BRAND = 'Acco';
const V = 'v=20';
mkdirSync(OUT, { recursive: true });

/* ---- inline SVG icons (stroke = currentColor) ---------------------------- */
const s = (p, w = 1.6) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  arrow: '<span style="font-size:16px;">→</span>',
  upload: s('<path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>'),
  cpu: s('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.3"/>'),
  check: s('<path d="M20 6 9 17l-5-5"/>', 1.8),
  spark: s('<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>'),
  file: s('<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>'),
  bank: s('<path d="M19 5 5 19M9 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>'),
  chart: s('<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/>'),
  wallet: s('<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12h.01M2 10h20"/>'),
  shield: s('<path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>'),
  shieldP: s('<path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3z"/>'),
  ledger: s('<path d="M9 12h6M9 16h6M9 8h6"/><rect x="4" y="3" width="16" height="18" rx="2"/>'),
  globe: s('<circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>'),
  roles: s('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-2-2"/>'),
  user: s('<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 21a7 7 0 0 1 14 0"/>'),
  store: s('<path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6"/>'),
  cart: s('<path d="M3 4h2l2 12h11l2-8H6M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2m9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/>'),
  book: s('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h7"/>'),
  cal: s('<path d="M4 5h16v16H4zM4 9h16M8 3v4M16 3v4"/>'),
  life: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>'),
  mail: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  phone: s('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/>'),
  clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  li: s('<path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4"/>'),
  fb: s('<path d="M14 8h2V5h-2c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2l1-3h-3V8z"/>'),
  menu: s('<path d="M3 7h18M3 12h18M3 17h18"/>', 1.8),
};

/* ---- brand mark ---------------------------------------------------------- */
const LOGO = `<svg width="34" height="34" viewBox="0 0 34 34" fill="none"><rect width="34" height="34" rx="9" fill="#123A33"/><rect x="9" y="17" width="3.4" height="8" rx="1.7" fill="#D9B978"/><rect x="15.3" y="13" width="3.4" height="12" rx="1.7" fill="#D9B978"/><rect x="21.6" y="9" width="3.4" height="16" rx="1.7" fill="#E9C98C"/></svg>`;
const LOGO_F = `<svg width="30" height="30" viewBox="0 0 34 34" fill="none"><rect width="34" height="34" rx="9" fill="#1c4d45"/><rect x="9" y="17" width="3.4" height="8" rx="1.7" fill="#E9C98C"/><rect x="15.3" y="13" width="3.4" height="12" rx="1.7" fill="#E9C98C"/><rect x="21.6" y="9" width="3.4" height="16" rx="1.7" fill="#E9C98C"/></svg>`;

/* ---- shared head --------------------------------------------------------- */
const head = (p) => `<!DOCTYPE html>
<html lang="bg">
<head>
<script>document.documentElement.classList.add('js')</script>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${p.title}</title>
<meta name="description" content="${p.desc}" />
<link rel="canonical" href="${SITE}${p.url}" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${BRAND}" />
<meta property="og:locale" content="bg_BG" />
<meta property="og:title" content="${p.title}" />
<meta property="og:description" content="${p.desc}" />
<meta property="og:url" content="${SITE}${p.url}" />
<meta name="theme-color" content="#123A33" />
<link rel="icon" href="/landing/assets/app-icon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/landing/assets/tokens.css?${V}" />
<link rel="stylesheet" href="/landing/assets/site.css?${V}" />
<script type="application/ld+json">${JSON.stringify(p.jsonld)}</script>
</head>
<body>`;

/* ---- nav + mobile menu --------------------------------------------------- */
const NAVLINKS = [
  ['/features', 'Функции', 'FEATURES'],
  ['/#how', 'Как работи', 'HOW IT WORKS'],
  ['/pricing', 'Цени', 'PRICING'],
  ['/faq', 'Въпроси', 'FAQ'],
];
const nlink = (href, t, sub, on) => on
  ? `<a href="${href}" style="display:flex; flex-direction:column; line-height:1;"><span style="font-size:14px; font-weight:600; color:#123A33; border-bottom:2px solid #A9854E; padding-bottom:2px;">${t}</span><span style="font-size:9px; letter-spacing:.09em; color:#A39B86; margin-top:3px;">${sub}</span></a>`
  : `<a href="${href}" style="display:flex; flex-direction:column; line-height:1;"><span class="ul" style="font-size:14px; font-weight:500; color:#20302B;">${t}</span><span style="font-size:9px; letter-spacing:.09em; color:#A39B86; margin-top:3px;">${sub}</span></a>`;

const mobileMenu = () => `
<div data-mobile-menu style="position:fixed; inset:0; z-index:90; background:rgba(244,239,228,.97); backdrop-filter:blur(8px); flex-direction:column; padding:28px clamp(20px,5vw,72px);">
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:48px;">
    <div style="display:flex; align-items:center; gap:12px;">${LOGO}<span style="font-family:var(--serif); font-size:22px; font-weight:500; color:#123A33;">${BRAND}</span></div>
    <button data-menu-close style="background:none; border:1px solid #D6CCB7; border-radius:999px; width:42px; height:42px; font-size:20px; color:#123A33; cursor:pointer;">✕</button>
  </div>
  <a href="/features" style="font-family:var(--serif); font-size:32px; color:#123A33; padding:14px 0; border-bottom:1px solid #E4DBC9;">Функции</a>
  <a href="/#how" style="font-family:var(--serif); font-size:32px; color:#123A33; padding:14px 0; border-bottom:1px solid #E4DBC9;">Как работи</a>
  <a href="/pricing" style="font-family:var(--serif); font-size:32px; color:#123A33; padding:14px 0; border-bottom:1px solid #E4DBC9;">Цени</a>
  <a href="/faq" style="font-family:var(--serif); font-size:32px; color:#123A33; padding:14px 0; border-bottom:1px solid #E4DBC9;">Въпроси</a>
  <a href="/login" style="font-family:var(--serif); font-size:32px; color:#123A33; padding:14px 0; border-bottom:1px solid #E4DBC9;">Вход</a>
  <a href="/register" style="margin-top:32px; text-align:center; padding:16px; background:#123A33; color:#F4EFE4; border-radius:999px; font-size:16px; font-weight:500;">Започни безплатно</a>
</div>`;

const nav = (active) => `${mobileMenu()}
<nav id="nav" style="position:fixed; top:0; left:0; right:0; z-index:80; display:flex; align-items:center; justify-content:space-between; gap:40px; padding:20px clamp(20px,5vw,72px); border-bottom:1px solid rgba(228,219,201,.7);">
  <a href="/" style="display:flex; align-items:center; gap:12px;">${LOGO}<span style="font-family:var(--serif); font-size:22px; font-weight:500; letter-spacing:-.01em; color:#123A33;">${BRAND}</span></a>
  <div data-nav-links style="display:flex; align-items:center; justify-content:center; flex:1; gap:36px;">
    ${NAVLINKS.map(([h, t, sub]) => nlink(h, t, sub, h === active)).join('')}
  </div>
  <div data-nav-actions style="display:flex; align-items:center; gap:18px;">
    <div style="display:flex; align-items:center; border:1px solid #D6CCB7; border-radius:999px; overflow:hidden; font-size:11px; font-weight:600;"><button type="button" data-lang="bg" class="on" style="border:none; cursor:pointer; padding:5px 11px; background:#123A33; color:#F4EFE4;">BG</button><button type="button" data-lang="en" style="border:none; cursor:pointer; padding:5px 11px; background:transparent; color:#7c857f;">EN</button></div>
    <a href="/login" class="ul" style="font-size:14px; font-weight:500; color:#20302B;">Вход</a>
    <a href="/register" data-magnetic class="j-dark" style="display:inline-flex; align-items:center; gap:8px; padding:11px 21px; background:#123A33; color:#F4EFE4; border-radius:999px; font-size:14px; font-weight:500; white-space:nowrap; box-shadow:0 8px 20px rgba(18,58,51,.18);">Започни безплатно</a>
  </div>
  <button data-nav-menu style="background:none; border:1px solid #D6CCB7; border-radius:999px; width:44px; height:44px; align-items:center; justify-content:center; cursor:pointer; color:#123A33;">${I.menu}</button>
</nav>
<main>`;

/* ---- footer -------------------------------------------------------------- */
const fcol = (h, links) => `<div><div style="font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#7b958d; margin-bottom:16px;">${h}</div><div style="display:flex; flex-direction:column; gap:12px; font-size:14px;">${links.map(([href, t]) => `<a href="${href}" class="ul" style="width:fit-content;">${t}</a>`).join('')}</div></div>`;
const footer = () => `</main>
<footer style="position:relative; padding:clamp(56px,8vh,88px) clamp(20px,5vw,72px) 40px; background:#0F312C; color:#cfe0da; overflow:hidden;">
  <div style="position:absolute; top:-80px; right:6%; width:380px; height:380px; border-radius:50%; background:radial-gradient(circle,rgba(233,201,140,.08),transparent 70%); pointer-events:none;"></div>
  <div style="position:relative; max-width:1180px; margin:0 auto;">
    <div data-foot style="display:grid; grid-template-columns:1.8fr 1fr 1fr 1fr; gap:40px; padding-bottom:44px; border-bottom:1px solid rgba(255,255,255,.1);">
      <div>
        <a href="/" style="display:flex; align-items:center; gap:11px; margin-bottom:18px;">${LOGO_F}<span style="font-family:var(--serif); font-size:21px; color:#F4EFE4;">${BRAND}</span></a>
        <p style="font-size:13.5px; line-height:1.7; color:#9fb6af; max-width:280px; margin:0 0 22px;">AI счетоводство за самонаети, фрийлансъри и малки фирми. От фактура до готов отчет, без ръчно въвеждане.</p>
        <div style="display:inline-flex; align-items:center; gap:8px; padding:8px 13px; border:1px solid rgba(255,255,255,.14); border-radius:999px; font-size:12px; color:#9fb6af;"><span style="width:7px; height:7px; border-radius:50%; background:#16A463;"></span> AI предлага · ти одобряваш</div>
      </div>
      ${fcol('Продукт', [['/features', 'Функции'], ['/pricing', 'Цени'], ['/#how', 'Как работи'], ['/features#security', 'Сигурност']])}
      ${fcol('Ресурси', [['/blog', 'Блог'], ['/resources', 'Ръководства'], ['/faq', 'Въпроси'], ['/contact', 'Помощ']])}
      ${fcol('Компания', [['/about', 'За нас'], ['/contact', 'Контакти'], ['/landing/legal/privacy.html', 'Поверителност'], ['/landing/legal/terms.html', 'Общи условия']])}
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding-top:24px;">
      <div style="font-size:12px; color:#7b958d;">© 2026 ${BRAND} · Всички права запазени</div>
      <div style="display:flex; align-items:center; gap:14px; font-size:12px; color:#7b958d;"><span>Цените са в евро</span><span style="width:4px; height:4px; border-radius:50%; background:#4a655e;"></span><span>Български · English</span></div>
    </div>
  </div>
</footer>
<script src="/landing/assets/i18n.js?${V}" defer></script>
<script src="/landing/assets/site.js?${V}" defer></script>
</body></html>`;

/* ---- shared atoms -------------------------------------------------------- */
const lab = (t) => `<div style="font-size:11px; letter-spacing:.13em; text-transform:uppercase; color:#A9854E; margin-bottom:16px;">${t}</div>`;
const eyebrow = (t) => `<div data-reveal style="position:relative; display:inline-flex; align-items:center; gap:9px; padding:8px 15px; border:1px solid #D9CDB6; border-radius:999px; background:rgba(255,255,255,.55); margin-bottom:28px;"><span style="width:7px; height:7px; border-radius:50%; background:#16A463;"></span><span style="font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#8a6f43;">${t}</span></div>`;
const btnDark = (href, t, big) => `<a href="${href}" data-magnetic class="j-dark" style="display:inline-flex; align-items:center; gap:10px; padding:${big ? '17px 32px' : '16px 28px'}; background:#123A33; color:#F4EFE4; border-radius:999px; font-size:${big ? '16px' : '15px'}; font-weight:500; white-space:nowrap; box-shadow:0 12px 28px rgba(18,58,51,.22);">${t} ${I.arrow}</a>`;
const btnOut = (href, t, big) => `<a href="${href}" class="j-out lift" style="display:inline-flex; align-items:center; gap:9px; padding:${big ? '17px 28px' : '16px 26px'}; border:1px solid #C9BCA1; color:#123A33; border-radius:999px; font-size:${big ? '16px' : '15px'}; font-weight:500; white-space:nowrap;">${t}</a>`;
const secHeadC = (l, h, p) => `<div data-reveal style="max-width:680px; margin:0 auto 54px; text-align:center;">${lab(l)}<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(32px,4vw,52px); line-height:1.08; letter-spacing:-.02em; color:#123A33; margin:0 0 14px;">${h}</h2>${p ? `<p style="font-size:17px; line-height:1.6; color:#5a6a63; margin:0;">${p}</p>` : ''}</div>`;

/* ---- HOME: hero ---------------------------------------------------------- */
const homeHero = () => `
<section id="hero" style="position:relative; padding:148px clamp(20px,5vw,72px) 80px; overflow:hidden;">
  <div id="hero-spot" style="position:absolute; width:620px; height:620px; left:60%; top:30%; transform:translate(-50%,-50%); background:radial-gradient(circle, rgba(201,163,91,.16), transparent 62%); border-radius:50%; pointer-events:none; transition:left .5s var(--ease), top .5s var(--ease);"></div>
  <div style="position:absolute; bottom:-120px; left:-140px; width:460px; height:460px; border-radius:50%; background:radial-gradient(circle, rgba(18,58,51,.06), transparent 70%); pointer-events:none;"></div>
  <div data-hero-grid style="position:relative; max-width:1280px; margin:0 auto; display:grid; grid-template-columns:1.02fr .98fr; gap:56px; align-items:center;">
    <div>
      <div data-reveal style="display:inline-flex; align-items:center; gap:9px; padding:8px 15px; border:1px solid #D9CDB6; border-radius:999px; background:rgba(255,255,255,.55); margin-bottom:30px;"><span style="width:7px; height:7px; border-radius:50%; background:#16A463; animation:pulseDot 2.6s infinite;"></span><span style="font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#8a6f43;">AI счетоводство · България</span></div>
      <h1 data-reveal data-reveal-delay="80" style="font-family:var(--serif); font-weight:400; font-size:clamp(46px,6.4vw,86px); line-height:1.0; letter-spacing:-.025em; color:#123A33; margin:0 0 28px;">От хаос с фактурите<br>към <span style="font-style:italic; color:#A9854E;">спокойни</span> финанси.</h1>
      <p data-reveal data-reveal-delay="160" style="font-size:clamp(16px,1.4vw,19px); line-height:1.65; color:#4a5a53; max-width:480px; margin:0 0 38px;">Снимай документа, AI го разчита, ти одобряваш. Готови ДДС и отчети — води си счетоводството сам, без счетоводител.</p>
      <div data-reveal data-reveal-delay="240" style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:30px;">
        ${btnDark('/register', 'Започни безплатно')}
        <a href="/#how" class="j-out lift" style="display:inline-flex; align-items:center; gap:10px; padding:16px 26px; border:1px solid #C9BCA1; color:#123A33; border-radius:999px; font-size:15px; font-weight:500; white-space:nowrap;"><span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; background:#123A33; color:#E9C98C; font-size:9px;">▶</span> Виж как работи</a>
      </div>
      <div data-reveal data-reveal-delay="320" style="display:flex; align-items:center; gap:20px; font-size:13px; color:#6c776f; flex-wrap:wrap;">
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="color:#16A463;">✓</span> Без банкова карта</span>
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="color:#16A463;">✓</span> 7 дни безплатно</span>
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="color:#16A463;">✓</span> Откажи по всяко време</span>
      </div>
    </div>
    <div data-hero-visual data-reveal="scale" data-reveal-delay="200" style="position:relative; height:560px;">
      <div data-parallax="-0.03" style="position:absolute; top:54%; left:52%; width:520px; height:520px; transform:translate(-50%,-50%); border:1px dashed rgba(169,133,78,.28); border-radius:50%; animation:spinSlow 60s linear infinite; pointer-events:none;"></div>
      <div style="position:absolute; top:54%; left:52%; width:360px; height:360px; transform:translate(-50%,-50%); border:1px solid rgba(18,58,51,.07); border-radius:50%; pointer-events:none;"></div>
      <div data-parallax="0.04" style="position:absolute; top:18px; right:0; width:min(390px,92%); background:#FFFFFF; border:1px solid #EAE0CD; border-radius:18px; box-shadow:0 30px 70px rgba(18,30,26,.18); padding:24px; animation:floatY 8s ease-in-out infinite;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;"><div style="display:flex; align-items:center; gap:9px;"><span style="width:9px; height:9px; border-radius:50%; background:#16A463; animation:pulseDot 2.4s infinite;"></span><span style="font-size:13px; font-weight:600; color:#123A33;">AI извлече данните</span></div><span style="font-size:11px; color:#9aa49e; font-family:var(--mono);">0.8s</span></div>
        <div style="display:flex; align-items:center; justify-content:space-between; padding-bottom:14px; border-bottom:1px solid #F0EADC;"><div><div style="font-size:11px; color:#94a09a; margin-bottom:3px;">Доставчик</div><div style="font-size:14px; font-weight:600; color:#20302B;">ТЕХНО ПЛЮС ООД</div></div><div style="display:flex; gap:5px;"><span style="font-size:10px; font-weight:600; color:#0E8650; background:#ECFBF3; padding:4px 8px; border-radius:999px;">ЕИК ✓</span><span style="font-size:10px; font-weight:600; color:#0E8650; background:#ECFBF3; padding:4px 8px; border-radius:999px;">VIES ✓</span></div></div>
        <div style="display:flex; justify-content:space-between; padding:13px 0 9px; font-size:13px;"><span style="color:#6c776f;">Данъчна основа</span><span style="font-weight:600; font-variant-numeric:tabular-nums; color:#20302B;">1 250,00 €</span></div>
        <div style="display:flex; justify-content:space-between; padding-bottom:13px; font-size:13px; border-bottom:1px solid #F0EADC;"><span style="color:#6c776f;">ДДС 20%</span><span style="font-weight:600; font-variant-numeric:tabular-nums; color:#20302B;">250,00 €</span></div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 0 4px;"><span style="font-size:13px; font-weight:600; color:#123A33;">Общо</span><span style="font-family:var(--serif); font-size:25px; font-weight:500; font-variant-numeric:tabular-nums; color:#123A33;">1 500,00 €</span></div>
        <div style="margin-top:8px; display:flex; align-items:center; gap:8px; padding:9px 12px; background:#FBF8F1; border-radius:9px; font-size:11px; color:#6c776f;"><span style="font-family:var(--mono); color:#A9854E;">Dr</span> 602 Външни услуги <span style="margin-left:auto; font-family:var(--mono); color:#A9854E;">Cr</span> 401 Доставчици</div>
        <div style="margin-top:12px; display:flex; gap:9px;"><span style="flex:1; text-align:center; padding:11px; background:#16A463; color:#fff; border-radius:9px; font-size:13px; font-weight:600;">Одобри и осчетоводи</span><span style="padding:11px 14px; border:1px solid #E4DBC9; color:#6c776f; border-radius:9px; font-size:13px;">защо?</span></div>
      </div>
      <div data-parallax="0.09" style="position:absolute; bottom:30px; left:0; width:210px; background:#123A33; color:#F4EFE4; border-radius:16px; padding:18px 20px; box-shadow:0 22px 46px rgba(18,58,51,.3); animation:floatYlg 7s ease-in-out infinite .3s;"><div style="font-size:11px; color:#9fc3b8; letter-spacing:.04em; margin-bottom:7px;">ДДС за внасяне · май</div><div style="font-family:var(--serif); font-size:32px; font-weight:500; font-variant-numeric:tabular-nums;">1 260 €</div><div style="margin-top:10px; height:5px; border-radius:3px; background:rgba(255,255,255,.16); overflow:hidden;"><div style="width:72%; height:100%; background:#E9C98C; border-radius:3px;"></div></div><div style="margin-top:8px; font-size:10px; color:#86b0a4; font-family:var(--mono);">срок · 14 юни</div></div>
      <div data-parallax="0.13" style="position:absolute; top:120px; left:-8px; display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #EAE0CD; border-radius:999px; padding:8px 14px; box-shadow:0 14px 32px rgba(18,30,26,.13); animation:floatYsm 6.4s ease-in-out infinite .5s;"><span style="width:9px; height:9px; border-radius:50%; background:#16A463;"></span><span style="font-size:12px; font-weight:600; color:#20302B;">Точност 98%</span></div>
      <div data-parallax="0.06" style="position:absolute; bottom:-6px; right:36px; width:172px; background:#FBF8F1; border:1px solid #EAE0CD; border-radius:14px; padding:15px; box-shadow:0 18px 40px rgba(18,30,26,.12); animation:floatYsm 7.6s ease-in-out infinite .9s;"><div style="font-size:11px; color:#94a09a; margin-bottom:10px;">Парично салдо</div><div style="display:flex; align-items:flex-end; gap:5px; height:42px;"><div style="flex:1; height:46%; background:#D9CDB6; border-radius:3px;"></div><div style="flex:1; height:64%; background:#C9B98F; border-radius:3px;"></div><div style="flex:1; height:38%; background:#D9CDB6; border-radius:3px;"></div><div style="flex:1; height:82%; background:#A9854E; border-radius:3px;"></div><div style="flex:1; height:70%; background:#C9B98F; border-radius:3px;"></div><div style="flex:1; height:100%; background:#123A33; border-radius:3px;"></div></div></div>
    </div>
  </div>
</section>`;

/* ---- integrations / trust ------------------------------------------------ */
const intgItem = (ic, name, delay) => `<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''} class="lift-sm" style="display:flex; align-items:center; justify-content:center; gap:11px; height:96px; background:#FBF8F1; border:1px solid #EAE0CD; border-radius:14px; transition:transform .5s var(--ease), box-shadow .5s, border-color .5s;"><span style="width:30px; height:30px; border-radius:8px; background:#EFE7D6; display:flex; align-items:center; justify-content:center; color:#123A33;">${ic}</span><span style="font-size:15px; font-weight:600; letter-spacing:-.01em; color:#3a4843;">${name}</span></div>`;
const integrations = () => `
<section style="position:relative; padding:clamp(56px,7vh,90px) clamp(20px,5vw,72px) clamp(40px,5vh,64px);">
  <div style="max-width:1180px; margin:0 auto;">
    <div data-reveal style="display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap; margin-bottom:34px;">
      <div>${lab('Интеграции')}<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(24px,2.8vw,34px); line-height:1.15; letter-spacing:-.015em; color:#123A33; margin:0; max-width:520px;">Свързва се с инструментите, които вече ползваш.</h2></div>
      <p style="font-size:13.5px; line-height:1.6; color:#8a948e; max-width:260px; margin:0;">Плащания, магазини и таблици — документите идват сами, на едно място.</p>
    </div>
    <div data-4col style="display:grid; grid-template-columns:repeat(4,1fr); gap:14px;">
      ${intgItem(s('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>', 1.7), 'Stripe')}
      ${intgItem(s('<path d="M6 3h9a4 4 0 0 1 0 8H8m-2 10V3m0 10h7a4 4 0 0 1 0 8H6"/>', 1.7), 'PayPal', 60)}
      ${intgItem(s('<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>', 1.7), 'Revolut', 120)}
      ${intgItem(s('<path d="M3 5l4 14 5-9 5 9 4-14"/>', 1.7), 'Wise', 180)}
      ${intgItem(s('<path d="M6 2 4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4z"/><path d="M4 6h16M9 10a3 3 0 0 0 6 0"/>', 1.7), 'Shopify')}
      ${intgItem(s('<circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/><path d="M3 4h2l2 12h11l2-8H6"/>', 1.7), 'WooCommerce', 60)}
      ${intgItem(s('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>', 1.7), 'Microsoft 365', 120)}
      ${intgItem(s('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>', 1.7), 'Google Sheets', 180)}
    </div>
  </div>
</section>`;

/* ---- story: chaos -> calm (before/after) --------------------------------- */
const baBad = (t, d) => `<div style="display:flex; gap:13px; align-items:flex-start;"><span style="color:#D98; margin-top:1px;">✕</span><div><div style="font-size:15px; font-weight:500; color:#3a4843;">${t}</div><div style="font-size:13px; color:#8a948e; margin-top:2px;">${d}</div></div></div>`;
const baOk = (t, d) => `<div style="display:flex; gap:13px; align-items:flex-start;"><span style="color:#86f0bd; margin-top:1px;">✓</span><div><div style="font-size:15px; font-weight:500;">${t}</div><div style="font-size:13px; color:#9fc3b8; margin-top:2px;">${d}</div></div></div>`;
const hr = (c) => `<div style="height:1px; background:${c};"></div>`;
const beforeAfter = () => `
<section style="position:relative; padding:clamp(72px,9vh,120px) clamp(20px,5vw,72px); background:#FBF8F1; border-top:1px solid #E4DBC9; overflow:hidden;">
  <div style="position:absolute; top:0; left:50%; transform:translateX(-50%); width:1px; height:100%; background:linear-gradient(#E4DBC9,transparent); pointer-events:none;"></div>
  <div style="max-width:1180px; margin:0 auto;">
    <div data-reveal style="text-align:center; margin-bottom:54px;">${lab('Защо ' + BRAND)}<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(32px,4vw,52px); line-height:1.08; letter-spacing:-.02em; color:#123A33; margin:0;">Хаосът с документите<br>спира тук.</h2></div>
    <div data-split style="display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:stretch;">
      <div data-reveal="left" class="lift" style="position:relative; background:#FFFFFF; border:1px solid #EAE0CD; border-radius:20px; padding:36px;">
        <div style="display:inline-flex; align-items:center; gap:9px; margin-bottom:24px;"><span style="width:30px; height:30px; border-radius:9px; background:#FDECEC; color:#CB2A2A; display:flex; align-items:center; justify-content:center; font-size:15px;">✕</span><span style="font-size:13px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:#A88;">Без платформа</span></div>
        <div style="display:flex; flex-direction:column; gap:18px;">
          ${baBad('Часове ръчно въвеждане', 'Поле по поле, фактура по фактура.')}${hr('#F0EADC')}
          ${baBad('Фактури, разпилени по имейли', 'Папки, екселски файлове, изгубени документи.')}${hr('#F0EADC')}
          ${baBad('Пропуснати ДДС срокове', 'Глоби и грешки от невнимание.')}${hr('#F0EADC')}
          ${baBad('Зависимост от счетоводител', 'За всяка дребна промяна или въпрос.')}
        </div>
      </div>
      <div data-reveal="right" data-reveal-delay="120" class="lift-d" style="position:relative; background:#123A33; color:#F4EFE4; border:1px solid #123A33; border-radius:20px; padding:36px; overflow:hidden; transition:transform .5s var(--ease), box-shadow .5s;">
        <div style="position:absolute; top:-50px; right:-40px; width:240px; height:240px; border-radius:50%; background:radial-gradient(circle,rgba(233,201,140,.16),transparent 70%); pointer-events:none;"></div>
        <div style="position:relative; display:inline-flex; align-items:center; gap:9px; margin-bottom:24px;"><span style="width:30px; height:30px; border-radius:9px; background:rgba(22,164,99,.2); color:#86f0bd; display:flex; align-items:center; justify-content:center; font-size:14px;">✓</span><span style="font-size:13px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:#9fc3b8;">С ${BRAND}</span></div>
        <div style="position:relative; display:flex; flex-direction:column; gap:18px;">
          ${baOk('AI извлича данните автоматично', 'Снимка или PDF — готово за секунди.')}${hr('rgba(255,255,255,.1)')}
          ${baOk('Всичко на едно място, защитено', 'Архив с одитна следа, данни в ЕС.')}${hr('rgba(255,255,255,.1)')}
          ${baOk('Готови ДДС дневници и декларация', 'Попълват се сами, готови за подаване.')}${hr('rgba(255,255,255,.1)')}
          ${baOk('Управляваш финансите си сам', 'Спокойно, разбираемо, без посредник.')}
        </div>
      </div>
    </div>
  </div>
</section>`;

/* ---- how it works -------------------------------------------------------- */
const howStep = (num, ic, title, body, delay, dark) => `
<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''} style="text-align:center;">
  <div style="width:76px; height:76px; margin:0 auto 26px; border-radius:50%; ${dark ? 'background:#123A33; box-shadow:0 14px 30px rgba(18,58,51,.22);' : 'background:#F4EFE4; border:1px solid #E4DBC9;'} display:flex; align-items:center; justify-content:center; position:relative;"><span style="position:absolute; top:-8px; right:-8px; font-family:var(--mono); font-size:11px; font-weight:500; color:${dark ? '#123A33' : '#fff'}; background:${dark ? '#E9C98C' : '#A9854E'}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${num}</span><span style="color:${dark ? '#E9C98C' : '#123A33'};">${ic}</span></div>
  <h3 style="font-family:var(--serif); font-weight:500; font-size:24px; color:#123A33; margin:0 0 10px;">${title}</h3>
  <p style="font-size:14px; line-height:1.65; color:#5a6a63; margin:0 auto; max-width:260px;">${body}</p>
</div>`;
const how = () => `
<section id="how" style="position:relative; padding:clamp(80px,11vh,140px) clamp(20px,5vw,72px); overflow:hidden;">
  <div style="max-width:1180px; margin:0 auto;">
    <div data-reveal style="max-width:680px; margin:0 auto 64px; text-align:center;">${lab('Как работи')}<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(32px,4.4vw,54px); line-height:1.06; letter-spacing:-.02em; color:#123A33; margin:0 0 16px;">От документ до готов отчет — в три стъпки.</h2><p style="font-size:17px; line-height:1.6; color:#5a6a63; margin:0;">AI върши рутината, ти решаваш важното.</p></div>
    <div style="position:relative;">
      <div style="position:absolute; top:38px; left:14%; right:14%; height:1px; background:repeating-linear-gradient(90deg,#D9CDB6 0 8px,transparent 8px 16px); pointer-events:none;"></div>
      <div data-3col style="display:grid; grid-template-columns:repeat(3,1fr); gap:32px;">
        ${howStep('01', I.upload, 'Качваш', 'Снимка, PDF или XML — както ти е удобно. Или препрати имейл с фактура.')}
        ${howStep('02', I.cpu, 'AI разчита', 'Извлича данните и предлага осчетоводяване срещу националния сметкоплан — винаги с „защо?“.', 140)}
        ${howStep('03', I.check, 'Ти одобряваш', 'Един преглед и готово. ДДС дневниците и отчетите се пълнят сами.', 280, true)}
      </div>
    </div>
  </div>
</section>`;

/* ---- features bento (home) ----------------------------------------------- */
const bento = () => `
<section style="position:relative; padding:clamp(80px,11vh,140px) clamp(20px,5vw,72px); background:#FBF8F1; border-top:1px solid #E4DBC9;">
  <div style="max-width:1180px; margin:0 auto;">
    <div data-reveal style="display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap; margin-bottom:44px;">
      <div>${lab('Какво можеш')}<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(32px,4.2vw,52px); line-height:1.07; letter-spacing:-.02em; color:#123A33; margin:0; max-width:560px;">Всичко за финансите на бизнеса ти.</h2></div>
      <p style="font-size:14px; line-height:1.6; color:#6c776f; max-width:260px; margin:0;">Създадено за самонаети, фрийлансъри и малки фирми в България.</p>
    </div>
    <div data-bento style="display:grid; grid-template-columns:repeat(3,1fr); gap:18px;">
      <div data-reveal class="lift-d" style="grid-column:span 2; background:#123A33; border-radius:20px; padding:34px; color:#F4EFE4; min-height:240px; display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden; transition:transform .5s var(--ease), box-shadow .5s;">
        <div style="position:absolute; top:-50px; right:-30px; width:260px; height:260px; border-radius:50%; background:radial-gradient(circle,rgba(233,201,140,.18),transparent 70%); pointer-events:none;"></div>
        <div style="position:relative; display:flex; align-items:center; justify-content:space-between;"><div style="width:48px; height:48px; border-radius:13px; background:rgba(233,201,140,.14); color:#E9C98C; display:flex; align-items:center; justify-content:center;">${I.spark}</div><span style="font-size:10px; font-family:var(--mono); color:#9fc3b8; border:1px solid rgba(255,255,255,.15); padding:5px 10px; border-radius:999px;">основен модул</span></div>
        <div style="position:relative;"><h3 style="font-family:var(--serif); font-weight:500; font-size:26px; margin:0 0 10px;">AI извличане</h3><p style="font-size:14.5px; line-height:1.6; color:#bcd0c9; margin:0; max-width:380px;">Разчита фактури и документи автоматично — всяко поле с оценка на увереност и детерминирана проверка (ЕИК, VIES, IBAN, Основа + ДДС = Общо).</p></div>
      </div>
      ${bentoCard(I.file, 'Фактуриране', 'Издаване с последователна номерация, PDF и кредитни известия.', 80, 240)}
      ${bentoCard(I.bank, 'ДДС и НАП', 'Дневници и справка-декларация, готови за подаване с КЕП.', 0, 218)}
      ${bentoCard(I.chart, 'Отчети', 'ОПР, баланс и оборотна ведомост, на живо и проследими.', 80, 218, true)}
      <div data-reveal data-reveal-delay="160" class="lift" style="grid-column:span 2; background:#FFFFFF; border:1px solid #EAE0CD; border-radius:20px; padding:34px; min-height:218px; display:flex; align-items:center; justify-content:space-between; gap:24px;">
        <div style="max-width:360px;"><div style="width:46px; height:46px; border-radius:12px; background:#EDF6F1; color:#16A463; display:flex; align-items:center; justify-content:center; margin-bottom:18px;">${I.shield}</div><h3 style="font-family:var(--serif); font-weight:500; font-size:22px; color:#123A33; margin:0 0 8px;">Разходи &amp; сигурен архив</h3><p style="font-size:13.5px; line-height:1.6; color:#5a6a63; margin:0;">Извличане и категоризиране на разходите. Защитено съхранение (WORM), append-only одитна следа, данни в ЕС.</p></div>
        <div style="display:flex; flex-direction:column; gap:10px; min-width:170px;">
          <div style="display:flex; align-items:center; gap:9px; padding:11px 14px; background:#FBF8F1; border:1px solid #F0EADC; border-radius:11px; font-size:12px; color:#3a4843;"><span style="color:#16A463;">✓</span> Хостинг в ЕС</div>
          <div style="display:flex; align-items:center; gap:9px; padding:11px 14px; background:#FBF8F1; border:1px solid #F0EADC; border-radius:11px; font-size:12px; color:#3a4843;"><span style="color:#16A463;">✓</span> Нулево задържане на AI</div>
          <div style="display:flex; align-items:center; gap:9px; padding:11px 14px; background:#FBF8F1; border:1px solid #F0EADC; border-radius:11px; font-size:12px; color:#3a4843;"><span style="color:#16A463;">✓</span> Хеширан одит</div>
        </div>
      </div>
    </div>
  </div>
</section>`;
const bentoCard = (ic, t, d, delay, minh, green) => `<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''} class="lift" style="background:#FFFFFF; border:1px solid #EAE0CD; border-radius:20px; padding:30px; min-height:${minh}px; display:flex; flex-direction:column; justify-content:space-between;"><div style="width:46px; height:46px; border-radius:12px; background:${green ? '#EDF6F1' : '#FAF3E4'}; color:${green ? '#16A463' : '#A9854E'}; display:flex; align-items:center; justify-content:center;">${ic}</div><div><h3 style="font-family:var(--serif); font-weight:500; font-size:22px; color:#123A33; margin:0 0 8px;">${t}</h3><p style="font-size:13.5px; line-height:1.6; color:#5a6a63; margin:0;">${d}</p></div></div>`;

/* ---- deep dive: review queue --------------------------------------------- */
const dvFeat = (ic, t, d, green) => `<div style="display:flex; gap:14px;"><span style="flex:none; width:32px; height:32px; border-radius:9px; background:${green ? '#EDF6F1' : '#FAF3E4'}; color:${green ? '#16A463' : '#A9854E'}; display:flex; align-items:center; justify-content:center;">${ic}</span><div><div style="font-size:15px; font-weight:600; color:#20302B;">${t}</div><div style="font-size:13.5px; color:#6c776f; margin-top:2px;">${d}</div></div></div>`;
const qrow = (sel, name, meta, conf, amount, warn) => `<div style="display:grid; grid-template-columns:auto 1fr auto auto; gap:14px; align-items:center; padding:14px;${sel ? ' border-radius:12px; background:#FBF8F1; border-left:2px solid #16A463;' : ''}${warn ? ' background:#FEF6E7; border-radius:12px;' : ''}"><span style="width:20px; height:20px; border-radius:5px; ${sel ? 'background:#16A463; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px;' : warn ? 'border:1.5px solid #E39B12;' : 'border:1.5px solid #D9CDB6;'}">${sel ? '✓' : ''}</span><div><div style="font-size:13.5px; font-weight:600; color:#20302B;">${name}</div><div style="font-size:11px; color:${warn ? '#9A6406' : '#94a09a'}; font-family:var(--mono);">${meta}</div></div><div style="display:flex; align-items:center; gap:6px;"><span style="width:8px; height:8px; border-radius:50%; background:${warn ? '#E39B12' : '#16A463'};"></span><span style="font-size:12px; font-weight:600; color:${warn ? '#9A6406' : '#0E8650'};">${conf}</span></div><div style="font-size:13.5px; font-weight:600; font-variant-numeric:tabular-nums; color:#20302B;">${amount}</div></div>`;
const deepDive = () => `
<section style="position:relative; padding:clamp(80px,11vh,140px) clamp(20px,5vw,72px); overflow:hidden;">
  <div style="position:absolute; top:10%; right:-10%; width:600px; height:600px; border-radius:50%; background:radial-gradient(circle,rgba(201,163,91,.1),transparent 65%); pointer-events:none; animation:glowPulse 11s ease-in-out infinite;"></div>
  <div data-deep-grid style="position:relative; max-width:1180px; margin:0 auto; display:grid; grid-template-columns:.92fr 1.08fr; gap:56px; align-items:center;">
    <div data-reveal="left">${lab('Прегледай и одобри')}<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(32px,3.8vw,48px); line-height:1.08; letter-spacing:-.02em; color:#123A33; margin:0 0 22px;">Опашка за преглед, в която <span style="font-style:italic; color:#A9854E;">всичко е ясно.</span></h2><p style="font-size:16px; line-height:1.7; color:#4a5a53; margin:0 0 28px; max-width:440px;">AI предлага, ти решаваш. Високата увереност и чистите проверки се одобряват накуп — съмнителното изпъква само̀.</p>
      <div style="display:flex; flex-direction:column; gap:18px; max-width:430px;">
        ${dvFeat(I.check, 'Детерминирани проверки, не само AI', 'ЕИК, VIES, IBAN и Основа + ДДС = Общо.', true)}
        ${dvFeat(s('<path d="M12 3v18M3 12h18"/>', 2), 'Всяко число — проследимо до документ', 'Пълна прозрачност и одитна следа.')}
        ${dvFeat(s('<path d="M5 13l4 4L19 7"/>', 2), 'Одобрение накуп за чистите', 'Висока увереност + без флагове = един клик.', true)}
      </div>
    </div>
    <div data-reveal="right" data-reveal-delay="120" style="position:relative;">
      <div data-parallax="0.03" style="position:relative; background:#FFFFFF; border:1px solid #EAE0CD; border-radius:18px; box-shadow:0 40px 90px rgba(18,30,26,.18); overflow:hidden;">
        <div style="display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid #F0EADC; background:#FBF8F1;"><span style="width:11px; height:11px; border-radius:50%; background:#E4DBC9;"></span><span style="width:11px; height:11px; border-radius:50%; background:#E4DBC9;"></span><span style="width:11px; height:11px; border-radius:50%; background:#E4DBC9;"></span><span style="margin-left:8px; font-size:12px; font-weight:600; color:#123A33;">Опашка за преглед</span><span style="margin-left:auto; font-size:11px; font-family:var(--mono); color:#9aa49e;">7 чакащи</span></div>
        <div style="padding:8px;">
          ${qrow(true, 'ТЕХНО ПЛЮС ООД', 'ф-ра 0512 · 602 Външни услуги', '98%', '1 500,00 €')}
          ${qrow(false, 'Софтуер Прима ЕООД', 'ф-ра 1180 · 651 Абонаменти', '96%', '228,00 €')}
          ${qrow(false, 'Куриер Спиди АД', '⚠ ЕИК за проверка', '74%', '42,60 €', true)}
          ${qrow(false, 'Енерго Про', 'ф-ра 88213 · 602 Ел. енергия', '99%', '316,40 €')}
        </div>
        <div style="display:flex; align-items:center; gap:12px; padding:14px 18px; border-top:1px solid #F0EADC; background:#FBF8F1;"><span style="font-size:12px; color:#6c776f;">3 избрани · чисти проверки</span><span style="margin-left:auto; padding:9px 16px; background:#16A463; color:#fff; border-radius:8px; font-size:12.5px; font-weight:600;">Одобри и осчетоводи 3</span></div>
      </div>
      <div data-parallax="0.1" style="position:absolute; top:-22px; right:-12px; background:#123A33; color:#F4EFE4; padding:10px 15px; border-radius:12px; box-shadow:0 18px 38px rgba(18,58,51,.28); font-size:12px; font-weight:600; animation:floatYsm 6s ease-in-out infinite;">⌘ Bulk approve</div>
    </div>
  </div>
</section>`;

/* ---- stats --------------------------------------------------------------- */
const statCell = (count, dec, suffix, shown, label, delay, last) => `<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''}${last ? '' : ' data-stat-div'} style="text-align:center;${last ? '' : ' border-right:1px solid rgba(255,255,255,.12);'}"><div style="font-family:var(--serif); font-size:clamp(38px,4.6vw,54px); font-weight:500; color:#E9C98C; font-variant-numeric:tabular-nums;"><span data-count="${count}" data-dec="${dec}"${suffix ? ` data-suffix="${suffix}"` : ''}>${shown}</span></div><div style="font-size:13px; color:#a9c2bb; margin-top:8px;">${label}</div></div>`;
const stats = () => `
<section id="stats" style="position:relative; padding:clamp(56px,7vh,84px) clamp(20px,5vw,72px); background:#123A33; color:#F4EFE4; overflow:hidden;">
  <div style="position:absolute; inset:0; background:radial-gradient(120% 100% at 85% 10%, rgba(233,201,140,.12), transparent 55%); pointer-events:none;"></div>
  <div data-stats style="position:relative; max-width:1100px; margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:24px;">
    ${statCell('98.7', '1', '%', '98.7%', 'точност при извличане')}
    ${statCell('12', '0', ' ч', '12 ч', 'спестени на месец', 100)}
    ${statCell('30000', '0', '+', '30 000+', 'обработени документа', 200)}
    ${statCell('4.9', '1', '', '4.9', 'средна оценка', 300, true)}
  </div>
</section>`;

/* ---- testimonials -------------------------------------------------------- */
const tcard = (text, init, name, role, bg, col, delay) => `<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''} class="lift-5" style="background:#fff; border:1px solid #EAE0CD; border-radius:16px; padding:26px; transition:transform .5s var(--ease), box-shadow .5s;"><div style="color:#E9C98C; font-size:14px; margin-bottom:14px;">★★★★★</div><p style="font-size:14.5px; line-height:1.65; color:#3a4843; margin:0 0 18px;">${text}</p><div style="display:flex; align-items:center; gap:10px;"><span style="width:34px; height:34px; border-radius:50%; background:${bg}; color:${col}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600;">${init}</span><div><div style="font-size:13px; font-weight:600; color:#20302B;">${name}</div><div style="font-size:11px; color:#8a948e;">${role}</div></div></div></div>`;
const testimonials = () => `
<section style="position:relative; padding:clamp(80px,11vh,140px) clamp(20px,5vw,72px); background:#FBF8F1; border-top:1px solid #E4DBC9;">
  <div style="max-width:1100px; margin:0 auto;">
    <div data-reveal style="max-width:760px; margin:0 auto 48px; text-align:center;"><div style="font-family:var(--serif); font-size:64px; line-height:0; color:#D9CDB6; height:34px;">&ldquo;</div><p style="font-family:var(--serif); font-weight:400; font-size:clamp(26px,3.2vw,38px); line-height:1.36; letter-spacing:-.01em; color:#123A33; margin:0 0 30px;">Нямам счетоводител. Качвам фактурите, AI ги разчита, аз одобрявам — и ДДС-то ми е готово за минути.</p><div style="display:inline-flex; align-items:center; gap:12px;"><span style="width:44px; height:44px; border-radius:50%; background:#123A33; color:#E9C98C; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:14px;">МД</span><div style="text-align:left;"><div style="font-size:14px; font-weight:600; color:#20302B;">Мартин Делчев</div><div style="font-size:12px; color:#8a948e;">Собственик · онлайн магазин</div></div></div></div>
    <div data-3col style="display:grid; grid-template-columns:repeat(3,1fr); gap:18px;">
      ${tcard('Спестявам цял ден всеки месец. ДДС дневниците просто се пълнят сами.', 'ИС', 'Ивайло Стоянов', 'Фрийлансър · IT', '#EDF6F1', '#16A463')}
      ${tcard('Най-сетне разбирам собствените си финанси. Всичко е проследимо до документа.', 'РК', 'Радост Колева', 'Управител · ЕООД', '#FAF3E4', '#A9854E', 100)}
      ${tcard('Обработвам стотици документи на месец. Бързо, точно и спокойно.', 'ГД', 'Георги Димитров', 'Онлайн магазин', '#EDF6F1', '#16A463', 200)}
    </div>
  </div>
</section>`;

/* ---- FAQ ----------------------------------------------------------------- */
const FAQS = [
  ['Нужен ли ми е счетоводител, за да го ползвам?', `Не. ${BRAND} е създаден да водиш счетоводството си сам — AI разчита документите и предлага осчетоводяване, а ти само одобряваш. Ако работиш със счетоводител, можеш да го поканиш с роля.`],
  ['Сигурни ли са данните ми?', 'Да. Хостингът и обработката са в ЕС, AI услугите са без задържане на данни, а архивът е защитен (WORM) с хеширана одитна следа за всяко действие.'],
  ['Подава ли се ДДС декларацията автоматично?', 'Дневниците и справка-декларацията се попълват сами и са готови за подаване. Самото подаване към НАП винаги е твое решение — потвърждаваш и подписваш с КЕП. AI предлага, ти одобряваш.'],
  ['Работи ли за моя тип бизнес?', 'Създадено е за самонаети, фрийлансъри, малки фирми и ЕООД, както и за онлайн магазини с много документи. Поддържа ЕИК, ДДС режими, националния сметкоплан, коректна кирилица и EUR.'],
  ['Има ли безплатен период?', 'Да, 7 дни пълен достъп без банкова карта. Можеш да изпробваш качване, AI извличане, преглед и отчети с реални документи. Ако не продължиш, нищо не се таксува.'],
  ['Мога ли да прекратя по всяко време?', 'Да. Сменяш плана или прекратяваш по всяко време от настройките, без срокове и неустойки.'],
];
const faqItem = (q, a, open) => `<div data-faq data-open="${open ? '1' : '0'}" style="border-bottom:1px solid #E4DBC9;"><div data-faq-q style="display:flex; align-items:center; justify-content:space-between; gap:16px; padding:24px 0; cursor:pointer;"><span style="font-size:17px; font-weight:600; color:#123A33;">${q}</span><span data-faq-ic style="flex:none; color:#A9854E; font-size:22px;${open ? ' transform:rotate(45deg);' : ''}">+</span></div><div data-faq-a style="${open ? '' : 'max-height:0; opacity:0; '}overflow:hidden;"><p style="font-size:14.5px; line-height:1.7; color:#5a6a63; margin:0 0 24px;">${a}</p></div></div>`;
const faqSplit = (items, title, asH1) => `
<section id="faq" style="position:relative; padding:clamp(80px,11vh,140px) clamp(20px,5vw,72px);">
  <div data-2col style="max-width:1100px; margin:0 auto; display:grid; grid-template-columns:.8fr 1.2fr; gap:48px; align-items:start;">
    <div data-reveal="left" style="position:sticky; top:120px;">${lab('Въпроси')}${asH1 ? `<h1 style="font-family:var(--serif); font-weight:400; font-size:clamp(30px,3.6vw,44px); line-height:1.08; letter-spacing:-.02em; color:#123A33; margin:0 0 18px;">${title}</h1>` : `<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(30px,3.6vw,44px); line-height:1.08; letter-spacing:-.02em; color:#123A33; margin:0 0 18px;">${title}</h2>`}<p style="font-size:15px; line-height:1.65; color:#5a6a63; margin:0 0 22px;">Не намираш отговор? Пиши ни — отговаряме на български, бързо.</p><a href="/contact" class="j-out lift" style="display:inline-flex; align-items:center; gap:9px; padding:13px 22px; border:1px solid #C9BCA1; color:#123A33; border-radius:999px; font-size:14px; font-weight:500;">Свържи се с нас →</a></div>
    <div data-reveal="right" style="display:flex; flex-direction:column;">${items.map(([q, a], i) => faqItem(q, a, i === 0)).join('')}</div>
  </div>
</section>`;

/* ---- final CTA ----------------------------------------------------------- */
const finalCta = () => `
<section style="position:relative; padding:clamp(90px,12vh,150px) clamp(20px,5vw,72px); overflow:hidden; text-align:center; border-top:1px solid #E4DBC9;">
  <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:760px; height:420px; max-width:90vw; background:radial-gradient(ellipse, rgba(201,163,91,.16), transparent 70%); pointer-events:none; animation:glowPulse 9s ease-in-out infinite;"></div>
  <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:420px; height:420px; max-width:80vw; border:1px dashed rgba(169,133,78,.22); border-radius:50%; animation:spinSlow 70s linear infinite; pointer-events:none;"></div>
  <div data-reveal style="position:relative;">
    <div style="display:inline-flex; align-items:center; gap:8px; padding:7px 15px; border:1px solid #D9CDB6; border-radius:999px; background:rgba(255,255,255,.6); margin-bottom:26px;"><span style="width:6px; height:6px; border-radius:50%; background:#16A463;"></span><span style="font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#8a6f43;">7 дни безплатно</span></div>
    <h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(38px,5.4vw,68px); line-height:1.04; letter-spacing:-.025em; color:#123A33; margin:0 0 18px;">Започни да си водиш<br>сметките днес.</h2>
    <p style="font-size:18px; color:#5a6a63; margin:0 0 34px;">Без банкова карта. Без ангажимент. Спокойни финанси от първия документ.</p>
    <div style="display:flex; align-items:center; justify-content:center; gap:14px; flex-wrap:wrap;">${btnDark('/register', 'Започни безплатно', true)}${btnOut('/pricing', 'Виж цените', true)}</div>
  </div>
</section>`;

/* ---- generic page hero (centered) ---------------------------------------- */
const pageHero = (eb, h1, lead, ctas) => `
<section style="position:relative; padding:150px clamp(20px,5vw,72px) 70px; overflow:hidden; text-align:center;">
  <div style="position:absolute; top:-100px; left:50%; transform:translateX(-50%); width:680px; height:560px; max-width:95vw; background:radial-gradient(ellipse, rgba(201,163,91,.14), transparent 66%); pointer-events:none; animation:glowPulse 11s ease-in-out infinite;"></div>
  ${eyebrow(eb)}
  <h1 data-reveal data-reveal-delay="80" style="position:relative; font-family:var(--serif); font-weight:400; font-size:clamp(40px,5.6vw,76px); line-height:1.04; letter-spacing:-.025em; color:#123A33; margin:0 auto 24px; max-width:880px;">${h1}</h1>
  <p data-reveal data-reveal-delay="160" style="position:relative; font-size:clamp(16px,1.4vw,19px); line-height:1.65; color:#4a5a53; max-width:580px; margin:0 auto 34px;">${lead}</p>
  ${ctas ? `<div data-reveal data-reveal-delay="240" style="position:relative; display:flex; align-items:center; justify-content:center; gap:14px; flex-wrap:wrap;">${ctas}</div>` : ''}
</section>`;

/* ---- FEATURES page: alternating feature rows ----------------------------- */
const featChecks = (items) => `<div style="display:flex; flex-direction:column; gap:14px; max-width:430px;">${items.map(([b, r]) => `<div style="display:flex; gap:12px; align-items:flex-start;"><span style="color:#16A463; margin-top:2px;">✓</span><span style="font-size:14.5px; color:#3a4843;"><strong style="color:#20302B;">${b}</strong> — ${r}</span></div>`).join('')}</div>`;
const featText = (num, h2, lead, checks) => `<div data-reveal="left"><div style="display:inline-flex; align-items:center; gap:8px; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#A9854E; margin-bottom:18px;"><span style="width:24px; height:1px; background:#A9854E;"></span>${num}</div><h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(30px,3.6vw,46px); line-height:1.08; letter-spacing:-.02em; color:#123A33; margin:0 0 18px;">${h2}</h2><p style="font-size:16px; line-height:1.7; color:#4a5a53; margin:0 0 26px; max-width:440px;">${lead}</p>${featChecks(checks)}</div>`;
const featRow = (textFirst, alt, anchor, text, media) => `
<section${anchor ? ` id="${anchor}"` : ''} style="position:relative; padding:clamp(64px,8vh,110px) clamp(20px,5vw,72px); border-top:1px solid #E4DBC9;${alt ? ' background:#FBF8F1;' : ''}">
  <div data-feat style="max-width:1180px; margin:0 auto; display:grid; grid-template-columns:${textFirst ? '1fr 1.1fr' : '1.1fr 1fr'}; gap:64px; align-items:center;">
    ${textFirst ? text + media : media + text}
  </div>
</section>`;

const mediaExtract = () => `<div data-reveal="right" data-feat-media style="position:relative;">
  <div style="position:relative; background:#fff; border:1px solid #EAE0CD; border-radius:18px; box-shadow:0 34px 80px rgba(18,30,26,.16); overflow:hidden;">
    <div style="display:flex; gap:0;">
      <div style="width:38%; background:#FBF8F1; border-right:1px solid #F0EADC; padding:18px; display:flex; flex-direction:column; gap:8px;"><div style="font-size:10px; font-family:var(--mono); color:#9aa49e; margin-bottom:4px;">фактура.pdf</div><div style="height:8px; background:#E4DBC9; border-radius:3px; width:80%;"></div><div style="height:8px; background:#EDE6D6; border-radius:3px; width:60%;"></div><div style="height:8px; background:#EDE6D6; border-radius:3px; width:90%;"></div><div style="height:8px; background:#EDE6D6; border-radius:3px; width:50%;"></div><div style="margin-top:auto; height:8px; background:#E4DBC9; border-radius:3px; width:70%;"></div><div style="height:8px; background:#EDE6D6; border-radius:3px; width:40%;"></div></div>
      <div style="flex:1; padding:20px;"><div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;"><span style="width:8px; height:8px; border-radius:50%; background:#16A463; animation:pulseDot 2.4s infinite;"></span><span style="font-size:12px; font-weight:600; color:#123A33;">Извлечени полета</span></div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #F4EEE0;"><span style="font-size:12px; color:#6c776f;">Доставчик</span><span style="display:flex; align-items:center; gap:6px;"><span style="font-size:12.5px; font-weight:600; color:#20302B;">ТЕХНО ПЛЮС</span><span style="width:7px; height:7px; border-radius:50%; background:#16A463;"></span></span></div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #F4EEE0;"><span style="font-size:12px; color:#6c776f;">ЕИК</span><span style="display:flex; align-items:center; gap:6px;"><span style="font-size:12.5px; font-weight:600; color:#20302B; font-variant-numeric:tabular-nums;">204…891</span><span style="font-size:10px; font-weight:600; color:#0E8650; background:#ECFBF3; padding:2px 6px; border-radius:999px;">ЕИК ✓</span></span></div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #F4EEE0;"><span style="font-size:12px; color:#6c776f;">Основа</span><span style="display:flex; align-items:center; gap:6px;"><span style="font-size:12.5px; font-weight:600; color:#20302B; font-variant-numeric:tabular-nums;">1 250,00 €</span><span style="width:7px; height:7px; border-radius:50%; background:#16A463;"></span></span></div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0;"><span style="font-size:12px; color:#6c776f;">ДДС 20%</span><span style="display:flex; align-items:center; gap:6px;"><span style="font-size:12.5px; font-weight:600; color:#20302B; font-variant-numeric:tabular-nums;">250,00 €</span><span style="width:7px; height:7px; border-radius:50%; background:#E39B12;"></span></span></div>
        <div style="margin-top:12px; display:flex; align-items:center; justify-content:center; gap:7px; padding:9px; background:#ECFBF3; border-radius:9px; font-size:11.5px; font-weight:600; color:#0E8650;">Основа + ДДС = Общо ✓</div>
      </div>
    </div>
  </div>
  <div data-parallax="0.08" style="position:absolute; bottom:-18px; left:-14px; display:flex; align-items:center; gap:8px; background:#123A33; color:#F4EFE4; padding:10px 14px; border-radius:12px; box-shadow:0 18px 38px rgba(18,58,51,.28); font-size:12px; font-weight:600; animation:floatYsm 6s ease-in-out infinite;"><span style="width:8px; height:8px; border-radius:50%; background:#86f0bd;"></span> Готово за 0.8 секунди</div>
</div>`;

const mediaInvoice = () => `<div data-reveal="left" data-feat-media style="position:relative;">
  <div style="background:#fff; border:1px solid #EAE0CD; border-radius:18px; box-shadow:0 34px 80px rgba(18,30,26,.16); overflow:hidden;">
    <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #F0EADC;"><span style="font-size:13px; font-weight:600; color:#123A33;">Нова фактура · INV-2026-0042</span><span style="font-size:11px; color:#9aa49e; font-family:var(--mono);">чернова</span></div>
    <div style="padding:20px;">
      <div style="display:grid; grid-template-columns:1fr auto auto; gap:12px; font-size:11px; color:#9aa49e; padding-bottom:8px; border-bottom:1px solid #F4EEE0;"><span>Описание</span><span>Кол.</span><span>Сума</span></div>
      <div style="display:grid; grid-template-columns:1fr auto auto; gap:12px; font-size:12.5px; color:#20302B; padding:11px 0; border-bottom:1px solid #F4EEE0;"><span>Консултантски услуги</span><span style="font-variant-numeric:tabular-nums;">10</span><span style="font-variant-numeric:tabular-nums; font-weight:600;">1 000,00 €</span></div>
      <div style="display:grid; grid-template-columns:1fr auto auto; gap:12px; font-size:12.5px; color:#20302B; padding:11px 0; border-bottom:1px solid #F4EEE0;"><span>Поддръжка · месечна</span><span style="font-variant-numeric:tabular-nums;">1</span><span style="font-variant-numeric:tabular-nums; font-weight:600;">250,00 €</span></div>
      <div style="margin-top:14px; display:flex; justify-content:flex-end;"><div style="width:200px;"><div style="display:flex; justify-content:space-between; font-size:12.5px; color:#6c776f; padding:4px 0;"><span>Нето</span><span style="font-variant-numeric:tabular-nums;">1 250,00 €</span></div><div style="display:flex; justify-content:space-between; font-size:12.5px; color:#6c776f; padding:4px 0; border-bottom:1px solid #F4EEE0;"><span>ДДС 20%</span><span style="font-variant-numeric:tabular-nums;">250,00 €</span></div><div style="display:flex; justify-content:space-between; align-items:baseline; padding:10px 0 2px;"><span style="font-size:12.5px; font-weight:600; color:#123A33;">Общо</span><span style="font-family:var(--serif); font-size:22px; font-weight:500; color:#123A33; font-variant-numeric:tabular-nums;">1 500,00 €</span></div></div></div>
    </div>
    <div style="display:flex; gap:10px; padding:14px 20px; border-top:1px solid #F0EADC; background:#FBF8F1;"><span style="flex:1; text-align:center; padding:10px; background:#123A33; color:#fff; border-radius:8px; font-size:13px; font-weight:600;">Издай фактура</span><span style="padding:10px 14px; border:1px solid #E4DBC9; color:#6c776f; border-radius:8px; font-size:13px;">PDF</span></div>
  </div>
</div>`;

const mediaVat = () => `<div data-reveal="right" data-feat-media style="position:relative;">
  <div style="background:#fff; border:1px solid #EAE0CD; border-radius:18px; box-shadow:0 34px 80px rgba(18,30,26,.16); overflow:hidden;">
    <div style="padding:18px 20px; border-bottom:1px solid #F0EADC; display:flex; align-items:center; justify-content:space-between;"><span style="font-size:13px; font-weight:600; color:#123A33;">Справка-декларация · май 2026</span><span style="font-size:10px; font-family:var(--mono); color:#9A6406; background:#FEF6E7; padding:3px 8px; border-radius:999px;">заключва периода</span></div>
    <div style="padding:20px;">
      <div style="display:flex; justify-content:space-between; font-size:12.5px; color:#6c776f; padding:8px 0; border-bottom:1px solid #F4EEE0;"><span>Начислен ДДС (продажби)</span><span style="font-variant-numeric:tabular-nums; color:#20302B; font-weight:600;">3 420,00 €</span></div>
      <div style="display:flex; justify-content:space-between; font-size:12.5px; color:#6c776f; padding:8px 0; border-bottom:1px solid #F4EEE0;"><span>Данъчен кредит (покупки)</span><span style="font-variant-numeric:tabular-nums; color:#20302B; font-weight:600;">2 160,00 €</span></div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; padding:12px 0 4px;"><span style="font-size:13px; font-weight:600; color:#123A33;">ДДС за внасяне</span><span style="font-family:var(--serif); font-size:24px; font-weight:500; color:#123A33; font-variant-numeric:tabular-nums;">1 260,00 €</span></div>
      <div style="margin-top:14px; padding:13px; background:#FBF8F1; border:1px solid #F0EADC; border-radius:10px; font-size:12px; line-height:1.55; color:#5a6a63;">Подаваш декларацията за <strong style="color:#20302B;">май 2026</strong>: <strong style="color:#20302B;">1 260 € за внасяне</strong>. Това заключва периода.</div>
      <div style="margin-top:14px; display:flex; gap:10px;"><span style="flex:1; text-align:center; padding:13px; background:#0E8650; color:#fff; border-radius:9px; font-size:13.5px; font-weight:600;">Потвърди и подай с КЕП</span></div>
    </div>
  </div>
</div>`;

const mediaReports = () => `<div data-reveal="left" data-feat-media style="position:relative;">
  <div style="background:#fff; border:1px solid #EAE0CD; border-radius:18px; box-shadow:0 34px 80px rgba(18,30,26,.16); overflow:hidden;">
    <div style="padding:18px 20px; border-bottom:1px solid #F0EADC; display:flex; align-items:center; justify-content:space-between;"><span style="font-size:13px; font-weight:600; color:#123A33;">Отчет за приходи и разходи</span><span style="font-size:11px; color:#9aa49e; font-family:var(--mono);">2026 · на живо</span></div>
    <div style="padding:22px 20px;">
      <div style="display:flex; align-items:flex-end; gap:10px; height:120px; margin-bottom:18px;"><div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;"><div style="width:100%; height:54px; background:#E4DBC9; border-radius:5px 5px 0 0;"></div><span style="font-size:9px; color:#9aa49e;">Q1</span></div><div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;"><div style="width:100%; height:78px; background:#C9B98F; border-radius:5px 5px 0 0;"></div><span style="font-size:9px; color:#9aa49e;">Q2</span></div><div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;"><div style="width:100%; height:66px; background:#D9CDB6; border-radius:5px 5px 0 0;"></div><span style="font-size:9px; color:#9aa49e;">Q3</span></div><div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;"><div style="width:100%; height:104px; background:#123A33; border-radius:5px 5px 0 0;"></div><span style="font-size:9px; color:#9aa49e;">Q4</span></div></div>
      <div style="display:flex; justify-content:space-between; font-size:12.5px; color:#6c776f; padding:8px 0; border-bottom:1px solid #F4EEE0;"><span>Приходи</span><span style="font-variant-numeric:tabular-nums; color:#0E8650; font-weight:600;">+ 84 200,00 €</span></div>
      <div style="display:flex; justify-content:space-between; font-size:12.5px; color:#6c776f; padding:8px 0; border-bottom:1px solid #F4EEE0;"><span>Разходи</span><span style="font-variant-numeric:tabular-nums; color:#20302B; font-weight:600;">− 51 680,00 €</span></div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; padding:10px 0 0;"><span style="font-size:13px; font-weight:600; color:#123A33;">Резултат</span><span style="font-family:var(--serif); font-size:22px; font-weight:500; color:#0E8650; font-variant-numeric:tabular-nums;">32 520,00 €</span></div>
    </div>
  </div>
</div>`;

const securityBand = () => `
<section id="security" style="position:relative; padding:clamp(72px,9vh,120px) clamp(20px,5vw,72px); background:#123A33; color:#F4EFE4; overflow:hidden; border-top:1px solid #E4DBC9;">
  <div style="position:absolute; top:-80px; right:6%; width:420px; height:420px; border-radius:50%; background:radial-gradient(circle, rgba(233,201,140,.12), transparent 70%); pointer-events:none; animation:glowPulse 12s ease-in-out infinite;"></div>
  <div style="position:relative; max-width:1180px; margin:0 auto;">
    <div data-reveal style="max-width:640px; margin-bottom:48px;"><div style="font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#E9C98C; margin-bottom:16px;">Сигурност по дизайн</div><h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(30px,3.8vw,48px); line-height:1.08; letter-spacing:-.02em; color:#F4EFE4; margin:0;">Създадено да пази парите ти<br>и спокойствието ти.</h2></div>
    <div data-4col style="display:grid; grid-template-columns:repeat(4,1fr); gap:18px;">
      ${secCard(I.shieldP, 'Неизменен ledger', 'Само сторниращи записи. Нищо не се изтрива тихо.')}
      ${secCard(I.ledger, 'Хеширан одит', 'Append-only следа за всяко действие.', 80)}
      ${secCard(I.globe, 'Поверителност', 'Нулево задържане на данни от AI.', 160)}
      ${secCard(I.roles, 'Роли и достъп', 'Собственик, счетоводител, одобряващ, четец.', 240)}
    </div>
    <div data-reveal style="margin-top:28px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding:18px 22px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:14px;"><span style="font-size:13px; color:#9fc3b8;">Принципът, който не нарушаваме:</span><span style="font-size:14px; font-weight:600; color:#E9C98C;">AI предлага · човек одобрява · ledger-ът е неизменен · всичко е одитирано.</span></div>
  </div>
</section>`;
const secCard = (ic, t, d, delay) => `<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''} class="lift-g" style="background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:16px; padding:26px; transition:transform .5s var(--ease), background .3s;"><div style="color:#86f0bd; margin-bottom:16px;">${ic}</div><h3 style="font-size:15px; font-weight:600; margin:0 0 8px;">${t}</h3><p style="font-size:13px; line-height:1.6; color:#9fc3b8; margin:0;">${d}</p></div>`;

const CAPS = [
  ['Препрати по имейл', 'Изпрати фактура на личния си адрес — влиза директно в опашката.'],
  ['Категоризиране на разходи', 'AI предлага сметка и тип ДДС; ти потвърждаваш с клик.', 60],
  ['Одобрение накуп', 'Чистите документи с висока увереност — на един клик.', 120],
  ['Напомняния за срокове', 'ДДС и плащания — спокойно, навреме, без изненади.'],
  ['AI асистент', 'Обяснява термини и сочи източници — но никога не подава вместо теб.', 60],
  ['Покани счетоводител', 'Работиш сам — или даваш достъп с роля, когато поискаш.', 120],
];
const capabilities = () => `
<section style="position:relative; padding:clamp(72px,9vh,120px) clamp(20px,5vw,72px); border-top:1px solid #E4DBC9;">
  <div style="max-width:1180px; margin:0 auto;">
    <div data-reveal style="text-align:center; max-width:620px; margin:0 auto 48px;">${lab('И още')}<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(30px,3.8vw,48px); line-height:1.08; letter-spacing:-.02em; color:#123A33; margin:0;">Дребните неща, които пестят часове.</h2></div>
    <div data-3col style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px;">
      ${CAPS.map(([t, d, delay]) => `<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''} class="lift" style="background:#FBF8F1; border:1px solid #EAE0CD; border-radius:14px; padding:24px;"><h3 style="font-size:15px; font-weight:600; color:#123A33; margin:0 0 7px;">${t}</h3><p style="font-size:13px; line-height:1.6; color:#5a6a63; margin:0;">${d}</p></div>`).join('')}
    </div>
  </div>
</section>`;

const featuresCta = () => `
<section style="position:relative; padding:clamp(90px,12vh,150px) clamp(20px,5vw,72px); overflow:hidden; text-align:center; background:#FBF8F1; border-top:1px solid #E4DBC9;">
  <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:760px; height:420px; max-width:90vw; background:radial-gradient(ellipse, rgba(201,163,91,.16), transparent 70%); pointer-events:none; animation:glowPulse 9s ease-in-out infinite;"></div>
  <div data-reveal style="position:relative;"><h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(36px,5vw,64px); line-height:1.05; letter-spacing:-.025em; color:#123A33; margin:0 0 18px;">Опитай всяка функция,<br>безплатно.</h2><p style="font-size:18px; color:#5a6a63; margin:0 0 34px;">7 дни. Без банкова карта. Без ангажимент.</p><div style="display:flex; align-items:center; justify-content:center; gap:14px; flex-wrap:wrap;">${btnDark('/register', 'Започни безплатно', true)}${btnOut('/pricing', 'Виж цените', true)}</div></div>
</section>`;

const featuresBody = () => pageHero('Функции · Features', 'Всичко за финансите ти,<br>на едно <span style="font-style:italic; color:#A9854E;">спокойно</span> място.', 'От заснет документ до подадена декларация — всяка стъпка е автоматизирана от AI и потвърдена от теб. Ето какво можеш.', btnDark('/register', 'Започни безплатно') + btnOut('/pricing', 'Виж цените'))
  + featRow(true, false, 'extract', featText('01 · Capture', 'AI извличане, на което<br>можеш да стъпиш.', 'Снимка, PDF или XML — AI разчита всяко поле и предлага осчетоводяване срещу националния сметкоплан. Всяка стойност носи оценка на увереност, а детерминираните проверки имат думата.', [['Увереност за всяко поле', '🟢 високо, 🟠 средно, 🔴 ниско, винаги с процент.'], ['Детерминирани проверки', 'ЕИК, VIES, IBAN и Основа + ДДС = Общо.'], ['Винаги „защо?“', 'всяко предложение обяснява себе си и сочи източник.']]), mediaExtract())
  + featRow(false, true, 'invoicing', featText('02 · Invoicing', 'Фактури, които изглеждат професионално.', 'Издавай фактури, проформи и кредитни известия с последователна номерация и чист PDF. Нето, ДДС и общо се смятат на живо — в EUR, с BGN като отправна стойност.', [['Последователна номерация', 'без пропуски, без дубли.'], ['Двувалутно', 'EUR функционална, BGN до 8 август 2026.'], ['Кредитни и дебитни известия', 'свързани с оригинала.']]), mediaInvoice())
  + featRow(true, false, 'vat', featText('03 · VAT &amp; НАП', 'ДДС, готово за подаване.', 'Дневниците за покупки и продажби и справка-декларацията се попълват сами от осчетоводените документи. Преди да подадеш, виждаш точно какво ще се случи — и подписваш с КЕП.', [['Дневници покупки и продажби', 'автоматично от ledger-а.'], ['Клетки на НАП', 'съпоставени и проверени.'], ['Ти подаваш, не AI', 'потвърждение и подпис с КЕП.']]), mediaVat())
  + featRow(false, true, 'reports', featText('04 · Reports', 'Отчети, които разбираш.', 'ОПР, баланс и оборотна ведомост — на живо, винаги актуални и проследими до документа. Виж как стои бизнесът ти, без да чакаш края на месеца.', [['ОПР, баланс, оборотна ведомост', 'на живо.'], ['Проследимост', 'всяко число води до документа зад него.'], ['Експорт', 'за теб или за счетоводителя ти.']]), mediaReports())
  + securityBand() + capabilities() + featuresCta();

/* ---- PRICING page -------------------------------------------------------- */
const planFeat = (t, off) => `<div style="display:flex; gap:10px; align-items:flex-start; font-size:13.5px; color:${off ? '#8a948e' : '#3a4843'};"><span style="color:${off ? '#C5CEDA' : '#16A463'};">✓</span> ${t}</div>`;
const pricingTiers = () => `
<section style="position:relative; padding:150px clamp(20px,5vw,72px) 50px; overflow:hidden; text-align:center;">
  <div style="position:absolute; top:-100px; left:50%; transform:translateX(-50%); width:680px; height:540px; max-width:95vw; background:radial-gradient(ellipse, rgba(201,163,91,.14), transparent 66%); pointer-events:none; animation:glowPulse 11s ease-in-out infinite;"></div>
  ${eyebrow('Цени · Pricing')}
  <h1 data-reveal data-reveal-delay="80" style="position:relative; font-family:var(--serif); font-weight:400; font-size:clamp(40px,5.6vw,76px); line-height:1.04; letter-spacing:-.025em; color:#123A33; margin:0 auto 22px; max-width:820px;">Прозрачни цени,<br>без <span style="font-style:italic; color:#A9854E;">изненади.</span></h1>
  <p data-reveal data-reveal-delay="160" style="position:relative; font-size:clamp(16px,1.4vw,19px); line-height:1.65; color:#4a5a53; max-width:540px; margin:0 auto 34px;">Една ясна абонаментна цена. Без такси за документ, без скрити условия. Започни безплатно за 7 дни.</p>
  <div data-reveal data-reveal-delay="220" style="position:relative; display:inline-flex; align-items:center; gap:12px;"><div style="display:flex; align-items:center; background:#fff; border:1px solid #E4DBC9; border-radius:999px; padding:5px; box-shadow:0 6px 18px rgba(18,30,26,.06);"><button data-bill="month" style="padding:9px 20px; border:none; background:#123A33; color:#F4EFE4; border-radius:999px; font-size:13.5px; font-weight:600; cursor:pointer;">Месечно</button><button data-bill="year" style="padding:9px 20px; border:none; background:transparent; color:#5a6a63; border-radius:999px; font-size:13.5px; font-weight:600; cursor:pointer;">Годишно</button></div><span style="font-size:12px; font-weight:600; color:#0E8650; background:#ECFBF3; padding:6px 12px; border-radius:999px;">− 20% годишно</span></div>
</section>
<section style="position:relative; padding:8px clamp(20px,5vw,72px) clamp(64px,8vh,100px);">
  <div data-tiers style="max-width:1120px; margin:0 auto; display:grid; grid-template-columns:repeat(3,1fr); gap:20px; align-items:stretch;">
    <div data-reveal class="lift" style="background:#fff; border:1px solid #EAE0CD; border-radius:20px; padding:32px; display:flex; flex-direction:column;">
      <div style="font-family:var(--serif); font-size:24px; color:#123A33; margin-bottom:6px;">Старт</div><p style="font-size:13px; color:#6c776f; margin:0 0 22px;">За самонаети и фрийлансъри.</p>
      <div style="display:flex; align-items:baseline; gap:4px; margin-bottom:4px;"><span style="font-family:var(--serif); font-size:52px; font-weight:500; color:#123A33; font-variant-numeric:tabular-nums;"><span data-price data-m="9" data-a="7">9</span> €</span><span style="font-size:14px; color:#8a948e;">/мес</span></div>
      <div style="font-size:11px; color:#9aa49e; margin-bottom:24px;">без ДДС</div>
      <a href="/register?plan=starter" class="j-out" style="text-align:center; padding:13px; border:1px solid #C9BCA1; color:#123A33; border-radius:999px; font-size:14px; font-weight:600; margin-bottom:24px;">Започни безплатно</a>
      <div style="display:flex; flex-direction:column; gap:13px;">${planFeat('До 50 документа на месец')}${planFeat('AI извличане и осчетоводяване')}${planFeat('Фактуриране и PDF')}${planFeat('1 фирма · 1 потребител')}${planFeat('Имейл поддръжка', true)}</div>
    </div>
    <div data-reveal data-reveal-delay="100" style="position:relative; background:#123A33; border:1px solid #123A33; border-radius:20px; padding:34px 32px; display:flex; flex-direction:column; color:#F4EFE4; box-shadow:0 30px 64px rgba(18,58,51,.26); overflow:hidden;">
      <div style="position:absolute; top:-50px; right:-30px; width:240px; height:240px; border-radius:50%; background:radial-gradient(circle,rgba(233,201,140,.16),transparent 70%); pointer-events:none;"></div>
      <div style="position:relative; display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;"><span style="font-family:var(--serif); font-size:24px; color:#F4EFE4;">Бизнес</span><span style="font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#123A33; background:#E9C98C; padding:5px 10px; border-radius:999px;">Най-избиран</span></div>
      <p style="position:relative; font-size:13px; color:#9fc3b8; margin:0 0 22px;">За малки фирми и ЕООД.</p>
      <div style="position:relative; display:flex; align-items:baseline; gap:4px; margin-bottom:4px;"><span style="font-family:var(--serif); font-size:52px; font-weight:500; color:#F4EFE4; font-variant-numeric:tabular-nums;"><span data-price data-m="19" data-a="15">19</span> €</span><span style="font-size:14px; color:#9fc3b8;">/мес</span></div>
      <div style="position:relative; font-size:11px; color:#86b0a4; margin-bottom:24px;">без ДДС</div>
      <a href="/register?plan=business" data-magnetic class="j-gold" style="position:relative; text-align:center; padding:13px; background:#E9C98C; color:#123A33; border-radius:999px; font-size:14px; font-weight:600; margin-bottom:24px;">Започни безплатно</a>
      <div style="position:relative; display:flex; flex-direction:column; gap:13px;"><div style="display:flex; gap:10px; font-size:13.5px; color:#dceae4;"><span style="color:#86f0bd;">✓</span> До 200 документа на месец</div><div style="display:flex; gap:10px; font-size:13.5px; color:#dceae4;"><span style="color:#86f0bd;">✓</span> Всичко от Старт, плюс:</div><div style="display:flex; gap:10px; font-size:13.5px; color:#dceae4;"><span style="color:#86f0bd;">✓</span> ДДС дневници и декларация (НАП)</div><div style="display:flex; gap:10px; font-size:13.5px; color:#dceae4;"><span style="color:#86f0bd;">✓</span> Отчети на живо · ОПР, баланс, ОВ</div><div style="display:flex; gap:10px; font-size:13.5px; color:#dceae4;"><span style="color:#86f0bd;">✓</span> 1 фирма · до 3 потребители</div><div style="display:flex; gap:10px; font-size:13.5px; color:#dceae4;"><span style="color:#86f0bd;">✓</span> Приоритетна поддръжка</div></div>
    </div>
    <div data-reveal data-reveal-delay="200" class="lift" style="background:#fff; border:1px solid #EAE0CD; border-radius:20px; padding:32px; display:flex; flex-direction:column;">
      <div style="font-family:var(--serif); font-size:24px; color:#123A33; margin-bottom:6px;">Про</div><p style="font-size:13px; color:#6c776f; margin:0 0 22px;">За онлайн магазини и много фирми.</p>
      <div style="display:flex; align-items:baseline; gap:4px; margin-bottom:4px;"><span style="font-family:var(--serif); font-size:52px; font-weight:500; color:#123A33; font-variant-numeric:tabular-nums;"><span data-price data-m="39" data-a="31">39</span> €</span><span style="font-size:14px; color:#8a948e;">/мес</span></div>
      <div style="font-size:11px; color:#9aa49e; margin-bottom:24px;">без ДДС</div>
      <a href="/register?plan=premium" class="j-out" style="text-align:center; padding:13px; border:1px solid #C9BCA1; color:#123A33; border-radius:999px; font-size:14px; font-weight:600; margin-bottom:24px;">Започни безплатно</a>
      <div style="display:flex; flex-direction:column; gap:13px;">${planFeat('Неограничени документи')}${planFeat('Всичко от Бизнес, плюс:')}${planFeat('Много фирми · до 10 потребители')}${planFeat('Роли и достъп · одобряващ, четец')}${planFeat('Експорт и API')}${planFeat('Посветена поддръжка', true)}</div>
    </div>
  </div>
  <p data-reveal style="text-align:center; font-size:13px; color:#8a948e; margin:28px auto 0; max-width:560px;">Всички цени са в евро, без ДДС. Без скрити такси и без такса за документ.</p>
</section>`;

const customPlan = () => `
<section style="position:relative; padding:0 clamp(20px,5vw,72px) clamp(56px,7vh,90px);">
  <div data-reveal="scale" style="position:relative; max-width:1120px; margin:0 auto; background:#123A33; border-radius:24px; overflow:hidden; box-shadow:0 34px 80px rgba(18,58,51,.26);">
    <div style="position:absolute; top:-90px; right:-40px; width:420px; height:420px; border-radius:50%; background:radial-gradient(circle, rgba(233,201,140,.2), transparent 68%); pointer-events:none; animation:glowPulse 12s ease-in-out infinite;"></div>
    <div style="position:absolute; inset:0; background:radial-gradient(120% 100% at 0% 100%, rgba(22,164,99,.12), transparent 55%); pointer-events:none;"></div>
    <div data-2col style="position:relative; display:grid; grid-template-columns:1.25fr .75fr; gap:40px; align-items:center; padding:clamp(32px,4vw,52px);">
      <div>
        <div style="display:inline-flex; align-items:center; gap:9px; padding:7px 14px; border:1px solid rgba(233,201,140,.4); border-radius:999px; background:rgba(233,201,140,.08); margin-bottom:22px;"><span style="width:6px; height:6px; border-radius:50%; background:#E9C98C;"></span><span style="font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#E9C98C;">Индивидуален · Custom</span></div>
        <h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(28px,3.4vw,42px); line-height:1.08; letter-spacing:-.02em; color:#F4EFE4; margin:0 0 14px;">За по-големи екипи и<br>специфични изисквания.</h2>
        <p style="font-size:15.5px; line-height:1.65; color:#bcd0c9; margin:0 0 24px; max-width:480px;">Голям обем документи, много дружества, собствени роли и интеграции. Изграждаме план, който пасва точно на счетоводството ти.</p>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">${['Неограничени дружества', 'SSO и собствени роли', 'Миграция на данни', 'Посветен мениджър & SLA'].map((t) => `<span style="display:inline-flex; align-items:center; gap:7px; font-size:12.5px; color:#dceae4; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); padding:8px 13px; border-radius:999px;"><span style="color:#86f0bd;">✓</span> ${t}</span>`).join('')}</div>
      </div>
      <div style="background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); border-radius:18px; padding:30px; text-align:center;"><div style="font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:#9fc3b8; margin-bottom:8px;">Цена</div><div style="font-family:var(--serif); font-size:34px; font-weight:500; color:#F4EFE4; margin-bottom:6px;">По договаряне</div><p style="font-size:12.5px; color:#9fc3b8; margin:0 0 22px;">Спокоен разговор, ясна оферта.</p><a href="/contact" data-magnetic class="j-gold" style="display:flex; align-items:center; justify-content:center; gap:9px; padding:15px; background:#E9C98C; color:#123A33; border-radius:999px; font-size:15px; font-weight:600; margin-bottom:12px;">Свържи се с нас <span>→</span></a><a href="/contact" style="display:block; font-size:13px; font-weight:500; color:#cfe0da; text-decoration:underline; text-underline-offset:3px;">Заяви оферта</a></div>
    </div>
  </div>
</section>`;

const cmpRow = (label, cells, alt) => `<div style="display:grid; grid-template-columns:1.6fr 1fr 1fr 1fr; align-items:center; padding:15px 22px; border-bottom:1px solid #F0EADC;${alt ? ' background:#FCFAF5;' : ''}"><span style="font-size:13.5px; color:#3a4843;">${label}</span>${cells.map((c) => `<span style="text-align:center; font-size:13px; color:${c === '—' ? '#C5CEDA' : c === '✓' ? '#16A463' : '#20302B'};">${c}</span>`).join('')}</div>`;
const comparison = () => `
<section style="position:relative; padding:clamp(64px,8vh,110px) clamp(20px,5vw,72px); background:#FBF8F1; border-top:1px solid #E4DBC9;">
  <div style="max-width:1000px; margin:0 auto;">
    <div data-reveal style="text-align:center; margin-bottom:44px;">${lab('Сравнение')}<h2 style="font-family:var(--serif); font-weight:400; font-size:clamp(30px,3.8vw,46px); line-height:1.08; letter-spacing:-.02em; color:#123A33; margin:0;">Какво влиза във всеки план.</h2></div>
    <div data-reveal data-cmp style="background:#fff; border:1px solid #EAE0CD; border-radius:18px; overflow:hidden; box-shadow:0 18px 50px rgba(18,30,26,.07);">
      <div style="display:grid; grid-template-columns:1.6fr 1fr 1fr 1fr; align-items:center; padding:18px 22px; background:#123A33; color:#F4EFE4;"><span style="font-size:13px; font-weight:600;">Функция</span><span style="font-size:13px; font-weight:600; text-align:center;">Старт</span><span style="font-size:13px; font-weight:600; text-align:center; color:#E9C98C;">Бизнес</span><span style="font-size:13px; font-weight:600; text-align:center;">Про</span></div>
      ${cmpRow('Документи на месец', ['50', '200', '∞'])}
      ${cmpRow('AI извличане и осчетоводяване', ['✓', '✓', '✓'], true)}
      ${cmpRow('Фактуриране и PDF', ['✓', '✓', '✓'])}
      ${cmpRow('ДДС дневници и декларация (НАП)', ['—', '✓', '✓'], true)}
      ${cmpRow('Отчети на живо · ОПР, баланс, ОВ', ['—', '✓', '✓'])}
      ${cmpRow('Брой фирми', ['1', '1', 'Много'], true)}
      ${cmpRow('Потребители', ['1', '3', '10'])}
      ${cmpRow('Роли и достъп', ['—', '—', '✓'], true)}
      ${cmpRow('Експорт и API', ['—', '—', '✓'])}
      ${cmpRow('Поддръжка', ['Имейл', 'Приоритетна', 'Посветена'], true)}
    </div>
  </div>
</section>`;

const PRICE_FAQ = [
  ['Има ли такса за документ?', `Не. Плащаш една ясна месечна цена според плана. Всеки план включва месечен обем документи — без скрити такси на брой.`],
  ['Мога ли да сменя плана?', 'По всяко време — нагоре или надолу. Промяната влиза веднага, а разликата се изравнява пропорционално.'],
  ['Какво включва безплатният период?', '7 дни пълен достъп до плана Бизнес, без банкова карта. Ако не продължиш, нищо не се таксува.'],
  ['Мога ли да фактурирам в евро?', `Да. ${BRAND} е изцяло в евро — фактури, отчети и декларации са в една валута, без обърквания.`],
];
const pricingBody = () => pricingTiers() + customPlan() + comparison() + faqSplit(PRICE_FAQ, 'Ясно и предвидимо.', false) + finalCta();

/* ---- CONTACT page -------------------------------------------------------- */
const contactInfo = (ic, label, value, green) => `<div style="display:flex; gap:14px; align-items:center;"><span style="flex:none; width:42px; height:42px; border-radius:12px; background:#FBF8F1; border:1px solid #EAE0CD; color:${green ? '#16A463' : '#A9854E'}; display:flex; align-items:center; justify-content:center;">${ic}</span><div><div style="font-size:11px; color:#8a948e;">${label}</div><div style="font-size:15px; font-weight:600; color:#20302B;">${value}</div></div></div>`;
const fieldInput = (name, label, type, ph, full) => `<div style="display:flex; flex-direction:column; gap:8px;${full ? ' margin-bottom:18px;' : ''}"><label style="font-size:12.5px; font-weight:600; color:#3a4843;">${label}</label><input data-field="${name}" type="${type}" placeholder="${ph}" class="fld" style="width:100%; padding:14px 16px; border:1px solid #DCD2BE; border-radius:11px; background:#FCFAF5; font-family:inherit; font-size:15px; color:#20302B;"><span data-err="${name}" style="display:none; font-size:12px; color:#CB2A2A;"></span></div>`;
const contactBody = () => `
<section id="contact" style="position:relative; padding:150px clamp(20px,5vw,72px) clamp(72px,9vh,120px); scroll-margin-top:90px; overflow:hidden;">
  <div style="position:absolute; top:8%; left:-8%; width:480px; height:480px; border-radius:50%; background:radial-gradient(circle, rgba(201,163,91,.1), transparent 66%); pointer-events:none; animation:glowPulse 13s ease-in-out infinite;"></div>
  <div data-2col style="position:relative; max-width:1120px; margin:0 auto; display:grid; grid-template-columns:.85fr 1.15fr; gap:56px; align-items:start;">
    <div data-reveal="left">
      <div style="font-size:11px; letter-spacing:.13em; text-transform:uppercase; color:#A9854E; margin-bottom:16px;">Контакти · Get in touch</div>
      <h1 style="font-family:var(--serif); font-weight:400; font-size:clamp(30px,3.8vw,50px); line-height:1.06; letter-spacing:-.02em; color:#123A33; margin:0 0 18px;">Да поговорим за<br>твоя бизнес.</h1>
      <p style="font-size:16px; line-height:1.7; color:#4a5a53; margin:0 0 34px; max-width:400px;">Кажи ни с какво се занимаваш и какво ти трябва. Връщаме се с ясен отговор — обикновено до един работен ден.</p>
      <div style="display:flex; flex-direction:column; gap:20px;">${contactInfo(I.mail, 'Имейл', '<a href="mailto:hello@mgi-delta.bg" style="color:inherit">hello@mgi-delta.bg</a>')}${contactInfo(I.phone, 'Телефон', '+359 2 555 0100')}${contactInfo(I.clock, 'Отговор', 'До 1 работен ден', true)}</div>
    </div>
    <div data-reveal="right" data-reveal-delay="120" style="position:relative;">
      <form data-contact-form novalidate style="background:#fff; border:1px solid #EAE0CD; border-radius:22px; padding:clamp(26px,3vw,40px); box-shadow:0 30px 70px rgba(18,30,26,.1);">
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:18px; margin-bottom:18px;">${fieldInput('name', 'Пълно име', 'text', 'Иван Петров')}${fieldInput('email', 'Имейл', 'email', 'ivan@firma.bg')}</div>
        ${fieldInput('phone', 'Телефон', 'tel', '+359 88 123 4567', true)}
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:20px;"><label style="font-size:12.5px; font-weight:600; color:#3a4843;">Как можем да помогнем?</label><textarea data-field="message" rows="5" placeholder="Разкажи ни накратко за бизнеса си и какво търсиш…" class="fld" style="width:100%; padding:14px 16px; border:1px solid #DCD2BE; border-radius:11px; background:#FCFAF5; font-family:inherit; font-size:15px; color:#20302B; resize:vertical; min-height:130px;"></textarea><span data-err="message" style="display:none; font-size:12px; color:#CB2A2A;"></span></div>
        <label style="display:flex; gap:12px; align-items:flex-start; cursor:pointer; margin-bottom:24px;"><span data-checkbox style="flex:none; width:22px; height:22px; border:1.5px solid #C9BCA1; border-radius:6px; background:#FCFAF5; display:flex; align-items:center; justify-content:center; margin-top:1px;"><svg data-check-icon width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="opacity:0; transition:opacity .2s;"><path d="M20 6 9 17l-5-5"/></svg></span><input data-field="consent" type="checkbox" style="position:absolute; opacity:0; width:0; height:0;"><span style="font-size:12.5px; line-height:1.6; color:#6c776f;">Съгласен съм личните ми данни да бъдат обработени единствено с цел обратна връзка. Данните не се предоставят на трети страни.</span></label>
        <span data-err="consent" style="display:none; font-size:12px; color:#CB2A2A; margin-bottom:14px;"></span>
        <button type="submit" data-magnetic class="j-dark" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:10px; padding:16px; background:#123A33; color:#F4EFE4; border:none; border-radius:999px; font-family:inherit; font-size:15.5px; font-weight:600; cursor:pointer; box-shadow:0 14px 30px rgba(18,58,51,.22);">Изпрати запитване <span>→</span></button>
      </form>
      <div data-contact-success style="display:none; background:#fff; border:1px solid #C9E8D5; border-radius:22px; padding:48px 40px; text-align:center; box-shadow:0 30px 70px rgba(18,30,26,.1);"><div style="width:64px; height:64px; margin:0 auto 22px; border-radius:50%; background:#ECFBF3; color:#16A463; display:flex; align-items:center; justify-content:center;"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div><h3 style="font-family:var(--serif); font-weight:500; font-size:26px; color:#123A33; margin:0 0 10px;">Благодарим!</h3><p style="font-size:15px; line-height:1.65; color:#5a6a63; margin:0;">Получихме запитването ти и ще се свържем до един работен ден.</p></div>
    </div>
  </div>
</section>`;

/* ---- ABOUT / AUDIENCE / BLOG / RESOURCES --------------------------------- */
const audienceCard = (ic, t, d, delay) => `<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''} class="lift" style="background:#FBF8F1; border:1px solid #EAE0CD; border-radius:16px; padding:28px;"><div style="width:46px; height:46px; border-radius:12px; background:#FAF3E4; color:#A9854E; display:flex; align-items:center; justify-content:center; margin-bottom:16px;">${ic}</div><h3 style="font-family:var(--serif); font-weight:500; font-size:20px; color:#123A33; margin:0 0 7px;">${t}</h3><p style="font-size:13.5px; line-height:1.6; color:#5a6a63; margin:0;">${d}</p></div>`;
const aboutBody = () => pageHero('За нас · About', `Защо създадохме <span style="font-style:italic; color:#A9854E;">${BRAND}</span>.`, 'Вярваме, че собственикът на малък бизнес не трябва да избира между това да върти бизнеса си и да се бори с фактури и ДДС.', btnDark('/register', 'Започни безплатно') + btnOut('/pricing', 'Виж цените'))
  + `<section style="position:relative; padding:clamp(40px,5vh,70px) clamp(20px,5vw,72px) clamp(64px,8vh,110px);"><div data-deep-grid style="max-width:1180px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:48px;">
      <div data-reveal="left" class="lift" style="background:#123A33; color:#F4EFE4; border-radius:20px; padding:36px; overflow:hidden; position:relative; transition:transform .5s var(--ease), box-shadow .5s;"><div style="position:absolute; top:-50px; right:-40px; width:240px; height:240px; border-radius:50%; background:radial-gradient(circle,rgba(233,201,140,.16),transparent 70%);"></div><div style="position:relative;"><div style="font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#E9C98C; margin-bottom:14px;">Нашата мисия</div><h2 style="font-family:var(--serif); font-weight:400; font-size:28px; line-height:1.15; color:#F4EFE4; margin:0 0 14px;">Счетоводство, което всеки разбира.</h2><p style="font-size:15px; line-height:1.7; color:#bcd0c9; margin:0;">Да направим счетоводството разбираемо и автоматично за малките фирми, фрийлансърите и самонаетите в България — с AI, който върши рутината, и човек, който решава важното.</p></div></div>
      <div data-reveal="right" data-reveal-delay="120" class="lift" style="background:#fff; border:1px solid #EAE0CD; border-radius:20px; padding:36px;"><div style="font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#A9854E; margin-bottom:14px;">За кого е</div><h2 style="font-family:var(--serif); font-weight:400; font-size:28px; line-height:1.15; color:#123A33; margin:0 0 14px;">За хора, които искат контрол.</h2><p style="font-size:15px; line-height:1.7; color:#4a5a53; margin:0;">За самонаети, фрийлансъри и малки фирми, които искат да управляват финансите на бизнеса си сами, без да плащат на счетоводител. Платформата говори български, мисли в евро и спазва изискванията на НАП.</p></div>
    </div></section>`
  + `<section style="position:relative; padding:0 clamp(20px,5vw,72px) clamp(72px,9vh,120px);"><div style="max-width:1180px; margin:0 auto;">${secHeadC('За кого е', 'Създадено за хора като теб.', '')}<div data-4col style="display:grid; grid-template-columns:repeat(4,1fr); gap:18px;">${audienceCard(I.user, 'Самонаети', 'Фактури, ДДС и отчети за минути.')}${audienceCard(I.spark, 'Фрийлансъри', 'Следи приходите без счетоводител.', 60)}${audienceCard(I.store, 'Малки фирми и ЕООД', 'Пълно счетоводство, самостоятелно.', 120)}${audienceCard(I.cart, 'Онлайн магазини', 'Много документи, обработени бързо.', 180)}</div></div></section>`
  + stats() + finalCta();

const BLOG = [
  ['blog-1.jpg', 'ДДС', 'ДДС за начинаещи: как да подадете първата си справка-декларация без грешки'],
  ['blog-2.jpg', 'Счетоводство', 'Неизменяема главна книга: защо сторното е по-добро от изтриването'],
  ['blog-3.jpg', 'Бизнес растеж', '5 признака, че е време да автоматизирате счетоводството си'],
  ['blog-4.jpg', 'Данъци', 'Данъчен календар 2026: ключовите срокове за всеки собственик'],
  ['blog-5.jpg', 'Съответствие', 'Преходът към евро: какво да очаквате'],
];
const blogBody = () => pageHero('Блог · Blog', 'От блога.', 'Практични статии за счетоводство, ДДС и растеж на бизнеса.', '')
  + `<section style="position:relative; padding:0 clamp(20px,5vw,72px) clamp(72px,9vh,120px);"><div style="max-width:1180px; margin:0 auto;"><div data-3col style="display:grid; grid-template-columns:repeat(3,1fr); gap:18px;">${BLOG.map(([img, cat, t], i) => `<a data-reveal${i ? ` data-reveal-delay="${(i % 3) * 80}"` : ''} class="lift" href="/contact" style="background:#fff; border:1px solid #EAE0CD; border-radius:18px; overflow:hidden; display:flex; flex-direction:column;"><div style="aspect-ratio:16/10; background:#EFE7D6; overflow:hidden;"><img src="/landing/assets/img/${img}" alt="" loading="lazy" width="640" height="400" style="width:100%; height:100%; object-fit:cover;"></div><div style="padding:24px;"><div style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#A9854E; margin-bottom:10px;">${cat}</div><h3 style="font-family:var(--serif); font-weight:500; font-size:19px; line-height:1.3; color:#123A33; margin:0;">${t}</h3></div></a>`).join('')}</div></div></section>`
  + finalCta();

const RES = [
  [I.book, 'Ръководства', 'Стъпка по стъпка през ДДС, фактури и осчетоводяване.'],
  [I.cal, 'Данъчен календар', 'Всички срокове за ДДС и данъци за 2026.'],
  [I.file, 'Шаблони', 'Готови шаблони за фактури, протоколи и справки.'],
  [I.life, 'Помощен център', 'База знания и отговори на често задавани въпроси.'],
  [I.chart, 'Контролни списъци', 'Месечни и годишни чеклисти за изряден бизнес.'],
  [I.spark, 'Видео уроци', 'Кратки видеа как да свършите всяка задача.'],
];
const resCard = (ic, t, d, delay) => `<div data-reveal${delay ? ` data-reveal-delay="${delay}"` : ''} class="lift" style="background:#FBF8F1; border:1px solid #EAE0CD; border-radius:16px; padding:28px;"><div style="width:46px; height:46px; border-radius:12px; background:#FAF3E4; color:#A9854E; display:flex; align-items:center; justify-content:center; margin-bottom:16px;">${ic}</div><h3 style="font-family:var(--serif); font-weight:500; font-size:20px; color:#123A33; margin:0 0 7px;">${t}</h3><p style="font-size:13.5px; line-height:1.6; color:#5a6a63; margin:0;">${d}</p></div>`;
const resourcesBody = () => pageHero('Ресурси · Resources', 'Ресурси, които работят за теб.', 'Ръководства, шаблони и инструменти за счетоводство, ДДС и данъци.', '')
  + `<section style="position:relative; padding:0 clamp(20px,5vw,72px) clamp(72px,9vh,120px);"><div style="max-width:1180px; margin:0 auto;"><div data-3col style="display:grid; grid-template-columns:repeat(3,1fr); gap:18px;">${RES.map(([ic, t, d], i) => resCard(ic, t, d, (i % 3) * 80)).join('')}</div></div></section>`
  + finalCta();

const faqBody = () => pageHero('Въпроси · FAQ', 'Често задавани въпроси.', 'Отговори за безплатния период, сигурността, ДДС, фактурите и работата без счетоводител.', '')
  + faqSplit(FAQS, 'Често задавани въпроси.', false) + finalCta();

const homeBody = () => homeHero() + integrations() + beforeAfter() + how() + bento() + deepDive() + stats() + testimonials() + faqSplit(FAQS, 'Често задавани въпроси.', false) + finalCta();

/* ---- pages --------------------------------------------------------------- */
const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.n, item: SITE + it.u })) });

const PAGES = [
  { key: '/', file: 'index.html', url: '/',
    title: `Счетоводство без счетоводител · ${BRAND} · за малки фирми и самонаети`,
    desc: `Води си счетоводството сам. ${BRAND} автоматизира фактури, ДДС, разходи и отчети с AI — за самонаети, фрийлансъри и малки фирми в България.`,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE },
    body: homeBody() },
  { key: '/features', file: 'features.html', url: '/features', title: `Функции · ${BRAND}`,
    desc: 'AI извличане, фактуриране, ДДС и НАП, отчети, разходи и сигурен архив — всичко, за да водите счетоводството си сами.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Функции', u: '/features' }]),
    body: featuresBody() },
  { key: '/pricing', file: 'pricing.html', url: '/pricing', title: `Цени и планове · ${BRAND}`,
    desc: 'Прозрачни планове Старт, Бизнес, Про и Индивидуален. 7-дневен безплатен период, без банкова карта.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Цени', u: '/pricing' }]),
    body: pricingBody() },
  { key: '/about', file: 'about.html', url: '/about', title: `За нас · ${BRAND}`,
    desc: `Защо създадохме ${BRAND} — автоматизирано счетоводство за самонаети, фрийлансъри и малки фирми в България.`,
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'За нас', u: '/about' }]),
    body: aboutBody() },
  { key: '/blog', file: 'blog.html', url: '/blog', title: `Блог · счетоводство, ДДС и данъци · ${BRAND}`,
    desc: 'Практични статии за счетоводство, ДДС, данъци и растеж на бизнеса в България.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Блог', u: '/blog' }]),
    body: blogBody() },
  { key: '/resources', file: 'resources.html', url: '/resources', title: `Ресурси · ръководства и шаблони · ${BRAND}`,
    desc: 'Ръководства, шаблони, данъчен календар и помощен център за счетоводство и ДДС в България.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Ресурси', u: '/resources' }]),
    body: resourcesBody() },
  { key: '/faq', file: 'faq.html', url: '/faq', title: `Често задавани въпроси · ${BRAND}`,
    desc: 'Отговори за безплатния период, сигурността, ДДС, фактури и работа без счетоводител.',
    jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    body: faqBody() },
  { key: '/contact', file: 'contact.html', url: '/contact', title: `Контакти · ${BRAND}`,
    desc: `Свържете се с екипа на ${BRAND} — въпроси, демо и поддръжка на български.`,
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Контакти', u: '/contact' }]),
    body: contactBody() },
];

for (const p of PAGES) {
  writeFileSync(join(OUT, p.file), head(p) + nav(p.key) + p.body + footer(), 'utf8');
  console.log('wrote landing/' + p.file);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${SITE}${p.url}</loc><changefreq>weekly</changefreq><priority>${p.url === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>`;
writeFileSync(join(PUB, 'sitemap.xml'), sitemap, 'utf8');
writeFileSync(join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');
console.log('wrote sitemap.xml + robots.txt');
