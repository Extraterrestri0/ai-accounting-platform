/* ============================================================================
   Static multi-page generator for the MGI-Delta marketing site (hiline-style).
   Clean white + deep teal + sage. Inline SVG icons (no external CDN), native
   <details> menus. Run:  node apps/web/scripts/build-landing.mjs
   Output: apps/web/public/landing/*.html + public/sitemap.xml + public/robots.txt
   ============================================================================ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'public', 'landing');
const PUB = join(__dir, '..', 'public');
const SITE = 'https://mgi-delta.bg';
const V = 'v=18';
mkdirSync(OUT, { recursive: true });

/* ---- inline SVG icons (stroke = currentColor) ---------------------------- */
const s = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  arrow: s('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.4),
  upload: s('<path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16"/>'),
  spark: s('<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>'),
  check: s('<path d="M20 6 9 17l-5-5"/>', 2.4),
  file: s('<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>'),
  bank: s('<path d="M3 21h18M5 21V9l7-4 7 4v12M9 21v-6h6v6"/>'),
  chart: s('<path d="M4 19V9m5 10V5m5 14v-7m5 7v-3"/>'),
  wallet: s('<path d="M3 7h18v12H3zM3 11h18M16 15h2"/>'),
  shield: s('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>'),
  user: s('<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 21a7 7 0 0 1 14 0"/>'),
  store: s('<path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6"/>'),
  cart: s('<path d="M3 4h2l2 12h11l2-8H6M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2m9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/>'),
  book: s('<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h7"/>'),
  cal: s('<path d="M4 5h16v16H4zM4 9h16M8 3v4M16 3v4"/>'),
  life: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>'),
  li: s('<path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4" stroke-width="1.6"/>', 0),
  fb: s('<path d="M14 8h2V5h-2c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2l1-3h-3V8z" stroke-width="1.4"/>', 0),
  menu: s('<path d="M4 7h16M4 12h16M4 17h16"/>'),
};

/* ---- shared head --------------------------------------------------------- */
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
<meta name="theme-color" content="#0E3B36" />
<link rel="icon" href="/landing/assets/app-icon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/landing/assets/tokens.css?${V}" />
<link rel="stylesheet" href="/landing/assets/site.css?${V}" />
<script type="application/ld+json">${JSON.stringify(p.jsonld)}</script>
</head>
<body>`;

const NAVITEMS = [
  ['/features', 'Функции'], ['/#how', 'Как работи'], ['/about', 'За кого'],
  ['/pricing', 'Цени'], ['/resources', 'Ресурси'], ['/faq', 'Въпроси'],
];
const nav = (active) => `
<header class="nav">
  <div class="nav-inner">
    <a class="brand" href="/"><span class="mk">С</span>Счетоводство</a>
    <nav class="nlinks">${NAVITEMS.map(([h, t]) => `<a href="${h}"${h === active ? ' class="on"' : ''}>${t}</a>`).join('')}</nav>
    <div class="nact">
      <a class="btn btn-ghost btn-sm" href="/login">Вход</a>
      <a class="btn btn-dark btn-sm" href="/register">Започни</a>
    </div>
    <details class="mnav">
      <summary aria-label="Меню">${I.menu}</summary>
      <div class="mpanel">
        ${NAVITEMS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}
        <a class="btn btn-out" href="/login">Вход</a>
        <a class="btn btn-dark" href="/register">Започни безплатно</a>
      </div>
    </details>
  </div>
</header>
<main>`;

const footer = () => `</main>
<footer class="footer">
  <div class="wrap">
    <div class="fgrid">
      <div class="fbrand"><a class="brand" href="/" style="color:#fff"><span class="mk">С</span>Счетоводство</a><p>AI счетоводство за самонаети, фрийлансъри и малки фирми. От фактура до готов отчет, без ръчно въвеждане.</p></div>
      <div><h4>Продукт</h4><a href="/features">Функции</a><a href="/pricing">Цени</a><a href="/#how">Как работи</a><a href="/features#security">Сигурност</a></div>
      <div><h4>Ресурси</h4><a href="/blog">Блог</a><a href="/resources">Ръководства</a><a href="/faq">Въпроси</a><a href="/contact">Помощ</a></div>
      <div><h4>Компания</h4><a href="/about">За нас</a><a href="/contact">Контакти</a><a href="/landing/legal/privacy.html">Поверителност</a><a href="/landing/legal/terms.html">Общи условия</a></div>
    </div>
    <div class="fbot">
      <span>© <span>2026</span> MGI-Delta · EUR · ЕС · Хостинг в ЕС</span>
      <div class="soc"><a href="#" aria-label="LinkedIn">${I.li}</a><a href="#" aria-label="Facebook">${I.fb}</a></div>
    </div>
  </div>
