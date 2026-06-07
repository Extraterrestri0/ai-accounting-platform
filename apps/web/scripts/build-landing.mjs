/* ============================================================================
   Static multi-page generator for the MGI-Delta marketing site.
   Single source for the shared header/footer/SEO; distributes sections across
   real pages. Run:  node apps/web/scripts/build-landing.mjs
   Output: apps/web/public/landing/*.html  +  public/sitemap.xml + public/robots.txt
   Clean URLs (/pricing, /features, …) are mapped in next.config.mjs rewrites.
   ============================================================================ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'public', 'landing');
const PUB = join(__dir, '..', 'public');
const SITE = 'https://mgi-delta.bg'; // TODO: set the real production domain (used for canonical/OG/sitemap)

mkdirSync(OUT, { recursive: true });

// ---- shared HEAD ----------------------------------------------------------
const head = (p) => `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${p.title}</title>
<meta name="description" content="${p.desc}" />
<link rel="canonical" href="${SITE}${p.url}" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="MGI-Delta" />
<meta property="og:locale" content="bg_BG" />
<meta property="og:title" content="${p.title}" />
<meta property="og:description" content="${p.desc}" />
<meta property="og:url" content="${SITE}${p.url}" />
<meta property="og:image" content="${SITE}/landing/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#2F7BE0" />
<link rel="icon" href="/landing/assets/app-icon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preconnect" href="https://unpkg.com" crossorigin />
<link rel="stylesheet" href="/landing/assets/tokens.css?v=13" />
<link rel="stylesheet" href="/landing/assets/site.css?v=13" />
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js" defer></script>
<script type="application/ld+json">${JSON.stringify(p.jsonld)}</script>
</head>
<body lang="bg">
<div class="scroll-progress" aria-hidden="true"></div>`;

// active = key of current page for nav highlighting
const nav = (active) => {
  const cur = (k) => (k === active ? ' aria-current="page" class="nav-link is-active"' : ' class="nav-link"');
  return `
<header class="nav" id="nav">
  <div class="nav-inner">
    <a class="brand" href="/" aria-label="Счетоводство · начало">
      <img class="mark" src="/landing/assets/app-icon.svg" alt="" width="38" height="38" />
      <span class="wm"><b>Счетоводство</b><span>AI ACCOUNTING</span></span>
    </a>
    <nav class="nav-links" aria-label="Основна навигация">
      <div class="has-dd">
        <a${cur('features')} href="/features">Функции <i class="chev" data-lucide="chevron-down"></i></a>
        <div class="dd-panel dd-feat">
          <a class="dd-item" href="/features#dive-ai"><span class="ic"><i data-lucide="sparkles"></i></span><span><b>AI извличане</b><span>Разчита фактури и документи</span></span></a>
          <a class="dd-item" href="/features#dive-vat"><span class="ic"><i data-lucide="landmark"></i></span><span><b>ДДС и НАП</b><span>Регистри, декларация, подаване</span></span></a>
          <a class="dd-item" href="/features#dive-invoice"><span class="ic"><i data-lucide="file-text"></i></span><span><b>Фактуриране</b><span>Издаване с две валути</span></span></a>
          <a class="dd-item" href="/features#dive-dash"><span class="ic"><i data-lucide="layout-dashboard"></i></span><span><b>Табло и отчети</b><span>ОВ, ОПР, баланс</span></span></a>
          <a class="dd-item" href="/features#security"><span class="ic ic-green"><i data-lucide="shield-check"></i></span><span><b>Сигурност</b><span>RLS, неизменяема книга, одит</span></span></a>
          <a class="dd-item" href="/features"><span class="ic"><i data-lucide="grid-2x2"></i></span><span><b>Всички функции</b><span>Пълен преглед</span></span></a>
        </div>
      </div>
      <div class="has-dd">
        <a${cur('about')} href="/about">Решения <i class="chev" data-lucide="chevron-down"></i></a>
        <div class="dd-panel dd-res">
          <a class="dd-item" href="/about"><span class="ic"><i data-lucide="briefcase"></i></span><span><b>Счетоводни кантори</b><span>Много клиенти от едно място</span></span></a>
          <a class="dd-item" href="/features"><span class="ic"><i data-lucide="store"></i></span><span><b>Малки фирми</b><span>Самостоятелно счетоводство</span></span></a>
          <a class="dd-item" href="/features"><span class="ic"><i data-lucide="user"></i></span><span><b>Самонаети и фрийлансъри</b><span>Фактури, ДДС и отчети</span></span></a>
        </div>
      </div>
      <a${cur('pricing')} href="/pricing">Цени</a>
      <div class="has-dd">
        <a${cur('resources')} href="/resources">Ресурси <i class="chev" data-lucide="chevron-down"></i></a>
        <div class="dd-panel dd-res">
          <a class="dd-item" href="/resources"><span class="ic"><i data-lucide="book-open"></i></span><span><b>Ръководства</b><span>Стъпка по стъпка</span></span></a>
          <a class="dd-item" href="/resources"><span class="ic"><i data-lucide="calendar-days"></i></span><span><b>Данъчен календар</b><span>Срокове за 2026</span></span></a>
          <a class="dd-item" href="/resources"><span class="ic"><i data-lucide="life-buoy"></i></span><span><b>Помощен център</b><span>Отговори и поддръжка</span></span></a>
        </div>
      </div>
      <a${cur('blog')} href="/blog">Блог</a>
      <a${cur('faq')} href="/faq">Въпроси</a>
    </nav>
    <div class="nav-spacer"></div>
    <div class="nav-actions">
      <div class="lang-toggle desk-only" role="group" aria-label="Език">
        <button class="on" type="button">BG</button><button type="button">EN</button>
      </div>
      <a class="btn btn-quiet btn-sm desk-only" href="/login">Вход</a>
      <a class="btn btn-primary btn-sm" href="/pricing">Започнете безплатно</a>
      <button class="nav-burger" aria-label="Меню" type="button"><i data-lucide="menu"></i></button>
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobileMenu">
  <div class="mm-top">
    <a class="brand" href="/"><img class="mark" src="/landing/assets/app-icon.svg" alt="" width="34" height="34" /><span class="wm"><b>Счетоводство</b></span></a>
    <button class="nav-burger mm-close" aria-label="Затвори" type="button"><i data-lucide="x"></i></button>
  </div>
  <nav class="mm-links">
    <a href="/features">Функции <i data-lucide="chevron-right"></i></a>
    <a href="/about">Решения <i data-lucide="chevron-right"></i></a>
    <a href="/pricing">Цени <i data-lucide="chevron-right"></i></a>
    <a href="/resources">Ресурси <i data-lucide="chevron-right"></i></a>
    <a href="/blog">Блог <i data-lucide="chevron-right"></i></a>
    <a href="/faq">Въпроси <i data-lucide="chevron-right"></i></a>
  </nav>
  <div class="mm-cta">
    <a class="btn btn-ghost btn-lg" href="/login">Вход</a>
    <a class="btn btn-primary btn-lg" href="/pricing">Започнете безплатно <i class="arrow" data-lucide="arrow-right"></i></a>
  </div>
</div>
<main id="top">`;
};

const footer = () => `</main>
<footer class="footer">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <a class="brand" href="/"><img class="mark" src="/landing/assets/app-icon.svg" alt="" width="38" height="38" /><span class="wm"><b>Счетоводство</b><span>AI ACCOUNTING</span></span></a>
        <p>AI счетоводство за българския бизнес. От фактура до готов отчет, без ръчно въвеждане.</p>
        <div class="foot-news">
          <label for="news">Бюлетин: данъци и съвети, веднъж месечно</label>
          <form class="news-field" onsubmit="return false">
            <input id="news" type="email" placeholder="вашият имейл" />
            <button class="btn btn-primary btn-sm" type="submit">Абонирай</button>
          </form>
        </div>
      </div>
      <div class="foot-col"><h4>Продукт</h4><ul><li><a href="/features">Функции</a></li><li><a href="/pricing">Цени</a></li><li><a href="/features#roadmap">Интеграции</a></li><li><a href="/features#security">Сигурност</a></li></ul></div>
      <div class="foot-col"><h4>Ресурси</h4><ul><li><a href="/blog">Блог</a></li><li><a href="/resources">Ръководства</a></li><li><a href="/resources">Помощен център</a></li><li><a href="/faq">Въпроси</a></li></ul></div>
      <div class="foot-col"><h4>Компания</h4><ul><li><a href="/about">За нас</a></li><li><a href="/contact">Контакти</a></li><li><a href="/admin">Админ панел</a></li></ul></div>
      <div class="foot-col"><h4>Правни</h4><ul><li><a href="/landing/legal/privacy.html">Политика за поверителност</a></li><li><a href="/landing/legal/terms.html">Общи условия</a></li><li><a href="/landing/legal/cookies.html">Политика за бисквитки</a></li><li><a href="/landing/legal/gdpr.html">GDPR</a></li></ul></div>
    </div>
    <div class="foot-bottom">
      <span class="cp">© <span data-year>2026</span> MGI-Delta. Всички права запазени. · EUR · BGN · ЕС</span>
      <div class="foot-badges">
        <span class="chip"><span class="dot"></span>GDPR</span><span class="chip"><span class="dot"></span>Хостинг в ЕС</span><span class="chip"><span class="dot"></span>Платформата е в активна разработка</span>
      </div>
      <div class="foot-social">
        <a href="#" aria-label="LinkedIn"><i data-lucide="linkedin"></i></a>
        <a href="#" aria-label="Facebook"><i data-lucide="facebook"></i></a>
        <a href="#" aria-label="YouTube"><i data-lucide="youtube"></i></a>
      </div>
    </div>
  </div>
</footer>
<button class="to-top" aria-label="Нагоре" type="button"><i data-lucide="arrow-up"></i></button>
<div class="mobile-cta"><a class="btn btn-primary" href="/pricing">Започнете безплатно <i class="arrow" data-lucide="arrow-right"></i></a></div>
<script src="/landing/assets/i18n.js?v=13" defer></script>
<script src="/landing/assets/site.js?v=13" defer></script>
<script>document.addEventListener('DOMContentLoaded', function () { if (window.lucide) lucide.createIcons(); });</script>
</body>
</html>`;

// ---- SECTIONS (the existing markup, split out) ----------------------------
const S = {};
S.hero = `
<section class="hero"><div class="hero-bg"><div class="hero-grid"></div></div>
  <div class="wrap"><div class="hero-head">
    <span class="badge-pill reveal"><span class="spark"><i data-lucide="sparkles" style="width:16px;height:16px"></i></span> За малки фирми, фрийлансъри и самонаети</span>
    <h1 class="reveal" data-delay="1">Счетоводство, опростено. <span class="grad-text">Без счетоводител.</span></h1>
    <p class="hero-sub reveal" data-delay="2">MGI-Delta автоматизира фактурите, ДДС, разходите и отчетите. AI разчита документите, а вие само одобрявате — управлявайте финансите на бизнеса си сами, без ръчно въвеждане.</p>
    <div class="hero-cta reveal" data-delay="3">
      <a class="btn btn-primary btn-lg" href="/pricing">Започнете безплатно <i class="arrow" data-lucide="arrow-right"></i></a>
      <a class="btn btn-ghost btn-lg" href="/contact">Заявете демо</a>
      <a class="btn btn-quiet btn-lg" href="/login">Вход</a>
    </div>
    <div class="hero-trust reveal" data-delay="4"><span>Без банкова карта</span><span class="sep"></span><span>7 дни безплатно</span><span class="sep"></span><span>BG / EN</span></div>
  </div>
    <div class="hero-stage reveal" data-delay="2">
      <div class="float-card fc-1 anim-float" data-stage-reveal><span class="ic ic-green"><i data-lucide="check-check"></i></span><span><span class="fc-k">Осчетоводено</span><span class="fc-v num">1 500,00 €</span></span></div>
      <div class="float-card fc-2 anim-float d1" data-stage-reveal><span class="ic"><i data-lucide="landmark"></i></span><span><span class="fc-k">ДДС за внасяне · 05/2026</span><span class="fc-v num">1 260,00 €</span></span></div>
      <div class="float-card fc-3 anim-float d2" data-stage-reveal><span class="conf conf-high" style="height:34px;padding-inline:12px"><span class="cdot"></span> 96% сигурност</span></div>
      <div class="win">
        <div class="win-bar"><div class="win-dots"><i></i><i></i><i></i></div><span class="win-title">Преглед на документ</span><span class="badge-pill win-pill" style="height:30px;padding:6px 12px;font-size:12.5px"><span class="spark"><i data-lucide="sparkles" style="width:14px;height:14px"></i></span> AI извлечени данни</span></div>
        <div class="doc-grid">
          <div class="doc-left"><div class="doc-paper"><div class="pp-head"><div style="display:flex;flex-direction:column;gap:8px"><div class="sk w60"></div><div class="sk w40"></div></div><i data-lucide="file-text" style="width:20px;height:20px;color:var(--neutral-300)"></i></div><div class="sk w80"></div><div class="sk w70"></div><div class="sk w60"></div><div class="sk w80" style="margin-top:6px"></div><div class="sk w40"></div><div class="pp-amount"><div class="sk b w70" style="height:14px"></div></div></div></div>
          <div class="doc-right">
            <div class="drow"><span class="k">Доставчик</span><span class="v">ТЕХНО ПЛЮС ООД <span class="verified"><i data-lucide="check" style="width:13px;height:13px"></i> Проверено</span></span></div>
            <div class="drow" data-stage-reveal><span class="k">ЕИК</span><span class="v"><span class="num">203115431</span> <span class="conf conf-high"><span class="cdot"></span>96%</span></span></div>
            <div class="drow" data-stage-reveal><span class="k">Дата</span><span class="v"><span class="num">14.05.2026</span> <span class="conf conf-high"><span class="cdot"></span>99%</span></span></div>
            <div class="drow" data-stage-reveal><span class="k">Данъчна основа</span><span class="v"><span class="num">1 250,00 €</span> <span class="conf conf-high"><span class="cdot"></span>94%</span></span></div>
            <div class="drow" data-stage-reveal><span class="k">ДДС 20%</span><span class="v"><span class="num">250,00 €</span> <span class="verified"><i data-lucide="check" style="width:13px;height:13px"></i> Проверено</span></span></div>
            <div class="drow"><span class="k">Общо</span><span class="v"><span class="num">1 500,00 €</span> <span class="verified"><i data-lucide="check" style="width:13px;height:13px"></i> Проверено</span></span></div>
            <div class="entry-box" data-stage-reveal><div class="eb-h">Предложено осчетоводяване</div><div class="entry-line"><span class="acct"><i></i>602 · Външни услуги</span><span class="num">1 250,00 €</span></div><div class="entry-line"><span class="acct"><i></i>4531 · Начислен ДДС</span><span class="num">250,00 €</span></div><div class="entry-line"><span class="acct"><i class="g"></i>401 · Доставчици</span><span class="num">1 500,00 €</span></div></div>
            <button class="btn btn-commit doc-cta" style="width:100%" type="button"><i data-lucide="check" style="width:16px;height:16px"></i> Одобри и осчетоводи</button>
          </div>
        </div>
      </div>
    </div>
    <a class="scroll-cue reveal" data-delay="4" href="#stats" aria-label="Към следващата секция"><i data-lucide="chevrons-down"></i></a>
  </div>
</section>`;

S.trust = `
<section class="trustbar"><div class="wrap"><span class="tb-label">Създадено за България</span><div class="tb-chips"><span class="chip"><span class="dot"></span>ЕИК и VIES</span><span class="chip"><span class="dot"></span>ДДС 20 / 9 / 0 %</span><span class="chip"><span class="dot"></span>EUR + лв.</span><span class="chip"><span class="dot"></span>Хостинг в ЕС</span><span class="chip"><span class="dot"></span>AI без задържане на данни</span></div></div></section>`;

S.stats = `
<section class="stats" id="stats"><div class="wrap" style="padding-inline:0"><div class="stats-grid">
  <div class="stat reveal"><div class="sv grad-text"><span data-count="12" data-suffix=" ч"></span></div><div class="sl">спестено време на месец<br />за типична фирма</div></div>
  <div class="stat reveal" data-delay="1"><div class="sv grad-text"><span data-count="98.7" data-dec="1" data-suffix="%"></span></div><div class="sl">точност при извличане<br />на данни от документи</div></div>
  <div class="stat reveal" data-delay="2"><div class="sv grad-text"><span data-count="30000" data-suffix="+"></span></div><div class="sl">обработени документа<br />през платформата</div></div>
  <div class="stat reveal" data-delay="3"><div class="sv grad-text"><span data-count="4.9" data-dec="1"></span></div><div class="sl">средна оценка<br />от счетоводители</div></div>
</div></div></section>`;

S.problem = `
<section class="section-pad" id="problem"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Проблемът</span><h2 class="section-title">Ръчното счетоводство<br />губи време и носи риск</h2><p class="section-sub">Въвеждането на данни на ръка е бавно, скъпо и склонно към грешки.</p></div><div class="cards-3">
  <article class="card card-hover prob-card reveal"><span class="ic ic-red"><i data-lucide="clock"></i></span><h3>Часове ръчно въвеждане</h3><p>Преписването на фактури поле по поле изяжда времето за реална работа.</p></article>
  <article class="card card-hover prob-card reveal" data-delay="1"><span class="ic ic-red"><i data-lucide="triangle-alert"></i></span><h3>Грешки и риск при ДДС</h3><p>Дребна грешка в основа или ДДС се превръща в проблем при проверка и деклариране.</p></article>
  <article class="card card-hover prob-card reveal" data-delay="2"><span class="ic ic-red"><i data-lucide="inbox"></i></span><h3>Разпръснати документи</h3><p>Фактури в имейли, папки и на хартия, трудно се намират и още по-трудно се архивират.</p></article>
</div></div></section>`;

S.solution = `
<section class="section-pad" id="solution" style="background:var(--neutral-0);border-block:1px solid var(--color-border-default)"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Решението</span><h2 class="section-title">Един надежден поток<br />вместо хаос</h2><p class="section-sub">MGI-Delta обединява качване, AI извличане, човешки преглед и осчетоводяване в един проследим процес. AI предлага, човекът решава. Числата идват само от главната книга.</p></div><div class="flow">
  <article class="flow-step card reveal"><span class="sn">1</span><span class="conn"></span><span class="si"><i data-lucide="upload-cloud"></i></span><h3>Качване</h3><p>Качете фактура (PDF, снимка или XML).</p></article>
  <article class="flow-step card reveal" data-delay="1"><span class="sn">2</span><span class="conn"></span><span class="si"><i data-lucide="sparkles"></i></span><h3>AI извличане</h3><p>AI разчита и предлага данните и осчетоводяването.</p></article>
  <article class="flow-step card reveal" data-delay="2"><span class="sn">3</span><span class="conn"></span><span class="si"><i data-lucide="user-check"></i></span><h3>Преглед</h3><p>Човек проверява, коригира и одобрява.</p></article>
  <article class="flow-step card reveal" data-delay="3"><span class="sn">4</span><span class="conn"></span><span class="si"><i data-lucide="book-open"></i></span><h3>Осчетоводяване</h3><p>Балансирано двустранно записване в неизменяема книга.</p></article>
  <article class="flow-step card reveal" data-delay="4"><span class="sn">5</span><span class="si"><i data-lucide="bar-chart-3"></i></span><h3>Отчети</h3><p>ДДС регистри, ОПР и баланс, готови за експорт.</p></article>
</div></div></section>`;

S.features = (seeAll) => `
<section class="section-pad" id="features"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Възможности</span><h2 class="section-title">Всичко за обработката<br />на документи</h2><p class="section-sub">Функции, създадени за счетоводната практика в България.</p></div><div class="feat-grid">
  <article class="card card-hover feat-card reveal"><span class="ic"><i data-lucide="sparkles"></i></span><h3>AI извличане от документи</h3><p>Автоматично разчитане на фактури с извличане на ключови полета.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="1"><span class="ic"><i data-lucide="file-text"></i></span><h3>Управление на фактури</h3><p>Издаване с последователна номерация, PDF и проследяване на статуса.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="2"><span class="ic"><i data-lucide="landmark"></i></span><h3>ДДС и данъчна подготовка</h3><p>Дневници покупки/продажби и данни за справка-декларация, готови за подаване.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="3"><span class="ic"><i data-lucide="git-compare-arrows"></i></span><h3>Счетоводни потоци</h3><p>Двустранно осчетоводяване в неизменяема главна книга с корекции чрез сторно.</p></article>
  <article class="card card-hover feat-card reveal"><span class="ic"><i data-lucide="building-2"></i></span><h3>Управление на фирми</h3><p>Няколко фирми в един акаунт със строга изолация на данните.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="1"><span class="ic"><i data-lucide="archive"></i></span><h3>Сигурен архив</h3><p>Документите се пазят защитено (WORM) с временни подписани връзки.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="2"><span class="ic"><i data-lucide="user-check"></i></span><h3>Човешки преглед и корекция</h3><p>Опашка за преглед с предложения, валидации и одобрение.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="3"><span class="ic"><i data-lucide="languages"></i></span><h3>BG / EN интерфейс</h3><p>Български и английски с коректна кирилица и формати.</p></article>
  <article class="card card-hover feat-card reveal"><span class="ic"><i data-lucide="wallet"></i></span><h3>Проследяване на разходи</h3><p>Разходите се извличат от документите и се категоризират за ясна картина на парите.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="1"><span class="ic"><i data-lucide="bar-chart-3"></i></span><h3>Финансови отчети</h3><p>Оборотна ведомост, ОПР и баланс — на живо от главната книга, готови за експорт.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="2"><span class="ic"><i data-lucide="shield-check"></i></span><h3>Данъчно съответствие</h3><p>ЗДДС ставки, национален сметкоплан и одитна следа за изряден бизнес.</p></article>
  <article class="card card-hover feat-card reveal" data-delay="3"><span class="ic ic-green"><i data-lucide="layout-dashboard"></i></span><h3>Табло за финансите</h3><p>Какво дължите, какво ви дължат и какви срокове идват — на едно място.</p></article>
</div>${seeAll ? `<div style="text-align:center;margin-top:44px" class="reveal"><a class="btn btn-ghost btn-lg" href="/features">Вижте всички функции <i class="arrow" data-lucide="arrow-right"></i></a></div>` : ''}</div></section>`;

S.diveAI = `
<section class="section-pad" id="dive-ai" style="background:var(--neutral-0);border-top:1px solid var(--color-border-default)"><div class="wrap"><div class="dive"><div class="dive-copy reveal"><span class="eyebrow">AI извличане и преглед</span><h2>AI предлага.<br />Човекът решава.</h2><p class="lead">Всяко поле идва с оценка на сигурност и детерминирана проверка. Високата сигурност без флагове се одобрява масово, останалото е на един екран.</p><ul class="dive-list"><li><span class="tick"><i data-lucide="check"></i></span>Оценка на сигурност за всяко извлечено поле</li><li><span class="tick"><i data-lucide="check"></i></span>Детерминирани проверки: ЕИК, VIES, IBAN, Основа + ДДС = Общо</li><li><span class="tick"><i data-lucide="check"></i></span>Предложена счетоводна статия с обяснение „защо?“</li><li><span class="tick"><i data-lucide="check"></i></span>Масово одобрение на чисти документи</li></ul><div class="dive-cta"><a class="btn btn-primary" href="/pricing">Опитайте безплатно <i class="arrow" data-lucide="arrow-right"></i></a></div></div><div class="dive-vis reveal" data-delay="1"><div class="card mini"><div class="mini-head"><span class="mt">Опашка за преглед · 7 чакащи</span><span class="conf conf-blue"><span class="cdot"></span>AI</span></div><div class="mockrow"><span class="ml"><span class="mi"><i data-lucide="file-text"></i></span><span><span class="mname">Фактура · ТЕХНО ПЛЮС ООД</span><br /><span class="msub">1 500,00 € · 14.05.2026</span></span></span><span class="conf conf-high"><span class="cdot"></span>96%</span></div><div class="mockrow"><span class="ml"><span class="mi"><i data-lucide="file-text"></i></span><span><span class="mname">Фактура · Арка Дизайн ЕООД</span><br /><span class="msub">432,00 € · 13.05.2026</span></span></span><span class="conf conf-high"><span class="cdot"></span>92%</span></div><div class="mockrow"><span class="ml"><span class="mi ic-amber" style="background:var(--amber-50);color:var(--amber-600)"><i data-lucide="triangle-alert"></i></span><span><span class="mname">Фактура · Грийн Фуудс АД</span><br /><span class="msub">за корекция · ДДС основа</span></span></span><span class="conf conf-med"><span class="cdot"></span>78%</span></div><button class="btn btn-commit" style="width:100%;margin-top:6px" type="button"><i data-lucide="check-check" style="width:16px;height:16px"></i> Одобри чистите (4)</button></div></div></div></div></section>`;

S.diveVat = `
<section class="section-pad" id="dive-vat"><div class="wrap"><div class="dive flip"><div class="dive-copy reveal"><span class="eyebrow">ДДС и НАП</span><h2>ДДС и подаване<br />към НАП без стрес</h2><p class="lead">Дневниците покупки и продажби се попълват автоматично от осчетоводените документи. Справка-декларацията е готова, а вие виждате точно какво подавате.</p><ul class="dive-list"><li><span class="tick"><i data-lucide="check"></i></span>Дневници покупки и продажби в реално време</li><li><span class="tick"><i data-lucide="check"></i></span>Клетки на справка-декларацията по ЗДДС</li><li><span class="tick"><i data-lucide="check"></i></span>Подписване с КЕП и заключване на периода</li><li><span class="tick"><i data-lucide="check"></i></span>Експорт за подаване към НАП</li></ul><div class="dive-cta"><a class="btn btn-primary" href="/pricing">Вижте как работи <i class="arrow" data-lucide="arrow-right"></i></a></div></div><div class="dive-vis reveal" data-delay="1"><div class="card vat-card"><div class="mini-head"><span class="mt">Справка-декларация · 05/2026</span><span class="conf conf-blue" style="background:var(--amber-50);color:var(--amber-700)"><span class="cdot" style="background:var(--amber-400)"></span>краен срок 14.06</span></div><div class="vat-line"><span>Изходен ДДС (продажби)</span><span class="num" style="font-weight:600">1 320,00 €</span></div><div class="vat-line"><span>Приспаднат ДДС (покупки)</span><span class="num" style="font-weight:600">60,00 €</span></div><div class="vat-total"><span class="lbl">ДДС за внасяне</span><span style="text-align:right"><span class="amt grad-text num">1 260,00 €</span><br /><span class="bgn num">≈ 2 464,35 лв.</span></span></div><div class="stage-chain"><span class="st done">Подготовка ✓</span><span class="st done">Валидиране ✓</span><span class="st now">Подписване</span><span class="st">Подаване</span></div><button class="btn btn-commit" style="width:100%;margin-top:18px" type="button"><i data-lucide="pen-line" style="width:16px;height:16px"></i> Подпиши с КЕП и заключи периода</button></div></div></div></div></section>`;

S.diveInvoice = `
<section class="section-pad" id="dive-invoice" style="background:var(--neutral-0);border-block:1px solid var(--color-border-default)"><div class="wrap"><div class="dive"><div class="dive-copy reveal"><span class="eyebrow">Фактуриране</span><h2>Издавайте фактури<br />с живи суми и две валути</h2><p class="lead">Фактури, кредитни и дебитни известия и проформи с последователна номерация. Нето, ДДС и бруто се изчисляват на момента, в евро и в лева.</p><ul class="dive-list"><li><span class="tick"><i data-lucide="check"></i></span>Фактури, известия и проформи</li><li><span class="tick"><i data-lucide="check"></i></span>Живи суми нето / ДДС / бруто</li><li><span class="tick"><i data-lucide="check"></i></span>Две валути: EUR основна, лв. справочно</li><li><span class="tick"><i data-lucide="check"></i></span>Последователна номерация и PDF</li></ul><div class="dive-cta"><a class="btn btn-primary" href="/pricing">Издайте първа фактура <i class="arrow" data-lucide="arrow-right"></i></a></div></div><div class="dive-vis reveal" data-delay="1"><div class="card mini" style="padding:22px"><div class="inv-head"><div><div style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--blue-700)">Нова фактура</div><div style="font-size:13px;color:var(--neutral-500);margin-top:4px">№ 0000124 · 03.06.2026</div></div><span class="chip chip-blue">Чернова</span></div><div class="mockrow" style="margin-top:16px"><span class="ml"><span class="mname">Консултантска услуга</span></span><span class="num" style="font-weight:600">1 000,00 €</span></div><div class="mockrow"><span class="ml"><span class="mname">Поддръжка · месечна</span></span><span class="num" style="font-weight:600">250,00 €</span></div><div class="inv-tot"><div class="ir"><span>Данъчна основа</span><span class="num">1 250,00 €</span></div><div class="ir"><span>ДДС 20%</span><span class="num">250,00 €</span></div><div class="ir big"><span>Общо за плащане</span><span class="num">1 500,00 €</span></div><div class="ir" style="color:var(--neutral-500)"><span>≈ в лева</span><span class="num">2 933,75 лв.</span></div></div><button class="btn btn-primary" style="width:100%;margin-top:16px" type="button"><i data-lucide="send" style="width:16px;height:16px"></i> Издай фактура</button></div></div></div></div></section>`;

S.diveDash = `
<section class="section-pad" id="dive-dash"><div class="wrap"><div class="dive flip"><div class="dive-copy reveal"><span class="eyebrow">Табло и отчети</span><h2>Цялата картина<br />на бизнеса на едно табло</h2><p class="lead">Какво дължите, какво ви дължат, кои срокове идват и каква е печалбата. Числата идват само от главната книга, винаги верни и проследими.</p><ul class="dive-list"><li><span class="tick"><i data-lucide="check"></i></span>Оборотна ведомост, главна книга, ОПР и баланс</li><li><span class="tick"><i data-lucide="check"></i></span>ДДС за внасяне и предстоящи срокове</li><li><span class="tick"><i data-lucide="check"></i></span>Нетна печалба и движение спрямо месеца</li><li><span class="tick"><i data-lucide="check"></i></span>Експорт на всеки отчет</li></ul><div class="dive-cta"><a class="btn btn-primary" href="/pricing">Отворете таблото <i class="arrow" data-lucide="arrow-right"></i></a></div></div><div class="dive-vis reveal" data-delay="1"><div class="card mini" style="padding:20px;background:var(--neutral-50)"><div class="mini-head"><span class="mt">Табло · Акме ООД · 05/2026</span><span class="conf conf-blue"><span class="cdot"></span>на живо</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="card" style="padding:16px"><div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--neutral-400)">ДДС за внасяне</div><div class="num grad-text" style="font-size:26px;font-weight:700;margin-top:8px">1 260,00 €</div><div style="font-size:11px;color:var(--neutral-500)">≈ 2 464,35 лв.</div></div><div class="card" style="padding:16px"><div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--neutral-400)">Нетна печалба</div><div class="num" style="font-size:26px;font-weight:700;margin-top:8px;color:var(--green-600)">12 400,00 €</div><div style="font-size:11px;color:var(--green-700);display:flex;align-items:center;gap:3px"><i data-lucide="trending-up" style="width:12px;height:12px"></i> 8,2% спрямо 04/2026</div></div><div class="card" style="padding:16px"><div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--neutral-400)">Чакащи прегледи</div><div class="num" style="font-size:26px;font-weight:700;margin-top:8px;color:var(--amber-600)">7</div><div style="font-size:11px;color:var(--neutral-500)">2 за корекция</div></div><div class="card" style="padding:16px"><div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--neutral-400)">Статус на отчети</div><div style="font-size:22px;font-weight:700;margin-top:8px;color:var(--green-600)">Готови</div><div style="font-size:11px;color:var(--neutral-500)">ОВ · ОПР · баланс</div></div></div></div></div></div></div></section>`;

S.accountants = `
<section class="section-pad" id="accountants" style="background:var(--neutral-0);border-top:1px solid var(--color-border-default)"><div class="wrap"><div class="acc-grid"><div class="reveal"><span class="eyebrow">За счетоводители</span><h2 class="section-title" style="text-align:left;margin-top:16px">Създадено и за<br />счетоводни кантори</h2><p class="section-sub" style="text-align:left;margin-left:0">Управлявайте много клиенти от едно място, със строга изолация на всеки.</p><ul class="checklist"><li><span class="tick"><i data-lucide="check"></i></span>Много фирми в един акаунт</li><li><span class="tick"><i data-lucide="check"></i></span>Отделно работно пространство за всеки клиент</li><li><span class="tick"><i data-lucide="check"></i></span>Гарантирана изолация на данните между клиентите</li><li><span class="tick"><i data-lucide="check"></i></span>Бързо превключване между фирми</li></ul><div style="margin-top:28px"><a class="btn btn-primary btn-lg" href="/pricing">Вижте плановете за кантори <i class="arrow" data-lucide="arrow-right"></i></a></div></div><div class="reveal" data-delay="1"><div class="card ws-card"><div class="ws-h">Отделно работно пространство за всеки клиент</div><div class="ws-item active"><span class="wl"><span class="wic"><i data-lucide="building-2"></i></span><span class="wname">ТЕХНО ПЛЮС ООД</span></span><span class="chip chip-blue" style="height:26px">ДДС</span></div><div class="ws-item"><span class="wl"><span class="wic"><i data-lucide="building-2"></i></span><span class="wname">АРКА ДИЗАЙН ЕООД</span></span><span class="chip chip-blue" style="height:26px">ДДС</span></div><div class="ws-item"><span class="wl"><span class="wic"><i data-lucide="building-2"></i></span><span class="wname">ГРИЙН ФУУДС АД</span></span><span style="color:var(--neutral-400)"><i data-lucide="minus" style="width:16px;height:16px"></i></span></div></div></div></div></div></section>`;

S.security = `
<section class="dark section-pad" id="security"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Сигурност</span><h2 class="section-title">Сигурност, на която<br />можете да стъпите</h2><p class="section-sub">Архитектура, проектирана да защитава финансови данни.</p></div><div class="sec-grid"><article class="sec-card reveal"><span class="ic"><i data-lucide="lock"></i></span><h3>Изолация по фирма</h3><p>Строго разделяне на данните на ниво база (Postgres RLS), никой не вижда чужди данни.</p></article><article class="sec-card reveal" data-delay="1"><span class="ic"><i data-lucide="scale"></i></span><h3>Неизменяема главна книга</h3><p>Осчетоводените записи не се променят и не се трият, корекциите са чрез сторно.</p></article><article class="sec-card reveal" data-delay="2"><span class="ic"><i data-lucide="file-clock"></i></span><h3>Пълна одитна следа</h3><p>Всяко чувствително действие се записва: кой, какво и кога, защитено от подмяна.</p></article><article class="sec-card reveal" data-delay="3"><span class="ic"><i data-lucide="globe"></i></span><h3>Данни в ЕС</h3><p>Хостинг и обработка в ЕС; AI услугите са без задържане и не се обучават върху вашите данни.</p></article></div><div class="compliance reveal"><span class="comp-badge"><i data-lucide="shield-check"></i> GDPR съответствие</span><span class="comp-badge"><i data-lucide="server"></i> Хостинг в ЕС</span><span class="comp-badge"><i data-lucide="lock"></i> Шифроване при пренос и покой</span><span class="comp-badge"><i data-lucide="badge-check"></i> ЗДДС и КЕП</span></div></div></section>`;

S.roadmap = `
<section class="section-pad" id="roadmap" style="background:var(--neutral-0);border-bottom:1px solid var(--color-border-default)"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Пътна карта</span><h2 class="section-title">Подготвено за<br />следващата стъпка</h2><p class="section-sub">Платформата е създадена с възможност за разширение. Тези интеграции са в пътната карта.</p></div><div class="road-grid"><article class="card road-card reveal"><span class="rb">В плана</span><span class="ic"><i data-lucide="refresh-cw"></i></span><h3>Банкови извлечения</h3><p>Подготвено за автоматично нанасяне и засичане на плащания.</p></article><article class="card road-card reveal" data-delay="1"><span class="rb">В плана</span><span class="ic"><i data-lucide="send"></i></span><h3>Подаване към НАП</h3><p>Създадено с възможност за директно подаване; в MVP се експортира за ръчно подаване.</p></article><article class="card road-card reveal" data-delay="2"><span class="rb">В плана</span><span class="ic"><i data-lucide="credit-card"></i></span><h3>Онлайн плащания</h3><p>Архитектурата е готова за абонаменти и плащания (Stripe-ready).</p></article><article class="card road-card reveal" data-delay="3"><span class="rb">В плана</span><span class="ic"><i data-lucide="bar-chart-3"></i></span><h3>Разширени отчети</h3><p>Заложена е основата за по-богати справки и анализи.</p></article></div></div></section>`;

S.testimonials = `
<section class="section-pad" id="testimonials"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Отзиви</span><h2 class="section-title">Счетоводители и фирми,<br />които спестяват часове</h2><p class="section-sub">Истории от практиката с MGI-Delta.</p></div><div class="tcar reveal"><div class="tcar-track">
  <div class="tslide"><article class="card tcard"><div class="stars"><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i></div><blockquote>„Преписвах фактури с часове. Сега AI ги разчита, аз одобрявам и до обяд съм готова с ДДС дневниците.“</blockquote><div class="who"><span class="av">МД</span><div><div class="wn">Мария Димитрова</div><div class="wr">Счетоводител · кантора</div></div></div></article></div>
  <div class="tslide"><article class="card tcard"><div class="stars"><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i></div><blockquote>„Виждам точно колко ДДС дължа и кога е срокът. За пръв път данъците не са изненада.“</blockquote><div class="who"><span class="av">ГП</span><div><div class="wn">Георги Петров</div><div class="wr">Собственик · ЕООД</div></div></div></article></div>
  <div class="tslide"><article class="card tcard"><div class="stars"><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i></div><blockquote>„Управлявам над 20 клиента от едно място. Изолацията на данните ме спечели още в първата седмица.“</blockquote><div class="who"><span class="av">ИК</span><div><div class="wn">Ивана Колева</div><div class="wr">Управител · счетоводна къща</div></div></div></article></div>
  <div class="tslide"><article class="card tcard"><div class="stars"><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i></div><blockquote>„Фрийлансър съм и нямам счетоводител. Издавам фактури и следя приходите за минути.“</blockquote><div class="who"><span class="av">СА</span><div><div class="wn">Стоян Ангелов</div><div class="wr">Самонает · ИТ</div></div></div></article></div>
  <div class="tslide"><article class="card tcard"><div class="stars"><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i></div><blockquote>„Неизменяемата книга и одитната следа ми дават спокойствие при всяка проверка.“</blockquote><div class="who"><span class="av">ВТ</span><div><div class="wn">Веселин Тодоров</div><div class="wr">Финансов мениджър</div></div></div></article></div>
  <div class="tslide"><article class="card tcard"><div class="stars"><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i><i data-lucide="star"></i></div><blockquote>„Двете валути и коректната кирилица са дребни неща, които показват, че е правено за България.“</blockquote><div class="who"><span class="av">РН</span><div><div class="wn">Радостина Николова</div><div class="wr">Счетоводител · фирма</div></div></div></article></div>
</div><div class="tcar-nav"><button class="tcar-btn tcar-prev" aria-label="Предишен" type="button"><i data-lucide="arrow-left"></i></button><div class="tcar-dots"></div><button class="tcar-btn tcar-next" aria-label="Следващ" type="button"><i data-lucide="arrow-right"></i></button></div></div></div></section>`;

S.pricing = `
<section class="section-pad" id="pricing" style="background:var(--neutral-0);border-block:1px solid var(--color-border-default)"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Цени</span><h2 class="section-title">Изберете план</h2><p class="section-sub">Сменяйте или прекратявайте по всяко време.</p><div class="price-toggle"><div class="toggle-pill"><span class="thumb"></span><button type="button" data-period="month">Месечно</button><button type="button" class="on" data-period="year">Годишно</button></div><span class="save-tag">Спестете 20% при годишно плащане</span></div></div><div class="price-grid">
  <article class="card plan reveal"><h3>Starter</h3><p class="pdesc">За самонаети и малки фирми.</p><div class="pprice"><span class="amt">€<span data-m="9" data-y="7">7</span></span><span class="per">/ мес.</span></div><div class="pbgn"><span data-bgn-m="17,60 лв." data-bgn-y="13,69 лв.">13,69 лв.</span> · таксува се <span data-m="€9 / мес." data-y="€84 / год.">€84 / год.</span></div><span class="chip" style="margin-top:14px;background:var(--green-50);border-color:var(--green-100);color:var(--green-700)"><i data-lucide="check" style="width:14px;height:14px"></i> 7-дневен безплатен период</span><ul class="plan-feats"><li><span class="tick"><i data-lucide="check"></i></span>1 фирма</li><li><span class="tick"><i data-lucide="check"></i></span>До 50 документа/мес.</li><li><span class="tick"><i data-lucide="check"></i></span>AI извличане от документи</li><li><span class="tick"><i data-lucide="check"></i></span>Издаване на фактури</li><li><span class="tick"><i data-lucide="check"></i></span>ДДС дневници</li><li><span class="tick"><i data-lucide="check"></i></span>Поддръжка по имейл</li></ul><a class="btn btn-ghost" href="/register?plan=starter">Започни безплатно</a></article>
  <article class="card plan pop reveal" data-delay="1"><span class="plan-flag">Най-популярен</span><h3>Business</h3><p class="pdesc">За растящи фирми с повече документи.</p><div class="pprice"><span class="amt">€<span data-m="19" data-y="15">15</span></span><span class="per">/ мес.</span></div><div class="pbgn"><span data-bgn-m="37,16 лв." data-bgn-y="29,34 лв.">29,34 лв.</span> · таксува се <span data-m="€19 / мес." data-y="€180 / год.">€180 / год.</span></div><span class="chip" style="margin-top:14px;background:var(--green-50);border-color:var(--green-100);color:var(--green-700)"><i data-lucide="check" style="width:14px;height:14px"></i> 7-дневен безплатен период</span><ul class="plan-feats"><li><span class="tick"><i data-lucide="check"></i></span>До 3 фирми</li><li><span class="tick"><i data-lucide="check"></i></span>До 300 документа/мес.</li><li><span class="tick"><i data-lucide="check"></i></span>AI извличане от документи</li><li><span class="tick"><i data-lucide="check"></i></span>Издаване на фактури</li><li><span class="tick"><i data-lucide="check"></i></span>Отчети (ОВ, ОПР, баланс)</li><li><span class="tick"><i data-lucide="check"></i></span>Опашка за преглед и одобрение</li><li><span class="tick"><i data-lucide="check"></i></span>Приоритетна поддръжка</li></ul><a class="btn btn-primary" href="/register?plan=business">Започни безплатно</a></article>
  <article class="card plan reveal" data-delay="2"><h3>Premium</h3><p class="pdesc">За екипи с няколко дружества.</p><div class="pprice"><span class="amt">€<span data-m="39" data-y="31">31</span></span><span class="per">/ мес.</span></div><div class="pbgn"><span data-bgn-m="76,28 лв." data-bgn-y="60,63 лв.">60,63 лв.</span> · таксува се <span data-m="€39 / мес." data-y="€372 / год.">€372 / год.</span></div><span class="chip" style="margin-top:14px;background:var(--green-50);border-color:var(--green-100);color:var(--green-700)"><i data-lucide="check" style="width:14px;height:14px"></i> 7-дневен безплатен период</span><ul class="plan-feats"><li><span class="tick"><i data-lucide="check"></i></span>До 10 фирми</li><li><span class="tick"><i data-lucide="check"></i></span>До 1000 документа/мес.</li><li><span class="tick"><i data-lucide="check"></i></span>Всичко от Business</li><li><span class="tick"><i data-lucide="check"></i></span>Защитен архив (WORM)</li><li><span class="tick"><i data-lucide="check"></i></span>Няколко потребители</li><li><span class="tick"><i data-lucide="check"></i></span>Помощ при стартиране</li></ul><a class="btn btn-ghost" href="/register?plan=premium">Започни безплатно</a></article>
  <article class="card plan reveal" data-delay="3"><h3>Счетоводна къща</h3><p class="pdesc">За кантори с много клиенти.</p><div class="pprice"><span class="amt">€<span data-m="79" data-y="63">63</span></span><span class="per">/ мес.</span></div><div class="pbgn"><span data-bgn-m="154,51 лв." data-bgn-y="123,22 лв.">123,22 лв.</span> · таксува се <span data-m="€79 / мес." data-y="€756 / год.">€756 / год.</span></div><span class="chip" style="margin-top:14px;background:var(--green-50);border-color:var(--green-100);color:var(--green-700)"><i data-lucide="check" style="width:14px;height:14px"></i> 7-дневен безплатен период</span><ul class="plan-feats"><li><span class="tick"><i data-lucide="check"></i></span>Неограничено клиенти</li><li><span class="tick"><i data-lucide="check"></i></span>Индивидуален обем</li><li><span class="tick"><i data-lucide="check"></i></span>Всичко от Premium</li><li><span class="tick"><i data-lucide="check"></i></span>Работни пространства за клиенти</li><li><span class="tick"><i data-lucide="check"></i></span>Отделен мениджър</li><li><span class="tick"><i data-lucide="check"></i></span>API достъп <span style="color:var(--neutral-400)">(скоро)</span></li></ul><a class="btn btn-ghost" href="/contact">Свържете се с нас</a></article>
</div></div></section>`;

S.resources = `
<section class="section-pad" id="resources"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Ресурси</span><h2 class="section-title">Ресурси, които<br />работят за вас</h2><p class="section-sub">Ръководства, шаблони и инструменти за счетоводство, ДДС и данъци в България.</p></div><div class="res-grid">
  <a class="card card-hover res-card reveal" href="/blog"><span class="ic"><i data-lucide="book-open"></i></span><h3>Ръководства</h3><p>Стъпка по стъпка през ДДС, фактури и осчетоводяване.</p><span class="rlink">Разгледайте <i class="arrow" data-lucide="arrow-right"></i></span></a>
  <a class="card card-hover res-card reveal" data-delay="1" href="/contact"><span class="ic ic-green"><i data-lucide="file-down"></i></span><h3>Шаблони</h3><p>Готови шаблони за фактури, протоколи и справки.</p><span class="rlink">Изтеглете <i class="arrow" data-lucide="arrow-right"></i></span></a>
  <a class="card card-hover res-card reveal" data-delay="2" href="/blog"><span class="ic"><i data-lucide="calendar-days"></i></span><h3>Данъчен календар</h3><p>Всички срокове за ДДС и данъци за 2026 на едно място.</p><span class="rlink">Вижте сроковете <i class="arrow" data-lucide="arrow-right"></i></span></a>
  <a class="card card-hover res-card reveal" href="/blog"><span class="ic"><i data-lucide="list-checks"></i></span><h3>Контролни списъци</h3><p>Месечни и годишни чеклисти за изряден бизнес.</p><span class="rlink">Отворете <i class="arrow" data-lucide="arrow-right"></i></span></a>
  <a class="card card-hover res-card reveal" data-delay="1" href="/contact"><span class="ic ic-green"><i data-lucide="play-circle"></i></span><h3>Видео уроци</h3><p>Кратки видеа как да свършите всяка задача в платформата.</p><span class="rlink">Гледайте <i class="arrow" data-lucide="arrow-right"></i></span></a>
  <a class="card card-hover res-card reveal" data-delay="2" href="/contact"><span class="ic"><i data-lucide="life-buoy"></i></span><h3>Помощен център</h3><p>База знания и отговори на често задавани въпроси.</p><span class="rlink">Към помощта <i class="arrow" data-lucide="arrow-right"></i></span></a>
</div></div></section>`;

S.blog = `
<section class="section-pad" id="blog"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Блог</span><h1 class="section-title">От блога</h1><p class="section-sub">Практични статии за счетоводство, данъци и растеж на бизнеса.</p></div><div class="bcats reveal"><button class="bcat on" type="button">Всички</button><button class="bcat" type="button">Счетоводство</button><button class="bcat" type="button">Данъци</button><button class="bcat" type="button">ДДС</button><button class="bcat" type="button">Бизнес растеж</button><button class="bcat" type="button">Съответствие</button></div><div class="blog-grid">
  <a class="card card-hover bcard feat reveal" href="/contact"><div class="bthumb"><img src="/landing/assets/img/blog-1.jpg" alt="Бюро със счетоводни документи и калкулатор" loading="lazy" width="800" height="520" /></div><div class="bbody"><div class="bmeta"><span class="bc">ДДС</span><span>·</span><span>8 мин четене</span></div><h3>ДДС за начинаещи: как да подадете първата си справка-декларация без грешки</h3><p>Какво влиза в дневниците покупки и продажби, как се пълни декларацията и кои са най-честите грешки при подаване.</p><span class="rmore">Прочетете още →</span></div></a>
  <a class="card card-hover bcard reveal" data-delay="1" href="/contact"><div class="bthumb"><img src="/landing/assets/img/blog-2.jpg" alt="Водене на счетоводни записи" loading="lazy" width="800" height="520" /></div><div class="bbody"><div class="bmeta"><span class="bc">Счетоводство</span><span>·</span><span>5 мин</span></div><h3>Неизменяема главна книга: защо сторното е по-добро от изтриването</h3><span class="rmore">Прочетете още →</span></div></a>
  <a class="card card-hover bcard reveal" data-delay="2" href="/contact"><div class="bthumb"><img src="/landing/assets/img/blog-3.jpg" alt="Графики и анализ на бизнес данни" loading="lazy" width="800" height="520" /></div><div class="bbody"><div class="bmeta"><span class="bc">Бизнес растеж</span><span>·</span><span>6 мин</span></div><h3>5 признака, че е време да автоматизирате счетоводството си</h3><span class="rmore">Прочетете още →</span></div></a>
  <a class="card card-hover bcard reveal" data-delay="1" href="/contact"><div class="bthumb"><img src="/landing/assets/img/blog-4.jpg" alt="Финансови отчети и таблици" loading="lazy" width="800" height="520" /></div><div class="bbody"><div class="bmeta"><span class="bc">Данъци</span><span>·</span><span>7 мин</span></div><h3>Данъчен календар 2026: ключовите срокове за всеки собственик</h3><span class="rmore">Прочетете още →</span></div></a>
  <a class="card card-hover bcard reveal" data-delay="2" href="/contact"><div class="bthumb"><img src="/landing/assets/img/blog-5.jpg" alt="Евро банкноти и монети" loading="lazy" width="800" height="520" /></div><div class="bbody"><div class="bmeta"><span class="bc">Съответствие</span><span>·</span><span>4 мин</span></div><h3>Преходът към евро: какво да очаквате след 8 август 2026</h3><span class="rmore">Прочетете още →</span></div></a>
</div></div></section>`;

S.faq = (asH1) => `
<section class="section-pad" id="faq"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">Въпроси</span>${asH1 ? '<h1 class="section-title">Често задавани въпроси</h1>' : '<h2 class="section-title">Въпроси и отговори</h2>'}<p class="section-sub">Не намирате отговор? Пишете ни, отговаряме на български.</p></div><div class="faq reveal">
  <details class="faq-item" open><summary class="faq-q">Има ли безплатен период?<span class="pm"><i data-lucide="plus" style="width:17px;height:17px"></i></span></summary><div class="faq-a">Да, 7 дни безплатно, без банкова карта. Можете да изпробвате качване, AI извличане, преглед и отчети с реални документи.</div></details>
  <details class="faq-item"><summary class="faq-q">Мога ли да прекратя по всяко време?<span class="pm"><i data-lucide="plus" style="width:17px;height:17px"></i></span></summary><div class="faq-a">Да. Сменяте плана или прекратявате по всяко време от настройките на акаунта, без срокове и неустойки.</div></details>
  <details class="faq-item"><summary class="faq-q">Сигурни ли са данните ми?<span class="pm"><i data-lucide="plus" style="width:17px;height:17px"></i></span></summary><div class="faq-a">Данните се пазят с изолация по фирма (Postgres RLS), хостинг в ЕС, шифроване и пълна одитна следа. AI услугите са без задържане и не се обучават върху вашите данни.</div></details>
  <details class="faq-item"><summary class="faq-q">Как се подава ДДС?<span class="pm"><i data-lucide="plus" style="width:17px;height:17px"></i></span></summary><div class="faq-a">Дневниците покупки и продажби и справка-декларацията се попълват автоматично от осчетоводените документи. В MVP се експортират за подаване; директното подаване към НАП е в пътната карта.</div></details>
  <details class="faq-item"><summary class="faq-q">Поддържа ли български фирми и формати?<span class="pm"><i data-lucide="plus" style="width:17px;height:17px"></i></span></summary><div class="faq-a">Да. Платформата е създадена за България: ЕИК и VIES проверки, ставки ДДС 20/9/0%, национален сметкоплан, коректна кирилица и EUR + лв.</div></details>
  <details class="faq-item"><summary class="faq-q">Поддържа ли фактури и ДДС?<span class="pm"><i data-lucide="plus" style="width:17px;height:17px"></i></span></summary><div class="faq-a">Да, издаване на фактури, кредитни и дебитни известия и проформи с последователна номерация, живи суми нето/ДДС/бруто и ДДС дневници.</div></details>
  <details class="faq-item"><summary class="faq-q">Има ли вход с Google?<span class="pm"><i data-lucide="plus" style="width:17px;height:17px"></i></span></summary><div class="faq-a">Да, можете да влизате с Google или с имейл и парола. Всеки достъп се записва в одитната следа.</div></details>
  <details class="faq-item"><summary class="faq-q">Подходящо ли е за счетоводители?<span class="pm"><i data-lucide="plus" style="width:17px;height:17px"></i></span></summary><div class="faq-a">Да. Управлявате много клиенти от един акаунт с отделно работно пространство и строга изолация на данните за всеки.</div></details>
</div></div></section>`;

S.finalCta = `
<section class="dark section-pad final-cta"><div class="wrap wrap-narrow"><h2 class="reveal">Готови ли сте да автоматизирате счетоводството?</h2><p class="reveal" data-delay="1">Започнете безплатно днес, без банкова карта.</p><div class="hero-cta reveal" data-delay="2"><a class="btn btn-primary btn-lg" href="/pricing">Започни безплатно <i class="arrow" data-lucide="arrow-right"></i></a><a class="btn btn-light btn-lg" href="/contact">Заявете демо</a></div></div></section>`;

S.aboutIntro = `
<section class="section-pad" id="about" style="padding-top:130px"><div class="wrap"><div class="section-head reveal"><span class="eyebrow">За нас</span><h1 class="section-title">Защо създадохме<br />MGI-Delta</h1><p class="section-sub">Вярваме, че собственикът на малък бизнес не трябва да избира между това да върти бизнеса си и да се бори с фактури и ДДС.</p></div>
  <div class="acc-grid" style="margin-top:20px"><div class="reveal"><h2 style="font-size:var(--mkt-h3);margin-bottom:10px">Нашата мисия</h2><p style="color:var(--color-text-secondary)">Да направим счетоводството разбираемо и автоматично за малките фирми, фрийлансърите и самонаетите в България — с AI, който върши рутината, и човек, който решава важното.</p><h2 style="font-size:var(--mkt-h3);margin:24px 0 10px">За кого е</h2><p style="color:var(--color-text-secondary)">За хора, които искат да управляват финансите си сами, и за счетоводители, които обслужват много клиенти. Платформата говори български, мисли в лева и евро и спазва изискванията на НАП.</p></div>
  <div class="reveal" data-delay="1"><div class="card" style="padding:26px"><ul class="checklist" style="margin-top:0"><li><span class="tick"><i data-lucide="check"></i></span>Точност чрез детерминирани проверки, не само AI</li><li><span class="tick"><i data-lucide="check"></i></span>Прозрачност — всяко число е проследимо до документ</li><li><span class="tick"><i data-lucide="check"></i></span>Сигурност и поверителност на данните в ЕС</li><li><span class="tick"><i data-lucide="check"></i></span>Създадено и поддържано за българския пазар</li></ul></div></div></div>
</div></section>`;

S.contact = `
<section class="section-pad" id="contact" style="padding-top:130px"><div class="wrap wrap-narrow"><div class="section-head reveal"><span class="eyebrow">Контакти</span><h1 class="section-title">Свържете се с нас</h1><p class="section-sub">Имате въпрос или искате демо? Пишете ни — отговаряме на български в рамките на работния ден.</p></div>
  <div class="card reveal" style="padding:28px;max-width:620px;margin-inline:auto">
    <form id="contactForm">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div><label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px" for="cname">Име</label><input id="cname" required style="width:100%;height:44px;padding:0 12px;border:1px solid var(--color-border-default);border-radius:var(--radius-sm)" /></div>
        <div><label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px" for="cemail">Имейл</label><input id="cemail" type="email" required style="width:100%;height:44px;padding:0 12px;border:1px solid var(--color-border-default);border-radius:var(--radius-sm)" /></div>
      </div>
      <label style="display:block;font-size:13px;font-weight:600;margin:14px 0 6px" for="cmsg">Съобщение</label>
      <textarea id="cmsg" required style="width:100%;min-height:120px;padding:12px;border:1px solid var(--color-border-default);border-radius:var(--radius-sm);font-family:inherit"></textarea>
      <button class="btn btn-primary btn-lg" type="submit" style="margin-top:16px;width:100%"><i data-lucide="send" style="width:16px;height:16px"></i> Изпрати</button>
      <p id="cnote" style="font-size:13px;color:var(--neutral-500);margin-top:12px"></p>
    </form>
  </div>
  <p style="text-align:center;color:var(--neutral-500);font-size:14px;margin-top:24px">Или ни пишете директно: <a href="mailto:hello@mgi-delta.bg">hello@mgi-delta.bg</a></p>
</div>
<script>(function(){var f=document.getElementById('contactForm');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var n=encodeURIComponent(document.getElementById('cname').value),m=encodeURIComponent(document.getElementById('cmsg').value),em=document.getElementById('cemail').value;window.location.href='mailto:hello@mgi-delta.bg?subject='+encodeURIComponent('Запитване от '+decodeURIComponent(n))+'&body='+m+encodeURIComponent('\\n\\nИмейл за връзка: '+em);document.getElementById('cnote').textContent='Отваряме вашия имейл клиент…';});})();</script>`;

// ---- JSON-LD helpers ------------------------------------------------------
const orgLd = { '@context': 'https://schema.org', '@type': 'Organization', name: 'MGI-Delta', url: SITE, logo: SITE + '/landing/assets/app-icon.svg' };
const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.n, item: SITE + it.u })) });

// ---- PAGES ----------------------------------------------------------------
const PAGES = [
  { key: 'home', file: 'index.html', url: '/', title: 'Счетоводство без счетоводител · MGI-Delta · за малки фирми и самонаети',
    desc: 'Управлявайте счетоводството на бизнеса си сами. MGI-Delta автоматизира фактури, ДДС, разходи и отчети с AI. За малки фирми, фрийлансъри и самонаети в България.',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'MGI-Delta', url: SITE },
    body: S.hero + S.trust + S.stats + S.problem + S.solution + S.features(true) + S.testimonials + S.finalCta },
  { key: 'features', file: 'features.html', url: '/features', title: 'Функции · MGI-Delta',
    desc: 'AI извличане, фактуриране, ДДС и НАП, табло и отчети, сигурност и пътна карта — всички възможности на MGI-Delta.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Функции', u: '/features' }]),
    body: S.features(false) + S.diveAI + S.diveVat + S.diveInvoice + S.diveDash + S.security + S.roadmap + S.finalCta },
  { key: 'pricing', file: 'pricing.html', url: '/pricing', title: 'Цени и планове · MGI-Delta',
    desc: 'Прозрачни планове Starter, Business, Premium и Счетоводна къща. 7-дневен безплатен период, без банкова карта.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Цени', u: '/pricing' }]),
    body: S.pricing + S.accountants + S.faq(false) + S.finalCta },
  { key: 'about', file: 'about.html', url: '/about', title: 'За нас · MGI-Delta',
    desc: 'Защо създадохме MGI-Delta — автоматизирано счетоводство за малкия бизнес и счетоводителите в България.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'За нас', u: '/about' }]),
    body: S.aboutIntro + S.accountants + S.security + S.testimonials + S.finalCta },
  { key: 'blog', file: 'blog.html', url: '/blog', title: 'Блог · счетоводство, ДДС и данъци · MGI-Delta',
    desc: 'Практични статии за счетоводство, ДДС, данъци и растеж на бизнеса в България.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Блог', u: '/blog' }]),
    body: '<div style="height:84px"></div>' + S.blog + S.finalCta },
  { key: 'resources', file: 'resources.html', url: '/resources', title: 'Ресурси · ръководства и шаблони · MGI-Delta',
    desc: 'Ръководства, шаблони, данъчен календар и помощен център за счетоводство и ДДС в България.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Ресурси', u: '/resources' }]),
    body: '<div style="height:84px"></div>' + S.resources + S.finalCta },
  { key: 'faq', file: 'faq.html', url: '/faq', title: 'Често задавани въпроси · MGI-Delta',
    desc: 'Отговори за безплатния период, сигурността, ДДС, фактури, Google вход и работа за счетоводители.',
    jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      ['Има ли безплатен период?', 'Да, 7 дни безплатно, без банкова карта.'],
      ['Мога ли да прекратя по всяко време?', 'Да, по всяко време от настройките на акаунта, без неустойки.'],
      ['Сигурни ли са данните ми?', 'Изолация по фирма (Postgres RLS), хостинг в ЕС, шифроване и одитна следа.'],
      ['Поддържа ли български фирми и формати?', 'Да — ЕИК, VIES, ДДС 20/9/0%, национален сметкоплан, кирилица, EUR+лв.'],
    ].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    body: '<div style="height:84px"></div>' + S.faq(true) + S.finalCta },
  { key: 'contact', file: 'contact.html', url: '/contact', title: 'Контакти · MGI-Delta',
    desc: 'Свържете се с екипа на MGI-Delta — въпроси, демо и поддръжка на български.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Контакти', u: '/contact' }]),
    body: S.contact },
];

for (const p of PAGES) {
  const html = head(p) + nav(p.key) + p.body + footer();
  writeFileSync(join(OUT, p.file), html, 'utf8');
  console.log('wrote landing/' + p.file);
}

// ---- sitemap.xml + robots.txt --------------------------------------------
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map((p) => `  <url><loc>${SITE}${p.url}</loc><changefreq>weekly</changefreq><priority>${p.url === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>`;
writeFileSync(join(PUB, 'sitemap.xml'), sitemap, 'utf8');
writeFileSync(join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /landing/admin.html\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');
console.log('wrote sitemap.xml + robots.txt');
