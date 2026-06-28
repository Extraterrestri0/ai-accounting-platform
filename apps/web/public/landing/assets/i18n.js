/* BG -> EN dictionary for the Acco marketing site. site.js swaps text nodes by
   exact match (and inverts EN -> BG). Rich headings (with inline markup) carry
   their own data-ten/data-tbg and are swapped by innerHTML in site.js — they are
   NOT in this map. Keys here = exact rendered Bulgarian plain-text strings. */
window.I18N = {
  /* nav + actions */
  'Функции': 'Features', 'Как работи': 'How it works', 'Цени': 'Pricing', 'Въпроси': 'FAQ',
  'За кого': "Who it's for", 'Ресурси': 'Resources',
  'Вход': 'Log in', 'Започни': 'Get started', 'Започни безплатно': 'Start free',
  'Виж как работи': 'See how it works', 'Виж цените': 'See pricing',
  'Свържи се с нас': 'Contact us', 'Свържете се с нас': 'Contact us', 'Заяви оферта': 'Request a quote',

  /* hero (home) */
  'AI счетоводство · България': 'AI accounting · Bulgaria',
  'Снимай документа, AI го разчита, ти одобряваш. Готови ДДС и отчети — води си счетоводството сам, без счетоводител.':
    'Snap the document, AI reads it, you approve. VAT and reports ready — do your own books, no accountant.',
  'Без банкова карта': 'No card required', '7 дни безплатно': '7 days free', 'Откажи по всяко време': 'Cancel anytime',

  /* integrations */
  'Интеграции': 'Integrations',
  'Свързва се с инструментите, които вече ползваш.': 'Connects with the tools you already use.',
  'Плащания, магазини и таблици — документите идват сами, на едно място.':
    'Payments, stores and sheets — documents arrive on their own, in one place.',

  /* before/after */
  'Защо Acco': 'Why Acco', 'Без платформа': 'Without a platform', 'С Acco': 'With Acco',
  'Часове ръчно въвеждане': 'Hours of manual data entry',
  'Поле по поле, фактура по фактура.': 'Field by field, invoice by invoice.',
  'Фактури, разпилени по имейли': 'Invoices scattered across emails',
  'Папки, екселски файлове, изгубени документи.': 'Folders, spreadsheets, lost documents.',
  'Пропуснати ДДС срокове': 'Missed VAT deadlines',
  'Глоби и грешки от невнимание.': 'Fines and careless mistakes.',
  'Зависимост от счетоводител': 'Dependence on an accountant',
  'За всяка дребна промяна или въпрос.': 'For every small change or question.',
  'AI извлича данните автоматично': 'AI extracts the data automatically',
  'Снимка или PDF — готово за секунди.': 'A photo or PDF — ready in seconds.',
  'Всичко на едно място, защитено': 'Everything in one place, secured',
  'Архив с одитна следа, данни в ЕС.': 'Archive with an audit trail, data in the EU.',
  'Готови ДДС дневници и декларация': 'Ready VAT ledgers and return',
  'Попълват се сами, готови за подаване.': 'They fill themselves, ready to submit.',
  'Управляваш финансите си сам': 'You manage your finances yourself',
  'Спокойно, разбираемо, без посредник.': 'Calm, clear, no middleman.',

  /* how it works */
  'От документ до готов отчет — в три стъпки.': 'From document to finished report — in three steps.',
  'AI върши рутината, ти решаваш важното.': 'AI does the routine, you decide what matters.',
  'Качваш': 'Upload', 'AI разчита': 'AI reads', 'Ти одобряваш': 'You approve',
  'Снимка, PDF или XML — както ти е удобно. Или препрати имейл с фактура.':
    'A photo, PDF or XML — whatever suits you. Or forward an email with an invoice.',
  'Извлича данните и предлага осчетоводяване срещу националния сметкоплан — винаги с „защо?“.':
    'It extracts the data and proposes posting against the national chart of accounts — always with a “why?”.',
  'Един преглед и готово. ДДС дневниците и отчетите се пълнят сами.':
    'One review and done. The VAT ledgers and reports fill themselves.',

  /* bento / features */
  'Какво можеш': 'What you can do', 'Всичко за финансите на бизнеса ти.': 'Everything for your business finances.',
  'Създадено за самонаети, фрийлансъри и малки фирми в България.': 'Built for the self-employed, freelancers & small businesses in Bulgaria.',
  'AI извличане': 'AI extraction', 'Фактуриране': 'Invoicing', 'ДДС и НАП': 'VAT & NRA',
  'Отчети': 'Reports', 'Разходи': 'Expenses', 'Сигурен архив': 'Secure archive',
  'основен модул': 'core module', 'Разходи & сигурен архив': 'Expenses & secure archive',
  'Хостинг в ЕС': 'EU hosting', 'Нулево задържане на AI': 'Zero AI retention', 'Хеширан одит': 'Hashed audit',
  'Разчита фактури и документи автоматично — всяко поле с оценка на увереност и детерминирана проверка (ЕИК, VIES, IBAN, Основа + ДДС = Общо).':
    'Reads invoices and documents automatically — every field with a confidence score and a deterministic check (company ID, VIES, IBAN, Base + VAT = Total).',
  'Издаване с последователна номерация, PDF и кредитни известия.': 'Issuing with sequential numbering, PDF and credit notes.',
  'Дневници и справка-декларация, готови за подаване с КЕП.': 'Ledgers and VAT return, ready to file with an e-signature.',
  'ОПР, баланс и оборотна ведомост, на живо и проследими.': 'P&L, balance sheet and trial balance, live and traceable.',
  'Извличане и категоризиране на разходите. Защитено съхранение (WORM), append-only одитна следа, данни в ЕС.':
    'Expense extraction and categorisation. Protected storage (WORM), append-only audit trail, data in the EU.',

  /* deep dive */
  'Прегледай и одобри': 'Review and approve', 'Опашка за преглед': 'Review queue',
  'AI предлага, ти решаваш. Високата увереност и чистите проверки се одобряват накуп — съмнителното изпъква само̀.':
    'AI proposes, you decide. High confidence and clean checks are approved in bulk — only the doubtful stands out.',
  'Детерминирани проверки, не само AI': 'Deterministic checks, not just AI',
  'ЕИК, VIES, IBAN и Основа + ДДС = Общо.': 'Company ID, VIES, IBAN and Base + VAT = Total.',
  'Всяко число — проследимо до документ': 'Every number — traceable to a document',
  'Пълна прозрачност и одитна следа.': 'Full transparency and an audit trail.',
  'Одобрение накуп за чистите': 'Bulk approval for the clean ones',
  'Висока увереност + без флагове = един клик.': 'High confidence + no flags = one click.',

  /* stats */
  'точност при извличане': 'extraction accuracy', 'спестени на месец': 'saved per month',
  'обработени документа': 'documents processed', 'средна оценка': 'average rating',

  /* testimonials */
  'Нямам счетоводител. Качвам фактурите, AI ги разчита, аз одобрявам — и ДДС-то ми е готово за минути.':
    'I have no accountant. I upload invoices, AI reads them, I approve — and my VAT is ready in minutes.',
  'Собственик · онлайн магазин': 'Owner · online store',
  'Спестявам цял ден всеки месец. ДДС дневниците просто се пълнят сами.':
    'I save a whole day every month. The VAT ledgers just fill themselves.',
  'Фрийлансър · IT': 'Freelancer · IT',
  'Най-сетне разбирам собствените си финанси. Всичко е проследимо до документа.':
    'I finally understand my own finances. Everything traces back to the document.',
  'Управител · ЕООД': 'Manager · Ltd.',
  'Обработвам стотици документи на месец. Бързо, точно и спокойно.':
    'I process hundreds of documents a month. Fast, accurate and calm.',
  'Онлайн магазин': 'Online store',

  /* security band */
  'Сигурност по дизайн': 'Security by design', 'Неизменен ledger': 'Immutable ledger',
  'Поверителност': 'Privacy', 'Роли и достъп': 'Roles & access', 'И още': 'And more',
  'Само сторниращи записи. Нищо не се изтрива тихо.': 'Reversing entries only. Nothing is deleted silently.',
  'Append-only следа за всяко действие.': 'An append-only trail for every action.',
  'Нулево задържане на данни от AI.': 'Zero data retention by AI.',
  'Собственик, счетоводител, одобряващ, четец.': 'Owner, accountant, approver, viewer.',
  'Принципът, който не нарушаваме:': 'The principle we never break:',
  'AI предлага · човек одобрява · ledger-ът е неизменен · всичко е одитирано.':
    'AI proposes · a human approves · the ledger is immutable · everything is audited.',

  /* capabilities */
  'Дребните неща, които пестят часове.': 'The little things that save hours.',
  'Препрати по имейл': 'Forward by email',
  'Изпрати фактура на личния си адрес — влиза директно в опашката.': 'Send an invoice to your personal address — it goes straight into the queue.',
  'Категоризиране на разходи': 'Expense categorisation',
  'AI предлага сметка и тип ДДС; ти потвърждаваш с клик.': 'AI suggests an account and VAT type; you confirm with a click.',
  'Одобрение накуп': 'Bulk approval',
  'Чистите документи с висока увереност — на един клик.': 'Clean, high-confidence documents — in one click.',
  'Напомняния за срокове': 'Deadline reminders',
  'ДДС и плащания — спокойно, навреме, без изненади.': 'VAT and payments — calm, on time, no surprises.',
  'AI асистент': 'AI assistant',
  'Обяснява термини и сочи източници — но никога не подава вместо теб.': 'Explains terms and cites sources — but never files for you.',
  'Покани счетоводител': 'Invite an accountant',
  'Работиш сам — или даваш достъп с роля, когато поискаш.': 'Work solo — or grant access with a role whenever you want.',

  /* faq */
  'Често задавани въпроси': 'Frequently asked questions', 'Често задавани въпроси.': 'Frequently asked questions.',
  'Ясно и предвидимо.': 'Clear and predictable.',
  'Не намираш отговор? Пиши ни — отговаряме на български, бързо.': 'No answer here? Write to us — we reply in Bulgarian, fast.',

  /* pricing */
  'Една ясна абонаментна цена. Без такси за документ, без скрити условия. Започни безплатно за 7 дни.':
    'One clear subscription price. No per-document fees, no hidden terms. Start free for 7 days.',
  'Месечно': 'Monthly', 'Годишно': 'Yearly', '− 20% годишно': '− 20% yearly',
  'Старт': 'Starter', 'Бизнес': 'Business', 'Про': 'Pro', 'Най-избиран': 'Most chosen',
  'без ДДС': 'excl. VAT', '/мес': '/mo', 'Индивидуален': 'Custom', 'По договаряне': 'Custom pricing',
  'За самонаети и фрийлансъри.': 'For the self-employed and freelancers.',
  'За малки фирми и ЕООД.': 'For small businesses and Ltd.',
  'За онлайн магазини и много фирми.': 'For online stores and multiple companies.',
  'До 50 документа на месец': 'Up to 50 documents per month',
  'AI извличане и осчетоводяване': 'AI extraction and posting',
  'Фактуриране и PDF': 'Invoicing and PDF',
  '1 фирма · 1 потребител': '1 company · 1 user', 'Имейл поддръжка': 'Email support',
  'До 200 документа на месец': 'Up to 200 documents per month',
  'Всичко от Старт, плюс:': 'Everything in Starter, plus:',
  'ДДС дневници и декларация (НАП)': 'VAT ledgers and return (NRA)',
  'Отчети на живо · ОПР, баланс, ОВ': 'Live reports · P&L, balance, trial balance',
  '1 фирма · до 3 потребители': '1 company · up to 3 users', 'Приоритетна поддръжка': 'Priority support',
  'Неограничени документи': 'Unlimited documents', 'Всичко от Бизнес, плюс:': 'Everything in Business, plus:',
  'Много фирми · до 10 потребители': 'Multiple companies · up to 10 users',
  'Роли и достъп · одобряващ, четец': 'Roles and access · approver, viewer',
  'Експорт и API': 'Export and API', 'Посветена поддръжка': 'Dedicated support',
  'Всички цени са в евро, без ДДС. Без скрити такси и без такса за документ.':
    'All prices are in euro, excl. VAT. No hidden fees and no per-document fee.',
  'Голям обем документи, много дружества, собствени роли и интеграции. Изграждаме план, който пасва точно на счетоводството ти.':
    'High document volume, multiple entities, custom roles and integrations. We build a plan that fits your accounting exactly.',
  'Неограничени дружества': 'Unlimited entities', 'SSO и собствени роли': 'SSO and custom roles',
  'Миграция на данни': 'Data migration', 'Посветен мениджър & SLA': 'Dedicated manager & SLA',
  'Цена': 'Price', 'Спокоен разговор, ясна оферта.': 'A calm conversation, a clear quote.',
  'Сравнение': 'Comparison', 'Какво влиза във всеки план.': "What's in each plan.",
  'Функция': 'Feature', 'Документи на месец': 'Documents per month', 'Брой фирми': 'Number of companies',
  'Много': 'Multiple', 'Потребители': 'Users', 'Поддръжка': 'Support',
  'Имейл': 'Email', 'Приоритетна': 'Priority', 'Посветена': 'Dedicated',

  /* CTA */
  'Без банкова карта. Без ангажимент. Спокойни финанси от първия документ.':
    'No card. No commitment. Calm finances from the very first document.',
  '7 дни. Без банкова карта. Без ангажимент.': '7 days. No card. No commitment.',

  /* contact */
  'Контакти · Get in touch': 'Contact · Get in touch', 'Телефон': 'Phone',
  'Отговор': 'Reply', 'До 1 работен ден': 'Within 1 business day',
  'Кажи ни с какво се занимаваш и какво ти трябва. Връщаме се с ясен отговор — обикновено до един работен ден.':
    'Tell us what you do and what you need. We get back with a clear answer — usually within one business day.',
  'Пълно име': 'Full name', 'Как можем да помогнем?': 'How can we help?',
  'Съгласен съм личните ми данни да бъдат обработени единствено с цел обратна връзка. Данните не се предоставят на трети страни.':
    'I agree my personal data may be processed solely to respond to me. The data is not shared with third parties.',
  'Изпрати запитване': 'Send enquiry', 'Благодарим!': 'Thank you!',
  'Получихме запитването ти и ще се свържем до един работен ден.': 'We received your enquiry and will get back within one business day.',

  /* about */
  'Нашата мисия': 'Our mission', 'Счетоводство, което всеки разбира.': 'Accounting everyone understands.',
  'Да направим счетоводството разбираемо и автоматично за малките фирми, фрийлансърите и самонаетите в България — с AI, който върши рутината, и човек, който решава важното.':
    'To make accounting clear and automatic for small businesses, freelancers and the self-employed in Bulgaria — with AI that does the routine and a human who decides what matters.',
  'За хора, които искат контрол.': 'For people who want control.',
  'За самонаети, фрийлансъри и малки фирми, които искат да управляват финансите на бизнеса си сами, без да плащат на счетоводител. Платформата говори български, мисли в евро и спазва изискванията на НАП.':
    'For the self-employed, freelancers and small businesses who want to manage their business finances themselves, without paying an accountant. The platform speaks Bulgarian, thinks in euro and follows NRA requirements.',
  'Създадено за хора като теб.': 'Built for people like you.',
  'Самонаети': 'Self-employed', 'Фрийлансъри': 'Freelancers',
  'Малки фирми и ЕООД': 'Small businesses & Ltd.', 'Онлайн магазини': 'Online stores',
  'Фактури, ДДС и отчети за минути.': 'Invoices, VAT and reports in minutes.',
  'Следи приходите без счетоводител.': 'Track income without an accountant.',
  'Пълно счетоводство, самостоятелно.': 'Full accounting, on your own.',
  'Много документи, обработени бързо.': 'Many documents, processed fast.',

  /* resources */
  'Ръководства': 'Guides', 'Стъпка по стъпка през ДДС, фактури и осчетоводяване.': 'Step by step through VAT, invoices and posting.',
  'Данъчен календар': 'Tax calendar', 'Всички срокове за ДДС и данъци за 2026.': 'All VAT and tax deadlines for 2026.',
  'Шаблони': 'Templates', 'Готови шаблони за фактури, протоколи и справки.': 'Ready templates for invoices, protocols and statements.',
  'Помощен център': 'Help center', 'База знания и отговори на често задавани въпроси.': 'A knowledge base and answers to frequent questions.',
  'Контролни списъци': 'Checklists', 'Месечни и годишни чеклисти за изряден бизнес.': 'Monthly and yearly checklists for a tidy business.',
  'Видео уроци': 'Video tutorials', 'Кратки видеа как да свършите всяка задача.': 'Short videos on how to do each task.',

  /* blog */
  'ДДС': 'VAT', 'Счетоводство': 'Accounting', 'Бизнес растеж': 'Business growth', 'Данъци': 'Taxes', 'Съответствие': 'Compliance',
  'ДДС за начинаещи: как да подадете първата си справка-декларация без грешки': 'VAT for beginners: how to file your first return without mistakes',
  'Неизменяема главна книга: защо сторното е по-добро от изтриването': 'The immutable ledger: why a reversing entry beats deleting',
  '5 признака, че е време да автоматизирате счетоводството си': '5 signs it is time to automate your accounting',
  'Данъчен календар 2026: ключовите срокове за всеки собственик': 'Tax calendar 2026: the key deadlines for every owner',
  'Преходът към евро: какво да очаквате': 'The switch to the euro: what to expect',

  /* footer */
  'Продукт': 'Product', 'Компания': 'Company', 'За нас': 'About', 'Контакти': 'Contact',
  'Общи условия': 'Terms', 'Сигурност': 'Security', 'Блог': 'Blog', 'Помощ': 'Help',
  'AI предлага · ти одобряваш': 'AI proposes · you approve',
  'Цените са в евро': 'Prices in euro', 'Български · English': 'Bulgarian · English',
  'AI счетоводство за самонаети, фрийлансъри и малки фирми. От фактура до готов отчет, без ръчно въвеждане.':
    'AI accounting for the self-employed, freelancers and small businesses. From invoice to finished report, no manual entry.',
};