</footer>
</body></html>`;

/* ---- reusable sections --------------------------------------------------- */
const finalCta = () => `
<div class="wrap"><div class="cta">
  <h2>Започни да си водиш сметките днес.</h2>
  <p>7 дни безплатно. Без банкова карта.</p>
  <div style="margin-top:30px"><a class="btn btn-on btn-lg" href="/register">Започни безплатно <span class="ar">${I.arrow}</span></a></div>
</div></div>`;

const logos = () => `
<div class="logos"><div class="wrap"><div class="lab">Доверено от собственици на малки фирми в България</div>
<div class="logo-row"><span>Бета ЕООД</span><span>Арка</span><span>Грийн Фуудс</span><span>Нова Веб</span><span>Студио 7</span><span>Прима</span></div></div></div>`;

const how = () => `
<section id="how"><div class="wrap">
  <div class="sec-head"><div class="lab">Как работи</div><h2>От документ до готов отчет — в три стъпки.</h2><p>AI върши рутината, ти решаваш важното.</p></div>
  <div class="three">
    <div class="hcard"><span class="ic">${I.upload}</span><h3>1 · Качваш</h3><p>Снимка, PDF или XML — както ти е удобно.</p></div>
    <div class="hcard"><span class="ic">${I.spark}</span><h3>2 · AI разчита</h3><p>Извлича данните и предлага осчетоводяване.</p></div>
    <div class="hcard"><span class="ic">${I.check}</span><h3>3 · Ти одобряваш</h3><p>Един преглед и готово. ДДС и отчетите се пълнят сами.</p></div>
  </div>
</div></section>`;

const beforeAfter = () => `
<section><div class="wrap"><div class="block sage"><div class="wrap">
  <div class="sec-head"><div class="lab">Защо MGI-Delta</div><h2>Хаосът с документите спира тук.</h2></div>
  <div class="ba-grid">
    <div class="ba-col bad"><h3>Без платформа</h3>
      <div class="ba-li"><span class="mark x">✕</span> Часове ръчно въвеждане поле по поле</div>
      <div class="ba-li"><span class="mark x">✕</span> Фактури разпилени по имейли и папки</div>
      <div class="ba-li"><span class="mark x">✕</span> Пропуснати ДДС срокове и грешки</div>
      <div class="ba-li"><span class="mark x">✕</span> Зависимост от счетоводител за всичко</div>
    </div>
    <div class="ba-col"><h3>С MGI-Delta</h3>
      <div class="ba-li"><span class="mark ok">✓</span> AI извлича данните автоматично</div>
      <div class="ba-li"><span class="mark ok">✓</span> Всичко на едно място, защитено</div>
      <div class="ba-li"><span class="mark ok">✓</span> Готови ДДС дневници и декларация</div>
      <div class="ba-li"><span class="mark ok">✓</span> Управляваш финансите си сам</div>
    </div>
  </div>
