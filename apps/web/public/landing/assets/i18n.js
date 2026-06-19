/* ============================================================================
   Счетоводство — Lightweight BG↔EN switcher for the static landing.
   Walks text nodes once, swaps Bulgarian → English from the EN map below, and
   restores Bulgarian on toggle. Anything not in the map simply stays as-is, so
   coverage can grow over time without breaking the page. Persists choice in
   localStorage and updates <html lang>. No dependencies.
   ============================================================================ */
(function () {
  'use strict';

  var EN = {
    // ---- Nav / mobile ----
    'Функции': 'Features', 'Решения': 'Solutions', 'Цени': 'Pricing', 'Ресурси': 'Resources',
    'Блог': 'Blog', 'Въпроси': 'FAQ', 'Вход': 'Log in', 'Започнете безплатно': 'Start free',
    'Заявете демо': 'Book a demo', 'Меню': 'Menu', 'Затвори': 'Close',
    'AI извличане': 'AI extraction', 'Разчита фактури и документи': 'Reads invoices & documents',
    'ДДС и НАП': 'VAT & NRA', 'Регистри, декларация, подаване': 'Registers, return, filing',
    'Фактуриране': 'Invoicing', 'Издаване с номерация и PDF': 'Sequential numbering and PDF',
    'Табло и отчети': 'Dashboard & reports', 'ОВ, ОПР, баланс': 'TB · P&L · balance',
    'Преглед и одобрение': 'Review & approval', 'Човек решава всичко важно': 'A human decides everything important',
    'Сигурен архив': 'Secure archive', 'Защитено съхранение (WORM)': 'Tamper-proof storage (WORM)',
    'Без счетоводител': 'No accountant needed', 'Водете си сметките сами': 'Do your own books', 'Малки фирми и ЕООД': 'Small businesses and sole traders',
    'Малки фирми': 'Small businesses', 'Самостоятелно счетоводство': 'Self-serve accounting',
    'Самонаети и фрийлансъри': 'Self-employed & freelancers', 'Фактури, ДДС и отчети': 'Invoices, VAT & reports',
    'Ръководства': 'Guides', 'Стъпка по стъпка': 'Step by step', 'Данъчен календар': 'Tax calendar',
    'Срокове за 2026': '2026 deadlines', 'Помощен център': 'Help center', 'Отговори и поддръжка': 'Answers & support',

    // ---- Hero ----
    'За малки фирми, фрийлансъри и самонаети': 'For small businesses, freelancers & the self-employed',
    'Счетоводство, опростено.': 'Accounting, simplified.',
    'Без счетоводител.': 'No accountant needed.',
    'MGI-Delta автоматизира фактурите, ДДС, разходите и отчетите. AI разчита документите, а вие само одобрявате — управлявайте финансите на бизнеса си сами, без ръчно въвеждане.':
      'MGI-Delta automates invoices, VAT, expenses and reports. AI reads your documents and you simply approve — run your business finances yourself, with no manual data entry.',
    'Без банкова карта': 'No card required', '7 дни безплатно': '7 days free',

    // ---- Hero mockup ----
    'Осчетоводено': 'Posted', 'ДДС за внасяне · 05/2026': 'VAT due · 05/2026', '96% сигурност': '96% confidence',
    'Преглед на документ': 'Document review', 'AI извлечени данни': 'AI-extracted data',
    'Доставчик': 'Supplier', 'Проверено': 'Verified', 'Дата': 'Date', 'Данъчна основа': 'Tax base',
    'Общо': 'Total', 'Предложено осчетоводяване': 'Suggested posting',
    '602 · Външни услуги': '602 · External services', '4531 · Начислен ДДС': '4531 · Input VAT',
    '401 · Доставчици': '401 · Suppliers', 'Одобри и осчетоводи': 'Approve & post',

    // ---- Trust bar ----
    'Създадено за България': 'Built for Bulgaria', 'ЕИК и VIES': 'UIC & VIES',
    'ДДС 20 / 9 / 0 %': 'VAT 20 / 9 / 0%', 'Хостинг в ЕС': 'EU hosting',
    'AI без задържане на данни': 'Zero-retention AI',

    // ---- Stats ----
    'спестено време на месец': 'time saved per month', 'за типична фирма': 'for a typical company',
    'точност при извличане': 'extraction accuracy', 'на данни от документи': 'of document data',
    'обработени документа': 'documents processed', 'през платформата': 'through the platform',
    'средна оценка': 'average rating', 'от потребители': 'from users',

    // ---- Problem ----
    'Проблемът': 'The problem',
    'Ръчното счетоводство': 'Manual accounting', 'губи време и носи риск': 'wastes time and adds risk',
    'Въвеждането на данни на ръка е бавно, скъпо и склонно към грешки.': 'Entering data by hand is slow, costly and error-prone.',
    'Часове ръчно въвеждане': 'Hours of manual entry',
    'Преписването на фактури поле по поле изяжда времето за реална работа.': 'Re-typing invoices field by field eats the time you need for real work.',
    'Грешки и риск при ДДС': 'Errors and VAT risk',
    'Дребна грешка в основа или ДДС се превръща в проблем при проверка и деклариране.': 'A small mistake in the base or VAT becomes a problem at audit and filing.',
    'Разпръснати документи': 'Scattered documents',
    'Фактури в имейли, папки и на хартия, трудно се намират и още по-трудно се архивират.': 'Invoices in emails, folders and on paper — hard to find and harder to archive.',

    // ---- Solution ----
    'Решението': 'The solution',
    'Един надежден поток': 'One reliable flow', 'вместо хаос': 'instead of chaos',
    'MGI-Delta обединява качване, AI извличане, човешки преглед и осчетоводяване в един проследим процес. AI предлага, човекът решава. Числата идват само от главната книга.':
      'MGI-Delta unifies upload, AI extraction, human review and posting into one auditable flow. AI proposes, a human decides. The figures come only from the ledger.',
    'Качване': 'Upload', 'Качете фактура (PDF, снимка или XML).': 'Upload an invoice (PDF, photo or XML).',
    'AI разчита и предлага данните и осчетоводяването.': 'AI reads and proposes the data and the posting.',
    'Преглед': 'Review', 'Човек проверява, коригира и одобрява.': 'A human checks, corrects and approves.',
    'Осчетоводяване': 'Posting', 'Балансирано двустранно записване в неизменяема книга.': 'Balanced double-entry into an immutable ledger.',
    'Отчети': 'Reports', 'ДДС регистри, ОПР и баланс, готови за експорт.': 'VAT registers, P&L and balance, ready to export.',

    // ---- Features ----
    'Възможности': 'Capabilities',
    'Всичко за обработката': 'Everything for processing', 'на документи': 'your documents',
    'Всичко, за да водите счетоводството на бизнеса си сами — създадено за България.': 'Everything to do your own books — built for Bulgaria.',
    'AI извличане от документи': 'AI document extraction',
    'Автоматично разчитане на фактури с извличане на ключови полета.': 'Automatic reading of invoices with key-field extraction.',
    'Управление на фактури': 'Invoice management',
    'Издаване с последователна номерация, PDF и проследяване на статуса.': 'Issuing with gapless numbering, PDF and status tracking.',
    'ДДС и данъчна подготовка': 'VAT & tax prep',
    'Дневници покупки/продажби и данни за справка-декларация, готови за подаване.': 'Purchase/sales journals and VAT-return data, ready to file.',
    'Счетоводни потоци': 'Accounting workflows',
    'Двустранно осчетоводяване в неизменяема главна книга с корекции чрез сторно.': 'Double-entry posting into an immutable ledger with reversing corrections.',
    'Управление на фирми': 'Company management',
    'Няколко фирми в един акаунт със строга изолация на данните.': 'Several companies in one account with strict data isolation.',
    'Документите се пазят защитено (WORM) с временни подписани връзки.': 'Documents kept tamper-proof (WORM) with short-lived signed links.',
    'Човешки преглед и корекция': 'Human review & correction',
    'Опашка за преглед с предложения, валидации и одобрение.': 'A review queue with suggestions, validations and approval.',
    'BG / EN интерфейс': 'BG / EN interface',
    'Български и английски с коректна кирилица и формати.': 'Bulgarian and English with correct Cyrillic and formats.',
    'Проследяване на разходи': 'Expense tracking',
    'Разходите се извличат от документите и се категоризират за ясна картина на парите.': 'Expenses are extracted from documents and categorised for a clear view of your money.',
    'Финансови отчети': 'Financial reports',
    'Оборотна ведомост, ОПР и баланс — на живо от главната книга, готови за експорт.': 'Trial balance, P&L and balance sheet — live from the ledger, ready to export.',
    'Данъчно съответствие': 'Tax compliance',
    'ЗДДС ставки, национален сметкоплан и одитна следа за изряден бизнес.': 'VAT-Act rates, the national chart of accounts and an audit trail for a compliant business.',
    'Табло за финансите': 'Finance dashboard',
    'Какво дължите, какво ви дължат и какви срокове идват — на едно място.': 'What you owe, what you are owed and which deadlines are coming — in one place.',
    'Вижте всички функции': 'See all features',

    // ---- Deep dives ----
    'AI извличане и преглед': 'AI extraction & review',
    'AI предлага.': 'AI proposes.', 'Човекът решава.': 'A human decides.',
    'Опитайте безплатно': 'Try it free', 'Вижте как работи': 'See how it works',
    'Издайте първа фактура': 'Issue your first invoice', 'Отворете таблото': 'Open the dashboard',
    'ДДС и подаване': 'VAT and filing', 'към НАП без стрес': 'to the NRA without stress',
    'Издавайте фактури': 'Issue invoices', 'с живи суми': 'with live totals',
    'Цялата картина': 'The whole picture', 'на бизнеса на едно табло': 'of your business on one dashboard',

    // ---- For accountants ----
    'За счетоводители': 'For accountants',
    'Създадено и за': 'Built also for', 'счетоводни кантори': 'accounting firms',
    'Управлявайте много клиенти от едно място, със строга изолация на всеки.': 'Manage many clients from one place, each strictly isolated.',
    'Много фирми в един акаунт': 'Many companies in one account',
    'Отделно работно пространство за всеки клиент': 'A separate workspace per client',
    'Гарантирана изолация на данните между клиентите': 'Guaranteed data isolation between clients',
    'Бързо превключване между фирми': 'Fast switching between companies',
    'Вижте плановете за кантори': 'See firm plans',

    // ---- Security ----
    'Сигурност': 'Security',
    'Сигурност, на която': 'Security you', 'можете да стъпите': 'can rely on',
    'Архитектура, проектирана да защитава финансови данни.': 'Architecture designed to protect financial data.',
    'Изолация по фирма': 'Per-company isolation',
    'Строго разделяне на данните на ниво база (Postgres RLS), никой не вижда чужди данни.': 'Strict data separation at the database level (Postgres RLS) — nobody sees another tenant.',
    'Неизменяема главна книга': 'Immutable ledger',
    'Осчетоводените записи не се променят и не се трият, корекциите са чрез сторно.': 'Posted entries are never edited or deleted — corrections are reversing entries.',
    'Пълна одитна следа': 'Full audit trail',
    'Всяко чувствително действие се записва: кой, какво и кога, защитено от подмяна.': 'Every sensitive action is recorded: who, what and when, tamper-evident.',
    'Данни в ЕС': 'Data in the EU',
    'Хостинг и обработка в ЕС; AI услугите са без задържане и не се обучават върху вашите данни.': 'Hosted and processed in the EU; AI services are zero-retention and never train on your data.',
    'GDPR съответствие': 'GDPR compliant', 'Шифроване при пренос и покой': 'Encryption in transit & at rest',
    'ЗДДС и КЕП': 'VAT Act & QES',

    // ---- Roadmap ----
    'Пътна карта': 'Roadmap',
    'Подготвено за': 'Ready for', 'следващата стъпка': 'the next step',
    'Платформата е създадена с възможност за разширение. Тези интеграции са в пътната карта.': 'The platform is built to extend. These integrations are on the roadmap.',
    'В плана': 'Planned', 'Банкови извлечения': 'Bank statements',
    'Подготвено за автоматично нанасяне и засичане на плащания.': 'Future-ready for automatic import and payment matching.',
    'Подаване към НАП': 'NRA e-filing',
    'Създадено с възможност за директно подаване; в MVP се експортира за ръчно подаване.': 'Built with direct filing in mind; in the MVP it exports for manual submission.',
    'Онлайн плащания': 'Online payments',
    'Архитектурата е готова за абонаменти и плащания (Stripe-ready).': 'The architecture is ready for subscriptions and payments (Stripe-ready).',
    'Разширени отчети': 'Advanced reporting',
    'Заложена е основата за по-богати справки и анализи.': 'The foundation for richer reports and analytics is in place.',

    // ---- Testimonials ----
    'Отзиви': 'Testimonials',
    'Малки фирми и самонаети,': 'Small businesses and the self-employed', 'които си водят сметките сами': 'who keep their own books',
    'Истории от практиката с MGI-Delta.': 'Real stories from working with MGI-Delta.',

    // ---- Pricing ----
    'Изберете план': 'Choose a plan', 'Сменяйте или прекратявайте по всяко време.': 'Change or cancel any time.',
    'Месечно': 'Monthly', 'Годишно': 'Yearly', 'Спестете 20% при годишно плащане': 'Save 20% with annual billing',
    'За самонаети и малки фирми.': 'For the self-employed and small businesses.',
    'За растящи фирми с повече документи.': 'For growing companies with more documents.',
    'За екипи с няколко дружества.': 'For teams with several companies.',
    'За специфични нужди или по-голям обем.': 'For specific needs or higher volume.', 'По договаряне': 'Custom pricing', 'Оферта по мярка за вашия бизнес': 'A tailored offer for your business',
    'Индивидуален': 'Custom', 'Най-популярен': 'Most popular',
    '7-дневен безплатен период': '7-day free trial', 'Започни безплатно': 'Start free',
    'Свържете се с нас': 'Contact us', '/ мес.': '/ mo',
    '1 фирма': '1 company', 'До 3 фирми': 'Up to 3 companies', 'До 10 фирми': 'Up to 10 companies',
    'Неограничено клиенти': 'Unlimited clients', 'До 50 документа/мес.': 'Up to 50 documents/mo',
    'До 300 документа/мес.': 'Up to 300 documents/mo', 'До 1000 документа/мес.': 'Up to 1000 documents/mo',
    'Индивидуален обем': 'Custom volume', 'Издаване на фактури': 'Invoice issuing', 'ДДС дневници': 'VAT journals',
    'Поддръжка по имейл': 'Email support', 'Отчети (ОВ, ОПР, баланс)': 'Reports (TB, P&L, balance)',
    'Опашка за преглед и одобрение': 'Review & approval queue', 'Приоритетна поддръжка': 'Priority support',
    'Всичко от Business': 'Everything in Business', 'Всичко от Premium': 'Everything in Premium',
    'Защитен архив (WORM)': 'Secure archive (WORM)', 'Няколко потребители': 'Multiple users',
    'Помощ при стартиране': 'Onboarding help', 'Работни пространства за клиенти': 'Client workspaces',
    'Отделен мениджър': 'Dedicated manager', 'API достъп': 'API access',

    // ---- Resources ----
    'Ресурси, които': 'Resources that', 'работят за вас': 'work for you',
    'Ръководства, шаблони и инструменти за счетоводство, ДДС и данъци в България.': 'Guides, templates and tools for accounting, VAT and taxes in Bulgaria.',
    'Стъпка по стъпка през ДДС, фактури и осчетоводяване.': 'Step by step through VAT, invoices and posting.', 'Разгледайте': 'Explore',
    'Шаблони': 'Templates', 'Готови шаблони за фактури, протоколи и справки.': 'Ready templates for invoices, protocols and reports.', 'Изтеглете': 'Download',
    'Всички срокове за ДДС и данъци за 2026 на едно място.': 'All VAT and tax deadlines for 2026 in one place.', 'Вижте сроковете': 'See deadlines',
    'Контролни списъци': 'Checklists', 'Месечни и годишни чеклисти за изряден бизнес.': 'Monthly and yearly checklists for a compliant business.', 'Отворете': 'Open',
    'Видео уроци': 'Video tutorials', 'Кратки видеа как да свършите всяка задача в платформата.': 'Short videos on how to do every task in the platform.', 'Гледайте': 'Watch',
    'База знания и отговори на често задавани въпроси.': 'A knowledge base and answers to frequent questions.', 'Към помощта': 'Go to help',

    // ---- Blog ----
    'От блога': 'From the blog',
    'Практични статии за счетоводство, данъци и растеж на бизнеса.': 'Practical articles on accounting, taxes and business growth.',
    'Всички': 'All', 'Счетоводство': 'Accounting', 'Данъци': 'Taxes', 'ДДС': 'VAT',
    'Бизнес растеж': 'Business growth', 'Съответствие': 'Compliance',
    'ДДС за начинаещи: как да подадете първата си справка-декларация без грешки': 'VAT for beginners: how to file your first return without mistakes',
    'Какво влиза в дневниците покупки и продажби, как се пълни декларацията и кои са най-честите грешки при подаване.': 'What goes into the purchase and sales journals, how the return is filled in, and the most common filing mistakes.',
    'Неизменяема главна книга: защо сторното е по-добро от изтриването': 'The immutable ledger: why a reversal beats deleting',
    '5 признака, че е време да автоматизирате счетоводството си': '5 signs it is time to automate your accounting',
    'Данъчен календар 2026: ключовите срокове за всеки собственик': 'Tax calendar 2026: the key deadlines for every owner',
    'Преходът към евро: какво да очаквате след 8 август 2026': 'The switch to the euro: what to expect after 8 August 2026',
    'Прочетете още →': 'Read more →', 'Всички статии': 'All articles',

    // ---- FAQ ----
    'Въпроси и отговори': 'Questions & answers',
    'Не намирате отговор? Пишете ни, отговаряме на български.': "Can't find an answer? Write to us — we reply in Bulgarian or English.",
    'Има ли безплатен период?': 'Is there a free trial?',
    'Да, 7 дни безплатно, без банкова карта. Можете да изпробвате качване, AI извличане, преглед и отчети с реални документи.': 'Yes — 7 days free, no card required. You can try uploading, AI extraction, review and reports with real documents.',
    'Мога ли да прекратя по всяко време?': 'Can I cancel any time?',
    'Да. Сменяте плана или прекратявате по всяко време от настройките на акаунта, без срокове и неустойки.': 'Yes. Change your plan or cancel any time from account settings, with no lock-in or penalties.',
    'Сигурни ли са данните ми?': 'Is my data secure?',
    'Данните се пазят с изолация по фирма (Postgres RLS), хостинг в ЕС, шифроване и пълна одитна следа. AI услугите са без задържане и не се обучават върху вашите данни.': 'Data is protected with per-company isolation (Postgres RLS), EU hosting, encryption and a full audit trail. AI services are zero-retention and never train on your data.',
    'Как се подава ДДС?': 'How is VAT filed?',
    'Дневниците покупки и продажби и справка-декларацията се попълват автоматично от осчетоводените документи. В MVP се експортират за подаване; директното подаване към НАП е в пътната карта.': 'The purchase/sales journals and the VAT return are filled in automatically from posted documents. In the MVP they are exported for filing; direct submission to the NRA is on the roadmap.',
    'Поддържа ли български фирми и формати?': 'Does it support Bulgarian companies and formats?',
    'Да. Платформата е създадена за България: ЕИК и VIES проверки, ставки ДДС 20/9/0%, национален сметкоплан, коректна кирилица и EUR.': 'Yes. The platform is built for Bulgaria: UIC and VIES checks, VAT rates 20/9/0%, the national chart of accounts, correct Cyrillic and EUR.',
    'Поддържа ли фактури и ДДС?': 'Does it support invoices and VAT?',
    'Да, издаване на фактури, кредитни и дебитни известия и проформи с последователна номерация, живи суми нето/ДДС/бруто и ДДС дневници.': 'Yes — issuing invoices, credit and debit notes and proformas with gapless numbering, live net/VAT/gross totals and VAT journals.',
    'Има ли вход с Google?': 'Is there Google sign-in?',
    'Да, можете да влизате с Google или с имейл и парола. Всеки достъп се записва в одитната следа.': 'Yes, you can sign in with Google or with email and password. Every sign-in is recorded in the audit trail.',
    'Трябва ли ми счетоводител, за да я ползвам?': 'Do I need an accountant to use it?',
    'Не. Платформата е създадена да си водите счетоводството сами — AI разчита документите и предлага осчетоводяване, а вие само одобрявате. Подходяща е за самонаети, фрийлансъри и малки фирми, без нужда от счетоводител.': 'No. The platform is built for you to keep your own books — AI reads documents and proposes the posting, you just approve. Made for the self-employed, freelancers and small businesses, no accountant needed.',

    // ---- Final CTA ----
    'Готови ли сте да автоматизирате счетоводството?': 'Ready to automate your accounting?',
    'Започнете безплатно днес, без банкова карта.': 'Start free today — no card required.',

    // ---- Footer ----
    'AI счетоводство за българския бизнес. От фактура до готов отчет, без ръчно въвеждане.': 'AI accounting for Bulgarian business. From invoice to finished report, with no manual entry.',
    'Бюлетин: данъци и съвети, веднъж месечно': 'Newsletter: taxes & tips, once a month', 'Абонирай': 'Subscribe',
    'Продукт': 'Product', 'Интеграции': 'Integrations', 'Компания': 'Company',
    'За нас': 'About us', 'Контакти': 'Contact', 'Кариери': 'Careers', 'Партньори': 'Partners',
    'Правни': 'Legal', 'Политика за поверителност': 'Privacy Policy', 'Общи условия': 'Terms of Service',
    'Политика за бисквитки': 'Cookie Policy', 'Регистрация': 'Sign up', 'База знания': 'Knowledge base', 'Уебинари': 'Webinars',
    'Платформата е в активна разработка': 'The platform is under active development',
    'Всички права запазени.': 'All rights reserved.'
  };

  // Attributes to translate (placeholders, aria where it helps).
  var ATTRS = [
    { sel: '#news', attr: 'placeholder', en: 'your email' }
  ];

  var nodes = [], attrs = [];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, svg: 1, SVG: 1 };

  function collect() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.parentNode || SKIP[n.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
        if (n.parentNode.closest && n.parentNode.closest('.lang-toggle')) return NodeFilter.FILTER_REJECT;
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = walker.nextNode())) nodes.push({ node: n, bg: n.nodeValue });
    ATTRS.forEach(function (a) {
      var el = document.querySelector(a.sel);
      if (el) attrs.push({ el: el, attr: a.attr, bg: el.getAttribute(a.attr) || '', en: a.en });
    });
  }

  function apply(lang) {
    var toEN = lang === 'en';
    nodes.forEach(function (rec) {
      var key = rec.bg.trim();
      if (toEN && EN[key]) rec.node.nodeValue = rec.bg.replace(key, EN[key]);
      else rec.node.nodeValue = rec.bg;
    });
    attrs.forEach(function (rec) { rec.el.setAttribute(rec.attr, toEN ? rec.en : rec.bg); });
    document.documentElement.setAttribute('lang', lang);
    document.querySelectorAll('.lang-toggle button').forEach(function (b) {
      b.classList.toggle('on', b.textContent.trim().toLowerCase() === lang);
    });
    try { localStorage.setItem('mgi.lang', lang); } catch (e) {}
  }

  function init() {
    collect();
    var saved = 'bg';
    try { saved = localStorage.getItem('mgi.lang') || 'bg'; } catch (e) {}
    if (saved === 'en') apply('en'); else apply('bg');
    document.querySelectorAll('.lang-toggle button').forEach(function (b) {
      b.addEventListener('click', function () { apply(b.textContent.trim().toLowerCase()); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