</div></div></div></section>`;

const SERVICES = [
  [I.spark, 'AI извличане', 'Разчита фактури и документи автоматично.'],
  [I.file, 'Фактуриране', 'Издаване с последователна номерация и PDF.'],
  [I.bank, 'ДДС и НАП', 'Дневници и справка-декларация, готови за подаване.'],
  [I.chart, 'Отчети', 'ОПР, баланс и оборотна ведомост, на живо.'],
  [I.wallet, 'Разходи', 'Извличане и категоризиране на разходите.'],
  [I.shield, 'Сигурен архив', 'Защитено съхранение (WORM), данни в ЕС.'],
];
const services = (head = true) => `
<section id="features"><div class="wrap">
  ${head ? `<div class="sec-head"><div class="lab">Какво можеш</div><h2>Всичко за финансите на бизнеса ти.</h2><p>Създадено за самонаети, фрийлансъри и малки фирми в България.</p></div>` : ''}
  <div class="grid6">
    ${SERVICES.map(([ic, t, d]) => `<div class="svc"><span class="ic">${ic}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
</div></section>`;

const metrics = () => `
<section><div class="wrap"><div class="block mint"><div class="wrap"><div class="metrics">
  <div class="metric"><div class="n">98.7%</div><div class="l">точност при извличане</div></div>
  <div class="metric"><div class="n">12 ч</div><div class="l">спестени на месец</div></div>
  <div class="metric"><div class="n">30k+</div><div class="l">обработени документа</div></div>
  <div class="metric"><div class="n">4.9</div><div class="l">средна оценка</div></div>
</div></div></div></div></section>`;

const benefits = () => `
<section><div class="wrap">
  <div class="sec-head"><div class="lab">Защо да изберете нас</div><h2>Спокойствие, на което можеш да стъпиш.</h2></div>
  <div class="benes">
    <div class="bene"><span class="num">1</span><div><h3>Детерминирани проверки, не само AI</h3><p>ЕИК, VIES, IBAN и Основа + ДДС = Общо се проверяват автоматично.</p></div></div>
    <div class="bene"><span class="num">2</span><div><h3>Всяко число е проследимо до документ</h3><p>Пълна прозрачност и одитна следа за всяко действие.</p></div></div>
    <div class="bene"><span class="num">3</span><div><h3>Данните ти са в ЕС</h3><p>Хостинг и обработка в ЕС; AI услугите са без задържане на данни.</p></div></div>
    <div class="bene"><span class="num">4</span><div><h3>Създадено за България</h3><p>ЕИК, ДДС режими, национален сметкоплан, коректна кирилица и EUR.</p></div></div>
    <div class="bene"><span class="num">5</span><div><h3>Без счетоводител</h3><p>Управляваш финансите на бизнеса си сам — спокойно и разбираемо.</p></div></div>
  </div>
</div></section>`;

const testimonial = () => `
<section style="padding-top:0"><div class="wrap"><div class="quote">
  <blockquote>„Нямам счетоводител. Качвам фактурите, AI ги разчита, аз одобрявам — и ДДС-то ми е готово за минути.“</blockquote>
  <div class="who"><span class="av">МД</span><div style="text-align:left"><div class="wn">Мартин Делчев</div><div class="wr">Собственик · онлайн магазин</div></div></div>
</div></div></section>`;

const PLANS = [
  ['Starter', 'За самонаети и малки фирми.', '€7', '/мес.', 'таксува се €84 / год.', false, '/register?plan=starter', 'Започни безплатно',
    ['1 фирма', 'До 50 документа/мес.', 'AI извличане от документи', 'Издаване на фактури', 'ДДС дневници', 'Поддръжка по имейл']],
  ['Business', 'За растящи фирми с повече документи.', '€15', '/мес.', 'таксува се €180 / год.', true, '/register?plan=business', 'Започни безплатно',
    ['До 3 фирми', 'До 300 документа/мес.', 'AI извличане от документи', 'Издаване на фактури', 'Отчети (ОВ, ОПР, баланс)', 'Опашка за преглед', 'Приоритетна поддръжка']],
  ['Premium', 'За екипи с няколко дружества.', '€31', '/мес.', 'таксува се €372 / год.', false, '/register?plan=premium', 'Започни безплатно',
    ['До 10 фирми', 'До 1000 документа/мес.', 'Всичко от Business', 'Защитен архив (WORM)', 'Няколко потребители', 'Помощ при стартиране']],
  ['Индивидуален', 'За специфични нужди или по-голям обем.', 'По договаряне', '', 'Оферта по мярка за вашия бизнес', false, '/contact', 'Свържете се с нас',
    ['По-голям обем документи', 'Няколко фирми в един акаунт', 'Всичко от Premium', 'Защитен архив (WORM)', 'Приоритетна поддръжка', 'Персонална настройка']],
];
const pricing = () => `
<section id="pricing"><div class="wrap">
  <div class="sec-head"><div class="lab">Цени</div><h2>Изберете план.</h2><p>7-дневен безплатен период. Сменяйте или прекратявайте по всяко време.</p></div>
  <div class="price-grid">
    ${PLANS.map(([name, desc, price, per, note, pop, href, cta, feats]) => `
    <article class="plan${pop ? ' pop' : ''}">${pop ? '<span class="plan-flag">Най-популярен</span>' : ''}
      <h3>${name}</h3><p class="pdesc">${desc}</p>
      <div class="price${per ? '' : ' txt'}">${price}${per ? `<span class="per"> ${per}</span>` : ''}</div>
      <div class="pnote">${note}</div>
      <ul class="plan-feats">${feats.map((f) => `<li><span class="tk">✓</span>${f}</li>`).join('')}</ul>
      <a class="btn ${pop ? 'btn-dark' : 'btn-out'}" href="${href}">${cta}</a>
    </article>`).join('')}
  </div>
</div></section>`;

const FAQS = [
  ['Има ли безплатен период?', 'Да, 7 дни безплатно, без банкова карта. Можете да изпробвате качване, AI извличане, преглед и отчети с реални документи.'],
  ['Трябва ли ми счетоводител, за да я ползвам?', 'Не. Платформата е създадена да си водите счетоводството сами — AI разчита документите и предлага осчетоводяване, а вие само одобрявате. Подходяща е за самонаети, фрийлансъри и малки фирми.'],
  ['Сигурни ли са данните ми?', 'Данните се пазят с изолация по фирма, хостинг в ЕС, шифроване и пълна одитна следа. AI услугите са без задържане на данни.'],
  ['Как се подава ДДС?', 'Дневниците покупки и продажби и справка-декларацията се попълват автоматично от осчетоводените документи. В MVP се експортират за подаване; директното подаване към НАП е в пътната карта.'],
  ['Поддържа ли български фирми и формати?', 'Да. Платформата е създадена за България: ЕИК и VIES проверки, ставки ДДС 20/9/0%, национален сметкоплан, коректна кирилица и EUR.'],
  ['Мога ли да прекратя по всяко време?', 'Да. Сменяте плана или прекратявате по всяко време от настройките, без срокове и неустойки.'],
];
const faqSec = (asH1) => `
<section><div class="wrap">
  <div class="sec-head"><div class="lab">Въпроси</div>${asH1 ? '<h1 style="font-size:clamp(30px,3.4vw,42px)">Често задавани въпроси</h1>' : '<h2>Често задавани въпроси</h2>'}<p>Не намирате отговор? Пишете ни — отговаряме на български.</p></div>
  <div class="faq">
    ${FAQS.map(([q, a], i) => `<details class="faq-item"${i === 0 ? ' open' : ''}><summary class="faq-q">${q}<span class="pm">+</span></summary><div class="faq-a">${a}</div></details>`).join('')}
  </div>
</div></section>`;

const heroIllustration = `
<div class="ill">
  <div class="blob" style="width:340px;height:340px;background:#DCEBE0;top:28px;right:14px"></div>
  <div class="blob" style="width:180px;height:180px;background:#CFE6DF;bottom:6px;left:50px"></div>
  <div class="card c1"><div class="doc-h">AI извлече данните</div><div class="rw"><span class="muted">Доставчик</span><span class="v">ТЕХНО ПЛЮС ООД</span></div><div class="rw"><span class="muted">Данъчна основа</span><span class="v">1 250,00 €</span></div><div class="rw"><span class="muted">ДДС 20%</span><span class="v">250,00 €</span></div></div>
  <div class="card c2"><span class="mark ok">✓</span><div><div style="font-size:12px;color:var(--muted);font-weight:700">Осчетоводено</div><div style="font-weight:800;font-size:18px">1 500,00 €</div></div></div>
  <div class="c3"><span class="pill-ok">ДДС за внасяне · 1 260 €</span></div>
</div>`;

const hero = (eyebrow, h1, lead) => `
<div class="wrap"><div class="hero">
  <div>
    <span class="ey">${eyebrow}</span>
    <h1>${h1}</h1>
    <p class="lead">${lead}</p>
    <div class="hcta"><a class="btn btn-dark btn-lg" href="/register">Започни безплатно <span class="ar">${I.arrow}</span></a><a class="btn btn-out btn-lg" href="/#how">Виж как работи</a></div>
    <div class="htrust">Без банкова карта · 7 дни безплатно · Данни в ЕС</div>
  </div>
  ${heroIllustration}
</div></div>`;

/* ---- page-specific blocks ------------------------------------------------ */
const aboutIntro = () => `
<section><div class="wrap"><div class="sec-head"><div class="lab">За нас</div><h2>Защо създадохме MGI-Delta.</h2><p>Вярваме, че собственикът на малък бизнес не трябва да избира между това да върти бизнеса си и да се бори с фактури и ДДС.</p></div>
  <div class="benes">
    <div class="bene"><span class="num">●</span><div><h3>Нашата мисия</h3><p>Да направим счетоводството разбираемо и автоматично за малките фирми, фрийлансърите и самонаетите в България — с AI, който върши рутината, и човек, който решава важното.</p></div></div>
    <div class="bene"><span class="num">●</span><div><h3>За кого е</h3><p>За самонаети, фрийлансъри и малки фирми, които искат да управляват финансите на бизнеса си сами, без да плащат на счетоводител. Платформата говори български, мисли в евро и спазва изискванията на НАП.</p></div></div>
  </div>
</div></section>`;

const audience = () => `
<section><div class="wrap"><div class="sec-head"><div class="lab">За кого е</div><h2>Създадено за хора като теб.</h2></div>
  <div class="grid6">
    <div class="svc"><span class="ic">${I.user}</span><h3>Самонаети</h3><p>Фактури, ДДС и отчети за минути.</p></div>
    <div class="svc"><span class="ic">${I.spark}</span><h3>Фрийлансъри</h3><p>Следи приходите без счетоводител.</p></div>
    <div class="svc"><span class="ic">${I.store}</span><h3>Малки фирми и ЕООД</h3><p>Пълно счетоводство, самостоятелно.</p></div>
    <div class="svc"><span class="ic">${I.cart}</span><h3>Онлайн магазини</h3><p>Много документи, обработени бързо.</p></div>
  </div>
</div></section>`;

const contactSec = () => `
<section><div class="wrap"><div class="sec-head"><div class="lab">Контакти</div><h1 style="font-size:clamp(30px,3.4vw,42px)">Свържете се с нас.</h1><p>Въпрос или демо? Пишете ни — отговаряме на български в рамките на работния ден.</p></div>
  <form class="form" onsubmit="return false">
    <div class="frow">
      <div><label for="cn">Име</label><input id="cn" required /></div>
      <div><label for="ce">Имейл</label><input id="ce" type="email" required /></div>
    </div>
    <label for="cm" style="display:block;margin-top:14px">Съобщение</label>
    <textarea id="cm" required></textarea>
    <button class="btn btn-dark btn-lg" type="submit" style="margin-top:16px;width:100%">Изпрати <span class="ar">${I.arrow}</span></button>
  </form>
  <p style="text-align:center;color:var(--muted);font-size:14px;margin-top:18px">Или директно: <a href="mailto:hello@mgi-delta.bg" style="color:var(--sage-d);font-weight:600">hello@mgi-delta.bg</a></p>
</div></section>`;

const BLOG = [
  ['blog-1.jpg', 'ДДС', 'ДДС за начинаещи: как да подадете първата си справка-декларация без грешки'],
  ['blog-2.jpg', 'Счетоводство', 'Неизменяема главна книга: защо сторното е по-добро от изтриването'],
  ['blog-3.jpg', 'Бизнес растеж', '5 признака, че е време да автоматизирате счетоводството си'],
  ['blog-4.jpg', 'Данъци', 'Данъчен календар 2026: ключовите срокове за всеки собственик'],
  ['blog-5.jpg', 'Съответствие', 'Преходът към евро: какво да очаквате'],
];
const blogSec = () => `
<section><div class="wrap"><div class="sec-head"><div class="lab">Блог</div><h1 style="font-size:clamp(30px,3.4vw,42px)">От блога.</h1><p>Практични статии за счетоводство, ДДС и растеж на бизнеса.</p></div>
  <div class="cards3">${BLOG.map(([img, cat, t]) => `<a class="bcard" href="/contact"><div class="bthumb"><img src="/landing/assets/img/${img}" alt="" loading="lazy" width="640" height="400" /></div><div class="bbody"><div class="bmeta">${cat}</div><h3>${t}</h3></div></a>`).join('')}</div>
</div></section>`;

const RES = [
  [I.book, 'Ръководства', 'Стъпка по стъпка през ДДС, фактури и осчетоводяване.'],
  [I.cal, 'Данъчен календар', 'Всички срокове за ДДС и данъци за 2026.'],
  [I.file, 'Шаблони', 'Готови шаблони за фактури, протоколи и справки.'],
  [I.life, 'Помощен център', 'База знания и отговори на често задавани въпроси.'],
  [I.chart, 'Контролни списъци', 'Месечни и годишни чеклисти за изряден бизнес.'],
  [I.spark, 'Видео уроци', 'Кратки видеа как да свършите всяка задача.'],
];
const resourcesSec = () => `
<section><div class="wrap"><div class="sec-head"><div class="lab">Ресурси</div><h1 style="font-size:clamp(30px,3.4vw,42px)">Ресурси, които работят за вас.</h1><p>Ръководства, шаблони и инструменти за счетоводство, ДДС и данъци.</p></div>
  <div class="grid6">${RES.map(([ic, t, d]) => `<div class="rcard"><span class="ic">${ic}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
</div></section>`;

/* ---- pages --------------------------------------------------------------- */
const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.n, item: SITE + it.u })) });

const PAGES = [
  { key: '/', file: 'index.html', url: '/',
    title: 'Счетоводство без счетоводител · MGI-Delta · за малки фирми и самонаети',
    desc: 'Води си счетоводството сам. MGI-Delta автоматизира фактури, ДДС, разходи и отчети с AI — за самонаети, фрийлансъри и малки фирми в България.',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'MGI-Delta', url: SITE },
    body: hero('За самонаети, фрийлансъри и малки фирми', 'От хаос с фактурите към спокойни финанси.', 'Снимай документа, AI го разчита, ти одобряваш. Готови ДДС и отчети — води си счетоводството сам, без счетоводител.')
      + logos() + how() + beforeAfter() + services() + metrics() + benefits() + testimonial() + finalCta() },
  { key: '/features', file: 'features.html', url: '/features', title: 'Функции · MGI-Delta',
    desc: 'AI извличане, фактуриране, ДДС и НАП, отчети, разходи и сигурен архив — всичко, за да водите счетоводството си сами.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Функции', u: '/features' }]),
    body: hero('Функции', 'Всичко за финансите на бизнеса ти.', 'Създадено за самонаети, фрийлансъри и малки фирми в България — без счетоводител.')
      + services(false) + how() + beforeAfter() + benefits() + finalCta() },
  { key: '/pricing', file: 'pricing.html', url: '/pricing', title: 'Цени и планове · MGI-Delta',
    desc: 'Прозрачни планове Starter, Business, Premium и Индивидуален. 7-дневен безплатен период, без банкова карта.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Цени', u: '/pricing' }]),
    body: pricing() + metrics() + faqSec(false) + finalCta() },
  { key: '/about', file: 'about.html', url: '/about', title: 'За нас · MGI-Delta',
    desc: 'Защо създадохме MGI-Delta — автоматизирано счетоводство за самонаети, фрийлансъри и малки фирми в България.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'За нас', u: '/about' }]),
    body: aboutIntro() + audience() + metrics() + finalCta() },
  { key: '/blog', file: 'blog.html', url: '/blog', title: 'Блог · счетоводство, ДДС и данъци · MGI-Delta',
    desc: 'Практични статии за счетоводство, ДДС, данъци и растеж на бизнеса в България.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Блог', u: '/blog' }]),
    body: blogSec() + finalCta() },
  { key: '/resources', file: 'resources.html', url: '/resources', title: 'Ресурси · ръководства и шаблони · MGI-Delta',
    desc: 'Ръководства, шаблони, данъчен календар и помощен център за счетоводство и ДДС в България.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Ресурси', u: '/resources' }]),
    body: resourcesSec() + finalCta() },
  { key: '/faq', file: 'faq.html', url: '/faq', title: 'Често задавани въпроси · MGI-Delta',
    desc: 'Отговори за безплатния период, сигурността, ДДС, фактури и работа без счетоводител.',
    jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    body: faqSec(true) + finalCta() },
  { key: '/contact', file: 'contact.html', url: '/contact', title: 'Контакти · MGI-Delta',
    desc: 'Свържете се с екипа на MGI-Delta — въпроси, демо и поддръжка на български.',
    jsonld: crumbs([{ n: 'Начало', u: '/' }, { n: 'Контакти', u: '/contact' }]),
    body: contactSec() },
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
