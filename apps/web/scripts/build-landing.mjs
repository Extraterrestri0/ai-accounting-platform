/* ============================================================================
   Static generator for the Acco public website (v4, Bulgarian-first, BG + EN).
   One layout, one class system, two languages from a shared dictionary:
     BG  →  /            /features …        (public/landing/*.html)
     EN  →  /en          /en/features …     (public/landing/en/*.html)
   Language switch = plain links between the two trees (no JS, no cookie), with
   hreflang alternates, per-language canonical, one sitemap with xhtml:link.
   Content rule: only capabilities that exist in the repository; planned items
   are labelled. No invented customers, numbers, certifications or integrations.
   No public contact address is published (no verified, monitored inbox yet).
   Run:  node apps/web/scripts/build-landing.mjs
   ============================================================================ */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'public', 'landing');
const PUB = join(__dir, '..', 'public');
const SITE = 'https://app.185-52-207-143.sslip.io'; // temporary public host until a real domain is configured
const BRAND = 'Acco';
const V = 'v=51';
mkdirSync(join(OUT, 'en'), { recursive: true });

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
  chain: s('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  user: s('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  cite: s('<path d="M7 17h10M7 13h10M7 9h4"/><rect x="3" y="4" width="18" height="16" rx="2"/>'),
  menu: s('<path d="M4 7h16M4 12h16M4 17h16"/>', 2),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>', 2),
  mail: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cal: s('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  xml: s('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>'),
  eye: s('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  ban: s('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
  layers: s('<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>'),
};

/* ---- brand mark (temporary Acco "a" with check; vector traced from the supplied PNG) */
const MARK_PATH = readFileSync(join(__dir, '..', 'public', 'landing', 'assets', 'icons', 'acco-mark.path'), 'utf8').trim();
const LOGO = `<svg viewBox="0 0 1000 1000" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${MARK_PATH}"/></svg>`;

/* ============================================================================
   Dictionary. Keys are shared between the two languages.
   ============================================================================ */
const DICT = {
  en: {
    locale: 'en_GB', htmlLang: 'en', langLabel: 'English',
    skip: 'Skip to content', menu: 'Menu', mainNav: 'Main', mobileNav: 'Mobile', footerNav: 'Site footer', langNav: 'Language',
    tagline: 'Accounting that prepares the work. You approve it.',
    nav: { product: 'Product', how: 'How it works', ai: 'AI Accountant', pricing: 'Pricing', about: 'About', faq: 'FAQ', contact: 'Contact' },
    cta: { start: 'Get started', signin: 'Sign in', seeHow: 'See how it works', seeProduct: 'See the product', createAccount: 'Create an account', howAccess: 'How access works', allQuestions: 'All questions' },
    footer: {
      about: 'Accounting software for Bulgarian businesses. Acco reads documents, proposes the accounting treatment and posts to an immutable ledger only after a person approves.',
      product: 'Product', company: 'Company', legal: 'Legal', features: 'Features', privacy: 'Privacy', terms: 'Terms', cookies: 'Cookies', gdpr: 'GDPR',
      rights: 'All rights reserved.', line: 'EUR functional currency · Legal pages are in Bulgarian',
    },
    hero: {
      eyebrow: 'Accounting software · Human approval', eyebrowTail: ' · EUR',
      h1a: 'Accounting that prepares the work.', h1b: 'You approve it.',
      lead: 'Acco reads your invoices, proposes the accounting treatment and VAT, and posts to an immutable ledger only when a person approves.', leadTail: ' Every number traces back to a document.',
      notes: ['Immutable ledger', 'Hash-chained audit trail', 'Built for Bulgarian VAT'],
      sceneLabel: 'The Acco review screen: extracted fields next to the source document, with the approval step and the posting result',
    },
    facts: [
      ['Human approval on every document posting', 'Nothing reaches the ledger from the review queue without a person.'],
      ['Immutable double-entry ledger', 'Balanced entries; corrections are reversals.'],
      ['Hash-chained audit trail', 'Every state-changing action, human or AI, is recorded and verifiable.'],
      ['EUR, Bulgarian VAT built in', 'Treatments, registers and checks follow Bulgarian rules.'],
    ],
    matrix: {
      eyebrow: 'What Acco handles', h2: 'The whole loop, from document to filing-ready records.',
      lead: 'Built for sole traders, small companies and the accountants who serve them. Only what works in the product today is listed here.',
      items: [
        ['Document capture', 'PDF, images and XML invoices. Validated, stored immutably, queued for extraction.'],
        ['Extraction and checks', 'Field-by-field values with confidence. UIC, VAT number and IBAN are verified by rules.'],
        ['Review queue', 'Low-confidence fields stand out. Correct, approve or reject, with a full history.'],
        ['Ledger and periods', 'Balanced double-entry postings, reversing corrections, locked accounting periods.'],
        ['Invoicing', 'Sequential numbering, proformas, credit and debit notes, product catalogue with VAT codes.'],
        ['Banking and reconciliation', 'CSV/XLSX statement import, ranked match suggestions, payments, receivables and payables.'],
        ['VAT and SAF-T', 'Purchase and sales registers, period summary, VIES dataset; SAF-T dataset and validation in beta.'],
        ['Reports', 'Trial balance, P&L, balance sheet, general ledger, monthly revenue and expenses, cash flow.'],
        ['AI Accountant', 'Answers fixed questions from your records, cites sources, and never changes anything.'],
      ],
    },
    flow: {
      eyebrow: 'How it works', h2a: 'Seven steps. Two of them are yours,', h2b: 'and nothing moves past them without you.',
      who: { auto: 'Automation', human: 'Your decision', ai: 'AI explanation' },
      steps: [
        ['Document', 'Upload a PDF, photo or XML. It is checked and stored immutably.'],
        ['Extraction', 'Fields are read with a confidence score. UIC, VAT number and IBAN are verified by rules.'],
        ['Review', 'You see the document and the fields side by side. Weak fields are flagged.'],
        ['Suggestion', 'Accounts, expense category and VAT treatment are proposed from rules and memory.'],
        ['Approval', 'Approve, correct or reject. Nothing proceeds without this step.'],
        ['Ledger', 'A balanced entry is posted. It cannot be edited; corrections reverse it.'],
        ['Explain', 'Reports, VAT and the AI Accountant read from the ledger and cite it.'],
      ],
      legend: ['Automation: Acco prepares', 'Your decision: a person approves', 'AI explanation: read-only, cited'],
    },
    review: {
      eyebrow: 'Review before anything is posted', h2a: 'Check what was read.', h2b: 'Fix what needs fixing.',
      body: 'The source document sits next to the extracted fields. Deterministic checks run first; the AI suggestion comes with its reasoning; the approval buttons belong to you.',
      points: [
        ['Rules before probability', 'UIC checksum, VAT-number format and IBAN mod-97 are decided by validators, not by a model.'],
        ['Confidence you can act on', 'Each field shows a score and its origin. Low-confidence fields and failed checks are highlighted.'],
        ['Correct, then approve', 'Edit fields, regenerate the suggestion, approve or reject. Every step lands in the audit trail.'],
      ],
      callout: 'Flagged: low confidence',
    },
    statement: {
      eyebrow: 'Three things that are never confused', h2a: 'Nothing is posted without a person.', h2b: 'Automation prepares, you decide, the assistant explains.',
      defs: [
        ['Automation', 'Acco prepares', 'Reads documents, verifies identifiers, proposes accounts and VAT treatment, builds registers and reports.', 'In the product:', 'extraction, suggestions, registers'],
        ['Your decision', 'A person approves', 'Only a user with the right role can approve a document, lock a period or issue an invoice. The AI cannot.', 'In the product:', 'approve, post, lock, issue'],
        ['AI explanation', 'The assistant explains', 'Answers a fixed set of questions from your records, cites the entries it used, and abstains when the data is not there. It reads only.', 'In the product:', 'AI Accountant'],
      ],
    },
    money: {
      eyebrow: 'Receivables, payables, bank', h2a: 'Know who owes you, what you owe,', h2b: 'and what the bank says.',
      lead: 'Issued invoices become receivables, approved purchase invoices become payables, and imported bank statements are matched against both. Everything by due date, in EUR.',
      notes: [
        ['Receivables from issued invoices', 'Sequential numbering, proformas, credit and debit notes; open items and ageing by due date.'],
        ['Payables from approved purchases', 'Posted purchase invoices appear as open payables, grouped by due-date bucket.'],
        ['Statements matched, never auto-booked', 'CSV/XLSX import with duplicate detection; ranked match suggestions you confirm.'],
      ],
    },
    tax: {
      eyebrow: 'Built for Bulgarian VAT and reporting', h2a: 'Registers and reports computed from the ledger,', h2b: 'not typed into a form.',
      body: 'Acco follows Bulgarian accounting and VAT rules out of the box: UIC and VAT-number checks, VAT treatments from 20% standard to intra-EU acquisitions, purchase and sales registers per period, Cyrillic invoice PDFs and SAF-T preparation for the NRA. Every figure traces to a journal line and the document behind it.',
      points: [
        ['VAT registers and period summary', 'Purchase and sales registers, output and input VAT, the amount payable or refundable for the month. VIES dataset for intra-EU supplies.'],
        ['Management reports', 'Trial balance, P&L, balance sheet, general ledger, revenue and expenses by month, cash flow. CSV export for the monthly reports.'],
        ['SAF-T preparation', 'Dataset and validation today. XML export and binding to the official NRA schema are planned.'],
      ],
    },
    ai: {
      eyebrow: 'AI Accountant', h2a: 'Ask why. Get an answer with sources.', h2b: 'Nothing changes.',
      lead: 'A fixed set of questions about your VAT, receivables, payables and results. Each answer is built from the ledger and the registers, cites the entries it used, and shows a confidence level. When the data is not there, it says so.',
      points: [
        ['Figures come from your records', 'The assistant never generates numbers. It reads the journal, the registers and the documents.'],
        ['Versioned rule cards', 'Tax rules are explicit cards with a legal reference and a version. Cards awaiting accountant review are labelled and lower the confidence.'],
        ['Read-only by design', 'The assistant has no access to posting, approval, period locking or filing. Every question and answer is written to the audit trail.'],
      ],
    },
    control: {
      eyebrow: 'Control and auditability', h2a: 'Built so you can trust the numbers', h2b: 'and show how you got them.',
      items: [
        ['Isolation per company', 'Each company is separated at the database level. A request outside its context is refused, not just hidden.'],
        ['Roles, checked on the server', 'Approve, lock and issue are tied to roles. The server re-checks the action; the interface only reflects it.'],
        ['Corrections by reversal', 'A posted entry is never edited. A mistake is corrected with a new, reversing entry, so the history stays visible.'],
        ['Accounting periods', 'Lock a period to close it. Posting into a locked period is refused.'],
        ['Documents kept with their history', 'Source files are stored with an immutable version history, so every posting can be traced back to the original document.'],
      ],
    },
    status: {
      eyebrow: 'Honest about status', h2: 'What is available today, and what is coming.',
      lead: 'Only capabilities that exist in the product are listed as available. Anything still being validated is marked beta.',
      available: 'Available', planned: 'Planned', live: 'Live', beta: 'Beta', plannedTag: 'Planned',
      availableItems: [
        ['Document capture and extraction', 'PDF with a text layer and XML invoices, parsed natively', ''],
        ['OCR for photos and scanned PDFs', 'EU document-AI provider (Azure Document Intelligence, EU region enforced); enabled per deployment', 'beta'],
        ['Review queue with corrections and approval', '', ''],
        ['Immutable ledger, journal, accounting periods', '', ''],
        ['Invoicing: numbering, proformas, credit and debit notes', 'PDF generated on issue', ''],
        ['Bank import (CSV/XLSX), matching, payments', '', ''],
        ['VAT registers, period summary, VIES dataset', 'VAT-number format check; live VIES lookup configurable per deployment', ''],
        ['Reports: trial balance, P&L, balance sheet, GL, monthly, cash flow', 'CSV export for the monthly reports', ''],
        ['AI Accountant with citations', '', ''],
        ['SAF-T dataset and validation', 'XML export is enabled per deployment; binding to the official NRA schema is planned', 'beta'],
      ],
      plannedItems: [
        ['Extraction accuracy validation on real scanned invoices', 'Runbook and scoring tool exist; the labelled sample set is being collected'],
        ['Invoice PDF download and email sending from the app', 'The PDF is generated and stored; sending from the interface is not wired yet'],
        ['VAT return export in NRA format', 'DEKLAR / POKUPKI / PRODAGBI files for manual filing'],
        ['Official SAF-T XSD binding', 'Export today validates against the internal dataset schema'],
        ['Two-factor authentication (TOTP)', 'Enrolment from profile settings'],
      ],
    },
    faq: {
      eyebrow: 'Questions', h2: 'Frequently asked', pageH1: 'Questions, answered plainly.', pageLead: 'About documents, VAT, control and access.', navLabel: 'FAQ sections',
      groups: [
        ['Getting started', [
          ['Do I need an accountant to use Acco?', 'No. Acco is built so you can keep your own books: it reads documents, proposes the accounting treatment and VAT, and you approve. If you work with an accountant, invite them to the company with their own role (accountant, approver or viewer).'],
          ['What documents can I upload?', 'PDF invoices with a text layer and XML invoices are read directly. Photos and scanned PDFs go through an EU document-AI provider (beta) when it is enabled for your deployment. You can always correct or complete fields in the review screen.'],
          ['Which currency does Acco use?', 'EUR is the functional currency for all amounts, reports and registers.'],
          ['Can several people work in one company?', 'Yes. Users are assigned to a company with a role. Roles decide who can approve, lock periods or issue invoices, and the server re-checks the action.'],
        ]],
        ['Posting, VAT and AI', [
          ['Does Acco post anything automatically?', 'No. Document postings are approved by a person in the review screen. Issuing an invoice or confirming a bank match posts the related entry when you take that action. Nothing reaches the ledger on its own.'],
          ['How is VAT handled?', 'The VAT treatment is proposed per document from rules: standard 20%, reduced 9%, zero, intra-EU acquisitions and import. Purchase and sales registers and the period summary are computed from posted entries.'],
          ['Does Acco submit anything to the NRA?', 'No. Registers, the period summary and the SAF-T dataset are prepared for you; filing remains your action. An export in the NRA return file format is planned.'],
          ['What does the AI do, and what can it not do?', 'It reads documents, proposes accounts, categories and VAT treatment, and explains figures with citations. It cannot post, approve, lock periods or file. Those actions belong to people and are recorded in the audit trail.'],
          ['What is currently in beta?', 'OCR for photos and scans (an EU document-AI provider, enabled per deployment, accuracy validation on real invoices in progress) and SAF-T (dataset and validation; XML export enabled per deployment, official schema binding planned).'],
        ]],
        ['Records and data', [
          ['Can a posted entry be edited?', 'No. The ledger is append-only. A mistake is corrected with a reversing entry, so what happened stays visible.'],
          ['How are my data protected?', 'Each company is isolated at the database level, the ledger is append-only, and every state-changing action is written to a hash-chained audit trail. When OCR for scans is enabled, the document-AI provider is restricted to EU regions by configuration.'],
          ['What happens to my data at launch?', 'It stays in your company. Early-access companies keep their ledger, documents and history when public plans are introduced.'],
        ]],
        ['Access', [
          ['How does controlled access work?', 'Create an account and upload your first invoice. Acco is being validated with a limited number of companies; pricing is published at launch, and early-access companies see the plans first and keep their data.'],
          ['How much does it cost?', 'Acco is in controlled access and pricing is not public yet. No card is required during early access.'],
        ]],
      ],
    },
    ctaBand: {
      h: 'Start with one invoice.', p: 'Create an account, upload a document and see the suggested posting. The decision, as always, is yours.',
      side: ['Controlled access while we validate extraction and VAT on real documents.', 'EUR functional currency. Human approval on document postings. Hash-chained audit trail.'],
      productH: 'See the product on your own invoices.', productP: 'Create an account, upload a document and see the suggested posting: upload, review, approve, post.',
      pricingH: 'Want to see Acco on your own documents?', pricingP: 'Create an account and upload your first invoice. The decision, as always, is yours.',
    },
    product: {
      eyebrow: 'Product', h1a: 'Everything Acco does,', h1b: 'in the order the work happens.',
      lead: 'Nine chapters, each showing the real screen. Planned work is listed separately and labelled.',
      chapters: [
        ['Capture', 'Every document in, checked and kept.', ['PDF, JPG/PNG and XML invoices, by upload', 'File type, size and content-type validation', 'Immutable version history; trash with restore', 'Every upload is written to the audit trail']],
        ['Extraction', 'Fields read with confidence, facts checked by rules.', ['Field-by-field values with confidence and origin', 'UIC checksum, VAT-number format, IBAN mod-97', 'Diagnostics: why a field is empty or was rejected', 'XML parsed natively; scans via an EU document-AI provider (beta)']],
        ['Review and approve', 'The decision stays with a person.', ['Queue of documents awaiting review', 'Source document next to the fields; weak fields flagged', 'Correct fields, add missing ones, regenerate the suggestion', 'Approve or reject; only a user with the right role can']],
        ['Ledger and periods', 'Balanced, append-only, closeable.', ['Double-entry balance enforced in the database', 'No edits or deletes; corrections are reversing entries', 'Lock a period; posting into it is refused', 'Journal with every entry, line and source document']],
        ['Invoicing', 'Issue, number, post.', ['Sequential numbering per series and year', 'Proformas, credit and debit notes, conversion to invoice', 'Catalogue of products and services with VAT codes', 'PDF generated on issue (download and sending from the app planned)']],
        ['Bank, receivables, payables', 'Matched, never auto-booked.', ['CSV/XLSX statement import with row-level duplicate detection', 'Ranked match suggestions; you confirm each one', 'Payments and reversals posted to the ledger', 'Open items and ageing for receivables and payables']],
        ['VAT and SAF-T', 'Bulgarian VAT, from the ledger.', ['Purchase and sales registers per period', 'Period summary: output, input, payable or refundable', 'Treatments proposed: 20%, 9%, 0%, intra-EU, import', 'VIES dataset; SAF-T dataset and validation (beta)']],
        ['Reports', 'Figures that trace to a line.', ['Trial balance and general ledger', 'Profit and loss, balance sheet', 'Revenue and expenses by month, cash flow', 'CSV export for the monthly reports']],
        ['AI Accountant', 'Explains. Never posts.', ['Fixed questions about VAT, receivables, payables and results', 'Citations to the journal, registers and documents', 'Confidence level; abstains when data is missing', 'Read-only by design; every question is audited']],
      ],
      extractionCallout: 'Flagged: low confidence',
      bg: {
        eyebrow: 'Made for Bulgarian requirements', h2a: 'European product.', h2b: 'Bulgarian accounting, built in.',
        lead: 'Acco is not a generic ledger with a translation layer. The checks, VAT treatments, registers and exports follow Bulgarian rules, so the work it prepares is the work your accountant expects.',
        points: [
          ['UIC and VAT number checks', 'Checksum for the UIC (EIK), VAT-number format, IBAN mod-97. Decided by validators before any AI output.'],
          ['Bulgarian VAT treatments', '20% standard, 9% reduced, 0%, intra-EU acquisitions and import proposed from rules; exempt and export set manually.'],
          ['Registers per period', 'Purchase and sales registers and the period summary built from posted entries; VIES dataset for intra-EU supplies.'],
          ['Invoices the Bulgarian way', 'Sequential numbering per series and year; proformas, credit and debit notes; PDFs typeset in Cyrillic.'],
          ['SAF-T for the NRA', 'Dataset and validation in beta; XML export enabled per deployment; binding to the official schema is planned.'],
          ['OCR restricted to EU regions', 'When OCR for scans is enabled with Azure Document Intelligence, the provider is limited to EU regions by configuration (beta).'],
        ],
      },
    },
    pricing: {
      eyebrow: 'Pricing', h1a: 'Controlled access now.', h1b: 'Public pricing at launch.',
      lead: 'Acco is opening to a limited number of companies while we validate extraction and the VAT process on real documents. We publish plans when they are final, not before.',
      accessEyebrow: 'Early access', accessH2: 'The full product, during controlled access.', price: 'Controlled access', priceSmall: 'pricing announced at launch · no card required',
      checks: ['Document capture, extraction, review and approval', 'Immutable ledger, journal, accounting periods', 'Invoicing, banking, receivables and payables', 'VAT registers, reports, SAF-T (beta)', 'AI Accountant with citations', 'EUR functional currency, hash-chained audit trail'],
      howEyebrow: 'How access works',
      steps: [
        ['Create an account', 'Registration is open. Set up your company with its UIC and VAT status.'],
        ['Upload your first invoice', 'Review the extracted fields, approve the suggested treatment, post. On your own documents.'],
        ['Keep the books', 'Invoices, bank statements, VAT registers and reports, with every document posting approved by you.'],
        ['Pricing at launch', 'Early-access companies see the plans first and keep their data either way.'],
      ],
      meansEyebrow: 'What access means', meansH2: 'Three things you can count on during early access.',
      means: [
        ['The real product, not a demo', 'Your company, your documents, your ledger. Everything you post stays yours; nothing is reset at launch.'],
        ['Your data, your decisions', 'Human approval on document postings, an immutable ledger and a hash-chained audit trail apply from day one.'],
        ['No surprises at launch', 'Plans are published when they are final. Early-access companies see them first and keep their ledger, documents and history.'],
      ],
      whoEyebrow: 'Who it is for', whoH2: 'Sole traders, small companies and the accountants who serve them.',
      whoLead: 'If you receive and issue invoices in Bulgaria, file VAT monthly and want to see what was posted and why, Acco is built for you. Accountants can work in a client company with their own role.',
    },
    about: {
      eyebrow: 'About', h1: 'Why Acco exists.', lead: 'Because the owner of a small business should not have to choose between running it and fighting invoices, VAT and deadlines.',
      proseLg: 'Manual data entry is slow and mistakes are expensive. Software can do the routine: reading, proposing, explaining. It must never decide on money or on the state on a person\'s behalf.',
      body: 'That rule is built into Acco at every level: in the roles that gate approval and posting, in the ledger that refuses an unbalanced entry or a locked period, and in the audit trail that records who did what.',
      statementA: 'Software should assist.', statementB: 'It should not silently decide.',
      defs: [
        ['Deterministic first', 'Rules before models', 'Verifiable facts such as the UIC, VAT number, IBAN and double-entry balance are decided by validators. A model may read, classify and suggest; it does not get a vote on a checksum.'],
        ['A person decides', 'Approval is a human act', 'Document postings require explicit approval by a user with the right role. The AI cannot post, lock a period, issue an invoice or change permissions.'],
        ['Traceable', 'Every figure has a source', 'Every number leads to a journal line and a document; every state-changing action leads to a hash-chained audit record. Explanations cite what they used and abstain when the data is not there.'],
      ],
      removesEyebrow: 'What it takes off your desk', removesH2: 'Less typing. Less guessing. Fewer surprises at month end.',
      removesLead: 'The repetitive part of bookkeeping is prepared for you: reading invoices, finding the right account, computing VAT, matching bank lines. The part that needs judgement stays visible, and stays yours.',
      removes: [
        ['Reading and typing', 'Fields are extracted with confidence; identifiers are verified; you correct what is flagged instead of retyping everything.'],
        ['Finding the treatment', 'Accounts, expense category and VAT treatment are proposed from rules and per-supplier memory, with the reason shown.'],
        ['Reconciling', 'Bank lines are matched to invoices with a ranked suggestion; you confirm, the ledger records.'],
      ],
      missingEyebrow: 'What Acco does not do', missingH2: 'Some things are deliberately missing.', byDesign: 'By design',
      missing: [
        ['No automatic posting', 'Document postings are approved by a person, in the review screen.'],
        ['No silent changes to records', 'Posted entries are never edited. Corrections are new, reversing entries.'],
        ['No generated numbers', 'The assistant explains figures from the ledger and cites them; it does not produce its own.'],
        ['No filing on your behalf', 'Registers and exports are prepared for you to file. Direct submission to the NRA is intentionally out of scope.'],
      ],
    },
    contact: {
      eyebrow: 'Contact', h1a: 'A public contact channel', h1b: 'is being set up.',
      lead: 'Direct contact requests are temporarily unavailable while the public contact channel is being configured. No address is published until it is verified and monitored. Until then, the product itself is the fastest way in.',
      status: ['Status', 'Contact channel: being configured. This page will carry the verified address once it is live.'],
      who: ['Who Acco is for', 'Sole traders and small companies in Bulgaria that receive and issue invoices; accountants who want to run client books in Acco.'],
      legal: ['Legal', 'Privacy, terms, cookies and GDPR pages are linked in the footer (currently in Bulgarian).'],
      paths: [
        ['Create an account', 'Registration is open during controlled access. Set up the company and upload your first invoice.'],
        ['Sign in', 'Already have a company in Acco? Continue where you left off.'],
        ['See the product', 'Nine chapters, each showing the real screen, in the order the work happens.'],
        ['Read the FAQ', 'Documents, VAT, control and access, answered plainly.'],
      ],
    },
    meta: {
      home: ['Acco · Accounting that prepares the work. You approve it.', 'Acco reads invoices, proposes the accounting treatment and VAT, and posts to an immutable ledger only after a person approves. EUR, Bulgarian VAT built in.'],
      features: ['Product · Acco', 'What Acco does today: capture, extraction, review, immutable ledger, invoicing, banking, VAT, reports and the AI Accountant.'],
      pricing: ['Pricing · Acco', 'Acco is in controlled access; pricing will be published at launch.'],
      about: ['About · Acco', 'Why Acco exists: deterministic before AI, a person decides, full traceability.'],
      faq: ['FAQ · Acco', 'Frequently asked questions about documents, VAT, control and access.'],
      contact: ['Contact · Acco', 'How to reach Acco during controlled access. A public contact channel is being set up.'],
      appDesc: 'Accounting software for Bulgarian businesses: document extraction, human review, immutable ledger, VAT and reports.',
    },
    ui: {
      review: 'Review', invoice: 'Invoice', no: 'No.', supplier: 'Supplier', customer: 'Customer', uic: 'UIC', subscription: 'Prima Cloud subscription · October',
      taxBase: 'Tax base', vat20: 'VAT 20%', total: 'Total', extracted: 'Extracted data', overall: 'overall confidence 94%', document: 'Document', invoiceNo: 'Invoice No.',
      taxEventDate: 'Tax event date', amountsVat: 'Amounts and VAT', treatment: 'Treatment', standard: 'standard · 20%', name: 'Name', checked: 'checked', rule: 'rule', invalid: 'invalid',
      decision: 'Decision', awaiting: 'awaiting review', approved: 'approved', posted: 'posted', stepExtraction: 'Extraction', stepReview: 'Review fields', stepApproval: 'Approval', stepPosting: 'Posting',
      approve: 'Approve', reject: 'Reject', postToLedger: 'Post to ledger', journalEntry: 'Journal entry', suggestion: 'Suggestion', fromMemory: 'from memory',
      drServices: 'Dr Services', drInputVat: 'Dr Input VAT', crSuppliers: 'Cr Suppliers', vatNote: 'standard 20% · BG supplier · matched code STD20', vatLabel: 'VAT:',
      postedTitle: 'Posted to the ledger', approvedBy: 'Approved by', recorded: 'recorded in the audit trail',
      receivables: 'Receivables', payables: 'Payables', viewAll: 'View all →', current: 'Current', overdue: 'Overdue · 3 documents',
      payablesByDue: 'Payables by due date', asOf: 'as of 03.10.2026', bucket: 'Bucket', docs: 'Docs', amount: 'Amount', share: 'Share', d1_30: '1–30 days', d31_60: '31–60 days', totalOpen: 'Total open',
      bankStatement: 'Bank statement · UniCredit', toReconcile: '3 to reconcile', date: 'Date', description: 'Description', status: 'Status', paymentInv: 'Payment inv. 1180', receipt: 'Receipt · INV 2026-0031', rent: 'Rent October',
      suggested: 'suggested', matched: 'matched', match: 'Match:', matchText: 'invoice 0000001180 · Softuer Prima · 228.00 €', confirm: 'Confirm',
      trialBalance: 'Trial balance', period: '01.01.2026 – 03.10.2026', account: 'Account', debit: 'Debit', credit: 'Credit', balance: 'Balance', suppliers: 'Suppliers', customers: 'Customers', inputVat: 'Input VAT', outputVat: 'Output VAT', revenue: 'Revenue', balanced: 'balanced',
      outputVatK: 'Output VAT', inputVatK: 'Input VAT', vatPayable: 'VAT payable', salesInvoices: '12 sales invoices', purchases: '27 purchases', period09: 'period 09/2026',
      saftExports: 'SAF-T exports', errors: 'Errors', warnings: 'Warnings', completed: 'validated', dataset: 'Dataset', sep: 'September 2026', aug: 'August 2026', periodCol: 'Period',
      aiTitle: 'AI Accountant', readsOnly: 'reads only · never posts', q1: 'Why do I owe this much VAT?', q2: 'Where does the amount come from?', q3: 'What to check before filing', deterministic: 'deterministic',
      answer: 'For 09/2026 you owe <strong>1 240.00 €</strong>: output VAT of 3 120.00 € on 12 sales invoices, minus input VAT of 1 880.00 € on 27 purchases. The largest contribution is INV 2026-0031 to Delta Consult OOD (1 500.00 € base).',
      sources: 'Sources', src1: 'Sales register 09/2026', src2: 'Purchase register 09/2026', src3: 'INV 2026-0031', foot: 'Explanation built from your records. The assistant cannot post, approve or file anything.',
      journal: 'Journal', appendOnly: 'append-only · corrections are reversing entries', purchaseInvoice: 'Purchase invoice 0000001180 · Softuer Prima EOOD', externalServices: 'External services', suppliersOf: 'Suppliers · Softuer Prima EOOD',
      dashboard: 'Dashboard', awaitingReview: 'Awaiting review', needApproval: 'need approval', overdue3: '3 overdue', netResult: 'Net result · 2026', fromLedger: 'from the ledger', recentDocs: 'Recent documents', all: 'All →', file: 'File', extracting: 'extracting',
      uploadDocs: 'Upload documents', uploadMeta: 'PDF · JPG · PNG · XML · up to 25 MB', drop: 'Drop files here or choose from your computer', dropSub: 'Each file is checked, stored with its version history and queued for extraction.', size: 'Size', uploaded: 'Uploaded', extractedFields: 'extracted', parsedXml: 'parsed · native XML',
      auditTrail: 'Audit trail', chainVerified: 'chain verified · 1 284 events', a1: '<b>Ana Dimitrova</b> posted <code>#417</code> from review <code>f-1180-softprima.pdf</code>', a2: '<b>Ana Dimitrova</b> approved review · corrected <code>tax_base</code> 19.00 → 190.00 €', a3: '<b>AI suggestion</b> proposed 602 / 4531 / 401 · rule <code>STD20</code> · memory: Softuer Prima', a4: '<b>Extraction</b> completed · overall 94%', a5: '<b>Ana Dimitrova</b> uploaded <code>f-1180-softprima.pdf</code>',
      periods: 'Accounting periods', open: 'open', locked: 'locked', entries: 'Entries', lockedBy: 'Locked by', oct: 'October 2026',
      invoices: 'Invoices', newDocument: 'New document', number: 'Number', issued: 'issued', proforma: 'proforma', creditNote: 'credit note',
      ticketJe: '#417 · 03.10.2026',
    },
  },
  bg: {
    locale: 'bg_BG', htmlLang: 'bg', langLabel: 'Български',
    skip: 'Към съдържанието', menu: 'Меню', mainNav: 'Основна навигация', mobileNav: 'Мобилна навигация', footerNav: 'Долен колонтитул', langNav: 'Език',
    tagline: 'Счетоводство, което подготвя работата. Вие одобрявате.',
    nav: { product: 'Продукт', how: 'Как работи', ai: 'AI счетоводител', pricing: 'Цени', about: 'За нас', faq: 'Въпроси', contact: 'Контакт' },
    cta: { start: 'Започнете', signin: 'Вход', seeHow: 'Вижте как работи', seeProduct: 'Вижте продукта', createAccount: 'Създайте акаунт', howAccess: 'Как се получава достъп', allQuestions: 'Всички въпроси' },
    footer: {
      about: 'Счетоводен софтуер за български фирми. Acco прочита документите, предлага счетоводното третиране и осчетоводява в неизменяема главна книга само след одобрение от човек.',
      product: 'Продукт', company: 'Компания', legal: 'Правна информация', features: 'Функции', privacy: 'Поверителност', terms: 'Общи условия', cookies: 'Бисквитки', gdpr: 'GDPR',
      rights: 'Всички права запазени.', line: 'Функционална валута EUR · Правните страници са на български',
    },
    hero: {
      eyebrow: 'Счетоводен софтуер · Човешко одобрение', eyebrowTail: ' · EUR',
      h1a: 'Счетоводство, което подготвя работата.', h1b: 'Вие одобрявате.',
      lead: 'Acco прочита фактурите ви, предлага счетоводното третиране и ДДС и осчетоводява в неизменяема главна книга само когато човек одобри.', leadTail: ' Всяка цифра води обратно до документ.',
      notes: ['Неизменяема главна книга', 'Одитна следа с хеш-верига', 'Създаден за българското ДДС'],
      sceneLabel: 'Екранът за преглед в Acco: извлечените полета до оригиналния документ, стъпката на одобрение и резултатът от осчетоводяването',
    },
    facts: [
      ['Човешко одобрение на всяко осчетоводяване на документ', 'От опашката за преглед нищо не стига до главната книга без човек.'],
      ['Неизменяема двустранна главна книга', 'Балансирани записи; корекциите са сторниращи записи.'],
      ['Одитна следа с хеш-верига', 'Всяко действие, което променя състояние, човешко или на AI, се записва и може да се провери.'],
      ['EUR и българско ДДС по подразбиране', 'Третирания, дневници и проверки по българските правила.'],
    ],
    matrix: {
      eyebrow: 'Какво покрива Acco', h2: 'Целият цикъл: от документа до готовите за подаване записи.',
      lead: 'Създаден за самонаети, малки фирми и счетоводителите, които ги обслужват. Тук е изброено само това, което работи в продукта днес.',
      items: [
        ['Приемане на документи', 'PDF, изображения и XML фактури. Проверени, съхранени неизменяемо, наредени за извличане.'],
        ['Извличане и проверки', 'Стойности поле по поле с увереност. ЕИК, ДДС номер и IBAN се проверяват по правила.'],
        ['Опашка за преглед', 'Полетата с ниска увереност се открояват. Коригирайте, одобрете или отхвърлете, с пълна история.'],
        ['Главна книга и периоди', 'Балансирани двустранни записи, сторниращи корекции, заключени счетоводни периоди.'],
        ['Фактуриране', 'Последователна номерация, проформи, кредитни и дебитни известия, каталог с ДДС кодове.'],
        ['Банка и съпоставяне', 'Импорт на извлечения CSV/XLSX, класирани предложения за съпоставяне, плащания, вземания и задължения.'],
        ['ДДС и SAF-T', 'Дневници за покупки и продажби, обобщение за периода, VIES набор; SAF-T набор и валидация в бета.'],
        ['Отчети', 'Оборотна ведомост, ОПР, баланс, главна книга, месечни приходи и разходи, паричен поток.'],
        ['AI счетоводител', 'Отговаря на фиксирани въпроси по вашите записи, цитира източници и никога не променя нищо.'],
      ],
    },
    flow: {
      eyebrow: 'Как работи', h2a: 'Седем стъпки. Две от тях са ваши', h2b: 'и нищо не минава през тях без вас.',
      who: { auto: 'Автоматизация', human: 'Вашето решение', ai: 'AI обяснение' },
      steps: [
        ['Документ', 'Качвате PDF, снимка или XML. Файлът се проверява и съхранява неизменяемо.'],
        ['Извличане', 'Полетата се прочитат с оценка на увереност. ЕИК, ДДС номер и IBAN се проверяват по правила.'],
        ['Преглед', 'Виждате документа и полетата едно до друго. Слабите полета са отбелязани.'],
        ['Предложение', 'Сметки, категория разход и ДДС третиране се предлагат от правила и памет.'],
        ['Одобрение', 'Одобрявате, коригирате или отхвърляте. Без тази стъпка нищо не продължава.'],
        ['Главна книга', 'Осчетоводява се балансиран запис. Той не може да се редактира; корекциите го сторнират.'],
        ['Обяснение', 'Отчетите, ДДС и AI счетоводителят четат от главната книга и я цитират.'],
      ],
      legend: ['Автоматизация: Acco подготвя', 'Вашето решение: човек одобрява', 'AI обяснение: само четене, с цитати'],
    },
    review: {
      eyebrow: 'Преглед преди всяко осчетоводяване', h2a: 'Проверете какво е прочетено.', h2b: 'Поправете каквото трябва.',
      body: 'Оригиналният документ стои до извлечените полета. Първо се изпълняват детерминираните проверки; AI предложението идва с мотивите си; бутоните за одобрение са ваши.',
      points: [
        ['Правила преди вероятност', 'Контролна сума на ЕИК, формат на ДДС номер и IBAN mod-97 се решават от валидатори, не от модел.'],
        ['Увереност, на която може да се разчита', 'Всяко поле показва оценка и произход. Полетата с ниска увереност и неуспешните проверки са откроени.'],
        ['Първо коригирайте, после одобрете', 'Редактирате полета, генерирате ново предложение, одобрявате или отхвърляте. Всяка стъпка влиза в одитната следа.'],
      ],
      callout: 'Отбелязано: ниска увереност',
    },
    statement: {
      eyebrow: 'Три неща, които никога не се смесват', h2a: 'Нищо не се осчетоводява без човек.', h2b: 'Автоматизацията подготвя, вие решавате, асистентът обяснява.',
      defs: [
        ['Автоматизация', 'Acco подготвя', 'Прочита документи, проверява идентификатори, предлага сметки и ДДС третиране, изгражда дневници и отчети.', 'В продукта:', 'извличане, предложения, дневници'],
        ['Вашето решение', 'Човек одобрява', 'Само потребител с подходяща роля може да одобри документ, да заключи период или да издаде фактура. AI не може.', 'В продукта:', 'одобряване, осчетоводяване, заключване, издаване'],
        ['AI обяснение', 'Асистентът обяснява', 'Отговаря на фиксиран набор от въпроси по вашите записи, цитира използваните записи и се въздържа, когато данните липсват. Само чете.', 'В продукта:', 'AI счетоводител'],
      ],
    },
    money: {
      eyebrow: 'Вземания, задължения, банка', h2a: 'Знайте кой ви дължи, какво дължите', h2b: 'и какво казва банката.',
      lead: 'Издадените фактури стават вземания, одобрените фактури за покупки стават задължения, а импортираните банкови извлечения се съпоставят и с двете. Всичко по падеж, в EUR.',
      notes: [
        ['Вземания от издадени фактури', 'Последователна номерация, проформи, кредитни и дебитни известия; отворени позиции и падежна структура.'],
        ['Задължения от одобрени покупки', 'Осчетоводените фактури за покупки се появяват като отворени задължения, групирани по падеж.'],
        ['Извлеченията се съпоставят, никога не се осчетоводяват сами', 'Импорт CSV/XLSX с откриване на дубликати; класирани предложения, които вие потвърждавате.'],
      ],
    },
    tax: {
      eyebrow: 'Създаден за българското ДДС и отчетност', h2a: 'Дневници и отчети, изчислени от главната книга,', h2b: 'а не въведени във формуляр.',
      body: 'Acco следва българските счетоводни и ДДС правила от първия ден: проверки на ЕИК и ДДС номер, ДДС третирания от стандартните 20% до вътреобщностни придобивания, дневници за покупки и продажби по периоди, PDF фактури на кирилица и подготовка на SAF-T за НАП. Всяка цифра води до ред в дневника и до документа зад него.',
      points: [
        ['ДДС дневници и обобщение за периода', 'Дневници за покупки и продажби, начислен и ползван ДДС, сумата за внасяне или възстановяване за месеца. VIES набор за вътреобщностни доставки.'],
        ['Управленски отчети', 'Оборотна ведомост, ОПР, баланс, главна книга, приходи и разходи по месеци, паричен поток. CSV експорт за месечните отчети.'],
        ['Подготовка на SAF-T', 'Набор от данни и валидация днес. XML експорт и обвързване с официалната схема на НАП са планирани.'],
      ],
    },
    ai: {
      eyebrow: 'AI счетоводител', h2a: 'Попитайте защо. Получете отговор с източници.', h2b: 'Нищо не се променя.',
      lead: 'Фиксиран набор от въпроси за вашето ДДС, вземания, задължения и резултати. Всеки отговор се изгражда от главната книга и дневниците, цитира използваните записи и показва ниво на увереност. Когато данните липсват, казва го.',
      points: [
        ['Цифрите идват от вашите записи', 'Асистентът никога не генерира числа. Той чете дневника, регистрите и документите.'],
        ['Версиирани правила', 'Данъчните правила са изрични карти с правно основание и версия. Картите, които чакат преглед от счетоводител, са обозначени и понижават увереността.'],
        ['Само четене по замисъл', 'Асистентът няма достъп до осчетоводяване, одобрение, заключване на периоди или подаване. Всеки въпрос и отговор се записва в одитната следа.'],
      ],
    },
    control: {
      eyebrow: 'Контрол и проследимост', h2a: 'Създаден така, че да вярвате на цифрите', h2b: 'и да можете да покажете откъде идват.',
      items: [
        ['Изолация по фирми', 'Всяка фирма е отделена на ниво база данни. Заявка извън нейния контекст се отказва, а не само се скрива.'],
        ['Роли, проверявани на сървъра', 'Одобряване, заключване и издаване са обвързани с роли. Сървърът проверява действието отново; интерфейсът само го отразява.'],
        ['Корекции чрез сторно', 'Осчетоводен запис никога не се редактира. Грешката се поправя с нов, сторниращ запис, така че историята остава видима.'],
        ['Счетоводни периоди', 'Заключете период, за да го приключите. Осчетоводяване в заключен период се отказва.'],
        ['Документите се пазят с историята си', 'Оригиналните файлове се съхраняват с неизменяема история на версиите, така че всяко осчетоводяване води обратно до документа.'],
      ],
    },
    status: {
      eyebrow: 'Честно за статуса', h2: 'Какво е налично днес и какво предстои.',
      lead: 'Като налични са изброени само възможности, които съществуват в продукта. Всичко, което още се валидира, е отбелязано като бета.',
      available: 'Налично', planned: 'Планирано', live: 'Работи', beta: 'Бета', plannedTag: 'Планирано',
      availableItems: [
        ['Приемане на документи и извличане', 'PDF с текстов слой и XML фактури, обработени директно', ''],
        ['OCR за снимки и сканирани PDF', 'EU доставчик на document AI (Azure Document Intelligence, регионът е ограничен до ЕС); включва се за всяка инсталация', 'beta'],
        ['Опашка за преглед с корекции и одобрение', '', ''],
        ['Неизменяема главна книга, дневник, счетоводни периоди', '', ''],
        ['Фактуриране: номерация, проформи, кредитни и дебитни известия', 'PDF се генерира при издаване', ''],
        ['Банков импорт (CSV/XLSX), съпоставяне, плащания', '', ''],
        ['ДДС дневници, обобщение за периода, VIES набор', 'Проверка на формата на ДДС номер; проверка на живо във VIES се конфигурира за инсталацията', ''],
        ['Отчети: оборотна ведомост, ОПР, баланс, главна книга, месечни, паричен поток', 'CSV експорт за месечните отчети', ''],
        ['AI счетоводител с цитати', '', ''],
        ['SAF-T набор от данни и валидация', 'XML експортът се включва за инсталацията; обвързване с официалната схема на НАП е планирано', 'beta'],
      ],
      plannedItems: [
        ['Валидация на точността на извличане върху реални сканирани фактури', 'Процедурата и инструментът за оценка съществуват; събира се етикетиран набор от примери'],
        ['Изтегляне на PDF фактура и изпращане по имейл от приложението', 'PDF се генерира и съхранява; изпращането от интерфейса още не е свързано'],
        ['Експорт на справка-декларация във формата на НАП', 'Файлове DEKLAR / POKUPKI / PRODAGBI за ръчно подаване'],
        ['Обвързване с официалната SAF-T XSD схема', 'Днес експортът се валидира спрямо вътрешната схема на набора'],
        ['Двуфакторна автентикация (TOTP)', 'Активиране от настройките на профила'],
      ],
    },
    faq: {
      eyebrow: 'Въпроси', h2: 'Често задавани въпроси', pageH1: 'Въпроси с ясни отговори.', pageLead: 'За документите, ДДС, контрола и достъпа.', navLabel: 'Раздели с въпроси',
      groups: [
        ['Първи стъпки', [
          ['Трябва ли ми счетоводител, за да ползвам Acco?', 'Не. Acco е създаден така, че да водите собственото си счетоводство: прочита документите, предлага счетоводното третиране и ДДС, а вие одобрявате. Ако работите със счетоводител, добавете го към фирмата с неговата роля (счетоводител, одобряващ или наблюдател).'],
          ['Какви документи мога да качвам?', 'PDF фактури с текстов слой и XML фактури се четат директно. Снимки и сканирани PDF минават през EU доставчик на document AI (бета), когато той е включен за вашата инсталация. Винаги можете да коригирате или допълните полета в екрана за преглед.'],
          ['В каква валута работи Acco?', 'EUR е функционалната валута за всички суми, отчети и дневници.'],
          ['Могат ли няколко души да работят в една фирма?', 'Да. Потребителите се добавят към фирма с роля. Ролите определят кой може да одобрява, да заключва периоди или да издава фактури, а сървърът проверява действието отново.'],
        ]],
        ['Осчетоводяване, ДДС и AI', [
          ['Осчетоводява ли Acco нещо автоматично?', 'Не. Осчетоводяването на документи се одобрява от човек в екрана за преглед. Издаването на фактура или потвърждаването на банково съпоставяне осчетоводява свързания запис, когато вие извършите това действие. Нищо не стига до главната книга само.'],
          ['Как се третира ДДС?', 'ДДС третирането се предлага за всеки документ от правила: стандартна ставка 20%, намалена 9%, нулева, вътреобщностни придобивания и внос. Дневниците за покупки и продажби и обобщението за периода се изчисляват от осчетоводените записи.'],
          ['Подава ли Acco нещо към НАП?', 'Не. Дневниците, обобщението за периода и SAF-T наборът се подготвят за вас; подаването остава ваше действие. Експорт във файловия формат на справката-декларация е планиран.'],
          ['Какво прави AI и какво не може?', 'Чете документи, предлага сметки, категории и ДДС третиране и обяснява цифри с цитати. Не може да осчетоводява, одобрява, заключва периоди или подава. Тези действия са на хората и се записват в одитната следа.'],
          ['Какво е в бета в момента?', 'OCR за снимки и сканове (EU доставчик на document AI, включва се за инсталацията, валидацията на точността върху реални фактури тече) и SAF-T (набор от данни и валидация; XML експортът се включва за инсталацията, обвързването с официалната схема е планирано).'],
        ]],
        ['Записи и данни', [
          ['Може ли осчетоводен запис да се редактира?', 'Не. Главната книга е само за добавяне. Грешката се поправя със сторниращ запис, така че случилото се остава видимо.'],
          ['Как са защитени данните ми?', 'Всяка фирма е изолирана на ниво база данни, главната книга е само за добавяне, а всяко действие, което променя състояние, се записва в одитна следа с хеш-верига. Когато OCR за сканове е включен, доставчикът на document AI е ограничен до региони в ЕС чрез конфигурация.'],
          ['Какво става с данните ми при пускането на пазара?', 'Остават във вашата фирма. Фирмите с ранен достъп запазват главната книга, документите и историята си, когато бъдат въведени публични планове.'],
        ]],
        ['Достъп', [
          ['Как работи контролираният достъп?', 'Създайте акаунт и качете първата си фактура. Acco се валидира с ограничен брой фирми; цените се публикуват при пускането, а фирмите с ранен достъп виждат плановете първи и запазват данните си.'],
          ['Колко струва?', 'Acco е в контролиран достъп и цените още не са публични. По време на ранния достъп не се изисква карта.'],
        ]],
      ],
    },
    ctaBand: {
      h: 'Започнете с една фактура.', p: 'Създайте акаунт, качете документ и вижте предложеното осчетоводяване. Решението, както винаги, е ваше.',
      side: ['Контролиран достъп, докато валидираме извличането и ДДС процеса върху реални документи.', 'Функционална валута EUR. Човешко одобрение на осчетоводяването на документи. Одитна следа с хеш-верига.'],
      productH: 'Вижте продукта върху собствените си фактури.', productP: 'Създайте акаунт, качете документ и вижте предложеното осчетоводяване: качване, преглед, одобрение, осчетоводяване.',
      pricingH: 'Искате да видите Acco върху собствените си документи?', pricingP: 'Създайте акаунт и качете първата си фактура. Решението, както винаги, е ваше.',
    },
    product: {
      eyebrow: 'Продукт', h1a: 'Всичко, което Acco прави,', h1b: 'в реда, в който се върши работата.',
      lead: 'Девет глави, всяка показва реалния екран. Планираната работа е изброена отделно и обозначена.',
      chapters: [
        ['Приемане', 'Всеки документ влиза, проверен и съхранен.', ['PDF, JPG/PNG и XML фактури, чрез качване', 'Проверка на тип, размер и съдържание на файла', 'Неизменяема история на версиите; кошче с възстановяване', 'Всяко качване се записва в одитната следа']],
        ['Извличане', 'Полета, прочетени с увереност, факти, проверени по правила.', ['Стойности поле по поле с увереност и произход', 'Контролна сума на ЕИК, формат на ДДС номер, IBAN mod-97', 'Диагностика: защо поле е празно или е отхвърлено', 'XML се чете директно; сканове през EU доставчик на document AI (бета)']],
        ['Преглед и одобрение', 'Решението остава при човека.', ['Опашка от документи, чакащи преглед', 'Оригиналът до полетата; слабите полета са отбелязани', 'Коригирайте полета, добавете липсващи, генерирайте ново предложение', 'Одобрете или отхвърлете; само потребител с подходяща роля може']],
        ['Главна книга и периоди', 'Балансирана, само за добавяне, с приключване.', ['Двустранният баланс се налага в базата данни', 'Без редакции и изтривания; корекциите са сторниращи записи', 'Заключете период; осчетоводяването в него се отказва', 'Дневник с всеки запис, ред и оригинален документ']],
        ['Фактуриране', 'Издаване, номериране, осчетоводяване.', ['Последователна номерация по серия и година', 'Проформи, кредитни и дебитни известия, превръщане във фактура', 'Каталог с продукти и услуги с ДДС кодове', 'PDF се генерира при издаване (изтегляне и изпращане от приложението са планирани)']],
        ['Банка, вземания, задължения', 'Съпоставено, никога осчетоводено само.', ['Импорт на извлечения CSV/XLSX с откриване на дубликати по редове', 'Класирани предложения за съпоставяне; вие потвърждавате всяко', 'Плащания и сторна се осчетоводяват в главната книга', 'Отворени позиции и падежна структура за вземания и задължения']],
        ['ДДС и SAF-T', 'Българско ДДС, от главната книга.', ['Дневници за покупки и продажби по периоди', 'Обобщение за периода: начислен, ползван, за внасяне или възстановяване', 'Предлагани третирания: 20%, 9%, 0%, вътреобщностни, внос', 'VIES набор; SAF-T набор и валидация (бета)']],
        ['Отчети', 'Цифри, които водят до ред в дневника.', ['Оборотна ведомост и главна книга', 'Отчет за приходите и разходите, баланс', 'Приходи и разходи по месеци, паричен поток', 'CSV експорт за месечните отчети']],
        ['AI счетоводител', 'Обяснява. Никога не осчетоводява.', ['Фиксирани въпроси за ДДС, вземания, задължения и резултати', 'Цитати към дневника, регистрите и документите', 'Ниво на увереност; въздържа се, когато липсват данни', 'Само четене по замисъл; всеки въпрос се записва в одитната следа']],
      ],
      extractionCallout: 'Отбелязано: ниска увереност',
      bg: {
        eyebrow: 'Създаден за българските изисквания', h2a: 'Европейски продукт.', h2b: 'Българско счетоводство по подразбиране.',
        lead: 'Acco не е универсална главна книга с превод отгоре. Проверките, ДДС третиранията, дневниците и експортите следват българските правила, така че подготвената работа е тази, която вашият счетоводител очаква.',
        points: [
          ['Проверки на ЕИК и ДДС номер', 'Контролна сума на ЕИК, формат на ДДС номер, IBAN mod-97. Решават се от валидатори преди какъвто и да е AI резултат.'],
          ['Български ДДС третирания', '20% стандартна, 9% намалена, 0%, вътреобщностни придобивания и внос се предлагат от правила; освободени и износ се задават ръчно.'],
          ['Дневници по периоди', 'Дневници за покупки и продажби и обобщение за периода, изградени от осчетоводените записи; VIES набор за вътреобщностни доставки.'],
          ['Фактури по българските правила', 'Последователна номерация по серия и година; проформи, кредитни и дебитни известия; PDF на кирилица.'],
          ['SAF-T за НАП', 'Набор от данни и валидация в бета; XML експортът се включва за инсталацията; обвързването с официалната схема е планирано.'],
          ['OCR, ограничен до региони в ЕС', 'Когато OCR за сканове е включен с Azure Document Intelligence, доставчикът е ограничен до региони в ЕС чрез конфигурация (бета).'],
        ],
      },
    },
    pricing: {
      eyebrow: 'Цени', h1a: 'Контролиран достъп сега.', h1b: 'Публични цени при пускането.',
      lead: 'Acco се отваря за ограничен брой фирми, докато валидираме извличането и ДДС процеса върху реални документи. Публикуваме плановете, когато са окончателни, не по-рано.',
      accessEyebrow: 'Ранен достъп', accessH2: 'Пълният продукт, по време на контролирания достъп.', price: 'Контролиран достъп', priceSmall: 'цените се обявяват при пускането · не се изисква карта',
      checks: ['Приемане на документи, извличане, преглед и одобрение', 'Неизменяема главна книга, дневник, счетоводни периоди', 'Фактуриране, банка, вземания и задължения', 'ДДС дневници, отчети, SAF-T (бета)', 'AI счетоводител с цитати', 'Функционална валута EUR, одитна следа с хеш-верига'],
      howEyebrow: 'Как се получава достъп',
      steps: [
        ['Създайте акаунт', 'Регистрацията е отворена. Настройте фирмата си с ЕИК и ДДС статус.'],
        ['Качете първата си фактура', 'Прегледайте извлечените полета, одобрете предложеното третиране, осчетоводете. Върху собствените си документи.'],
        ['Водете счетоводството', 'Фактури, банкови извлечения, ДДС дневници и отчети, като всяко осчетоводяване на документ е одобрено от вас.'],
        ['Цени при пускането', 'Фирмите с ранен достъп виждат плановете първи и при всички случаи запазват данните си.'],
      ],
      meansEyebrow: 'Какво означава достъпът', meansH2: 'Три неща, на които можете да разчитате по време на ранния достъп.',
      means: [
        ['Реалният продукт, не демо', 'Вашата фирма, вашите документи, вашата главна книга. Всичко, което осчетоводите, остава ваше; нищо не се нулира при пускането.'],
        ['Вашите данни, вашите решения', 'Човешко одобрение на осчетоводяването на документи, неизменяема главна книга и одитна следа с хеш-верига важат от първия ден.'],
        ['Без изненади при пускането', 'Плановете се публикуват, когато са окончателни. Фирмите с ранен достъп ги виждат първи и запазват главната книга, документите и историята си.'],
      ],
      whoEyebrow: 'За кого е', whoH2: 'Самонаети, малки фирми и счетоводителите, които ги обслужват.',
      whoLead: 'Ако получавате и издавате фактури в България, подавате ДДС всеки месец и искате да виждате какво е осчетоводено и защо, Acco е създаден за вас. Счетоводителите могат да работят във фирмата на клиент със собствена роля.',
    },
    about: {
      eyebrow: 'За нас', h1: 'Защо съществува Acco.', lead: 'Защото собственикът на малка фирма не бива да избира между това да я управлява и да се бори с фактури, ДДС и срокове.',
      proseLg: 'Ръчното въвеждане е бавно, а грешките струват скъпо. Софтуерът може да върши рутинното: да чете, да предлага, да обяснява. Той никога не бива да решава за парите или за държавата вместо човек.',
      body: 'Това правило е вградено в Acco на всяко ниво: в ролите, които пазят одобрението и осчетоводяването, в главната книга, която отказва небалансиран запис или заключен период, и в одитната следа, която записва кой какво е направил.',
      statementA: 'Софтуерът трябва да помага.', statementB: 'Не бива да решава мълчаливо.',
      defs: [
        ['Първо детерминирано', 'Правила преди модели', 'Проверимите факти като ЕИК, ДДС номер, IBAN и двустранния баланс се решават от валидатори. Моделът може да чете, класифицира и предлага; той няма глас за контролната сума.'],
        ['Човек решава', 'Одобрението е човешко действие', 'Осчетоводяването на документи изисква изрично одобрение от потребител с подходяща роля. AI не може да осчетоводява, да заключва период, да издава фактура или да променя права.'],
        ['Проследимо', 'Всяка цифра има източник', 'Всяко число води до ред в дневника и до документ; всяко действие, което променя състояние, води до запис в одитната следа с хеш-верига. Обясненията цитират използваното и се въздържат, когато данните липсват.'],
      ],
      removesEyebrow: 'Какво сваля от бюрото ви', removesH2: 'По-малко писане. По-малко гадаене. По-малко изненади в края на месеца.',
      removesLead: 'Повтарящата се част от счетоводството се подготвя за вас: четене на фактури, намиране на правилната сметка, изчисляване на ДДС, съпоставяне на банкови редове. Частта, която изисква преценка, остава видима и остава ваша.',
      removes: [
        ['Четене и писане', 'Полетата се извличат с увереност; идентификаторите се проверяват; коригирате отбелязаното, вместо да въвеждате всичко отново.'],
        ['Намиране на третирането', 'Сметки, категория разход и ДДС третиране се предлагат от правила и памет по доставчик, с показана причина.'],
        ['Съпоставяне', 'Банковите редове се съпоставят с фактури чрез класирано предложение; вие потвърждавате, главната книга записва.'],
      ],
      missingEyebrow: 'Какво Acco не прави', missingH2: 'Някои неща липсват нарочно.', byDesign: 'По замисъл',
      missing: [
        ['Без автоматично осчетоводяване', 'Осчетоводяването на документи се одобрява от човек в екрана за преглед.'],
        ['Без скрити промени в записите', 'Осчетоводените записи никога не се редактират. Корекциите са нови, сторниращи записи.'],
        ['Без генерирани числа', 'Асистентът обяснява цифри от главната книга и ги цитира; не произвежда свои.'],
        ['Без подаване от ваше име', 'Дневниците и експортите се подготвят, за да подадете вие. Директното подаване към НАП е нарочно извън обхвата.'],
      ],
    },
    contact: {
      eyebrow: 'Контакт', h1a: 'Публичният канал за контакт', h1b: 'се подготвя.',
      lead: 'Директните запитвания временно не са налични, докато публичният канал за контакт се конфигурира. Няма да публикуваме адрес, преди да е проверен и наблюдаван. Дотогава най-бързият път е самият продукт.',
      status: ['Статус', 'Канал за контакт: в процес на конфигуриране. Тази страница ще съдържа проверения адрес, щом бъде активен.'],
      who: ['За кого е Acco', 'Самонаети и малки фирми в България, които получават и издават фактури; счетоводители, които искат да водят клиентски фирми в Acco.'],
      legal: ['Правна информация', 'Страниците за поверителност, общи условия, бисквитки и GDPR са в долния колонтитул (на български).'],
      paths: [
        ['Създайте акаунт', 'Регистрацията е отворена по време на контролирания достъп. Настройте фирмата и качете първата си фактура.'],
        ['Вход', 'Вече имате фирма в Acco? Продължете оттам, докъдето сте стигнали.'],
        ['Вижте продукта', 'Девет глави, всяка с реалния екран, в реда, в който се върши работата.'],
        ['Прочетете въпросите', 'Документи, ДДС, контрол и достъп, обяснени ясно.'],
      ],
    },
    meta: {
      home: ['Acco · Счетоводство, което подготвя работата. Вие одобрявате.', 'Acco прочита фактурите, предлага счетоводното третиране и ДДС и осчетоводява в неизменяема главна книга само след одобрение от човек. EUR, българско ДДС по подразбиране.'],
      features: ['Продукт · Acco', 'Какво прави Acco днес: приемане, извличане, преглед, неизменяема главна книга, фактуриране, банка, ДДС, отчети и AI счетоводител.'],
      pricing: ['Цени · Acco', 'Acco е в контролиран достъп; цените ще бъдат публикувани при пускането.'],
      about: ['За нас · Acco', 'Защо съществува Acco: първо детерминирано, човек решава, пълна проследимост.'],
      faq: ['Въпроси · Acco', 'Често задавани въпроси за документите, ДДС, контрола и достъпа.'],
      contact: ['Контакт · Acco', 'Как да стигнете до Acco по време на контролирания достъп. Публичният канал за контакт се подготвя.'],
      appDesc: 'Счетоводен софтуер за български фирми: извличане от документи, човешки преглед, неизменяема главна книга, ДДС и отчети.',
    },
    ui: {
      review: 'Преглед', invoice: 'Фактура', no: '№', supplier: 'Доставчик', customer: 'Получател', uic: 'ЕИК', subscription: 'Абонамент Prima Cloud · октомври',
      taxBase: 'Данъчна основа', vat20: 'ДДС 20%', total: 'Общо', extracted: 'Извлечени данни', overall: 'обща увереност 94%', document: 'Документ', invoiceNo: 'Номер на фактура',
      taxEventDate: 'Дата на данъчно събитие', amountsVat: 'Суми и ДДС', treatment: 'Третиране', standard: 'стандартно · 20%', name: 'Име', checked: 'проверено', rule: 'правило', invalid: 'невалиден',
      decision: 'Решение', awaiting: 'чака преглед', approved: 'одобрено', posted: 'осчетоводено', stepExtraction: 'Извличане', stepReview: 'Преглед на полетата', stepApproval: 'Одобрение', stepPosting: 'Осчетоводяване',
      approve: 'Одобри', reject: 'Отхвърли', postToLedger: 'Осчетоводи', journalEntry: 'Запис в дневника', suggestion: 'Предложение', fromMemory: 'от памет',
      drServices: 'Дт Услуги', drInputVat: 'Дт ДДС покупки', crSuppliers: 'Кт Доставчици', vatNote: 'стандартна 20% · БГ доставчик · код STD20', vatLabel: 'ДДС:',
      postedTitle: 'Осчетоводено в главната книга', approvedBy: 'Одобрено от', recorded: 'записано в одитната следа',
      receivables: 'Вземания', payables: 'Задължения', viewAll: 'Всички →', current: 'Текущи', overdue: 'Просрочени · 3 документа',
      payablesByDue: 'Задължения по падеж', asOf: 'към 03.10.2026', bucket: 'Период', docs: 'Док.', amount: 'Сума', share: 'Дял', d1_30: '1–30 дни', d31_60: '31–60 дни', totalOpen: 'Общо отворени',
      bankStatement: 'Банково извлечение · UniCredit', toReconcile: '3 за съпоставяне', date: 'Дата', description: 'Описание', status: 'Статус', paymentInv: 'Плащане ф-ра 1180', receipt: 'Постъпление · ф-ра 2026-0031', rent: 'Наем октомври',
      suggested: 'предложено', matched: 'съпоставено', match: 'Съвпадение:', matchText: 'фактура 0000001180 · Софтуер Прима · 228,00 €', confirm: 'Потвърди',
      trialBalance: 'Оборотна ведомост', period: '01.01.2026 – 03.10.2026', account: 'Сметка', debit: 'Дебит', credit: 'Кредит', balance: 'Салдо', suppliers: 'Доставчици', customers: 'Клиенти', inputVat: 'ДДС покупки', outputVat: 'ДДС продажби', revenue: 'Приходи', balanced: 'балансирана',
      outputVatK: 'Начислен ДДС', inputVatK: 'Ползван ДДС', vatPayable: 'ДДС за внасяне', salesInvoices: '12 фактури продажби', purchases: '27 покупки', period09: 'период 09/2026',
      saftExports: 'SAF-T експорти', errors: 'Грешки', warnings: 'Предупр.', completed: 'валидиран', dataset: 'Набор', sep: 'Септември 2026', aug: 'Август 2026', periodCol: 'Период',
      aiTitle: 'AI счетоводител', readsOnly: 'само чете · никога не осчетоводява', q1: 'Защо дължа толкова ДДС?', q2: 'Откъде идва сумата?', q3: 'Какво да проверя преди подаване', deterministic: 'детерминирано',
      answer: 'За 09/2026 дължите <strong>1 240,00 €</strong>: начислен ДДС 3 120,00 € по 12 фактури за продажби минус ползван ДДС 1 880,00 € по 27 покупки. Най-голям принос има ф-ра 2026-0031 към Делта Консулт ООД (основа 1 500,00 €).',
      sources: 'Източници', src1: 'Дневник продажби 09/2026', src2: 'Дневник покупки 09/2026', src3: 'ф-ра 2026-0031', foot: 'Обяснение, изградено от вашите записи. Асистентът не може да осчетоводява, одобрява или подава.',
      journal: 'Дневник', appendOnly: 'само за добавяне · корекциите са сторниращи записи', purchaseInvoice: 'Фактура за покупка 0000001180 · Софтуер Прима ЕООД', externalServices: 'Външни услуги', suppliersOf: 'Доставчици · Софтуер Прима ЕООД',
      dashboard: 'Начало', awaitingReview: 'Чакат преглед', needApproval: 'за одобрение', overdue3: '3 просрочени', netResult: 'Резултат · 2026', fromLedger: 'от главната книга', recentDocs: 'Последни документи', all: 'Всички →', file: 'Файл', extracting: 'извлича се',
      uploadDocs: 'Качване на документи', uploadMeta: 'PDF · JPG · PNG · XML · до 25 MB', drop: 'Пуснете файлове тук или изберете от компютъра', dropSub: 'Всеки файл се проверява, съхранява с история на версиите и се нарежда за извличане.', size: 'Размер', uploaded: 'Качен', extractedFields: 'извлечен', parsedXml: 'прочетен · XML',
      auditTrail: 'Одитна следа', chainVerified: 'веригата е проверена · 1 284 събития', a1: '<b>Ана Димитрова</b> осчетоводи <code>№417</code> от преглед <code>f-1180-softprima.pdf</code>', a2: '<b>Ана Димитрова</b> одобри прегледа · коригира <code>tax_base</code> 19,00 → 190,00 €', a3: '<b>AI предложение</b> предложи 602 / 4531 / 401 · правило <code>STD20</code> · памет: Софтуер Прима', a4: '<b>Извличане</b> завършено · обща увереност 94%', a5: '<b>Ана Димитрова</b> качи <code>f-1180-softprima.pdf</code>',
      periods: 'Счетоводни периоди', open: 'отворен', locked: 'заключен', entries: 'Записи', lockedBy: 'Заключен от', oct: 'Октомври 2026',
      invoices: 'Фактури', newDocument: 'Нов документ', number: 'Номер', issued: 'издадена', proforma: 'проформа', creditNote: 'кредитно известие',
      ticketJe: '№417 · 03.10.2026',
    },
  },
};

/* money formatting per language (the real app uses bg-BG formatting in Bulgarian) */
const fmt = (lang) => (v) => (lang === 'bg' ? String(v).replace(/(\d)\.(\d\d)(?= €|$)/g, '$1,$2') : v);

/* ============================================================================
   Page builders. ctx = { L (lang), T (dict), p (url prefix), m (money) }
   ============================================================================ */
const mk = (L) => ({ L, T: DICT[L], p: L === 'bg' ? '' : '/en', m: fmt(L) });
const href = (ctx, path) => (path === '/' ? (ctx.p || '/') : ctx.p + path);
const urlFor = (L, key) => (L === 'bg' ? key : (key === '/' ? '/en' : '/en' + key));
const brand = (ctx) => `<a class="brand" href="${href(ctx, '/')}" aria-label="${BRAND}">${LOGO}<span>acco</span></a>`;

const NAV = (ctx) => [['/features', ctx.T.nav.product], ['/#how', ctx.T.nav.how], ['/#ai-accountant', ctx.T.nav.ai], ['/pricing', ctx.T.nav.pricing], ['/about', ctx.T.nav.about]];
const langSwitch = (ctx, key, cls) => {
  const item = (lang) => lang === ctx.L
    ? `<span aria-current="true" lang="${lang}">${lang.toUpperCase()}</span>`
    : `<a href="${urlFor(lang, key)}" lang="${lang}" hreflang="${lang}" aria-label="${DICT[lang].langLabel}">${lang.toUpperCase()}</a>`;
  return `<nav class="lang ${cls}" aria-label="${ctx.T.langNav}">${item('bg')}${item('en')}</nav>`;
};

const head = (ctx, p) => {
  const T = ctx.T; const url = `${SITE}${p.url}`; const alt = p.alt;
  return `<!DOCTYPE html>
<html lang="${T.htmlLang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${p.title}</title>
<meta name="description" content="${p.desc}" />
<link rel="canonical" href="${url}" />
<link rel="alternate" hreflang="bg" href="${SITE}${alt.bg}" />
<link rel="alternate" hreflang="en" href="${SITE}${alt.en}" />
<link rel="alternate" hreflang="x-default" href="${SITE}${alt.bg}" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${BRAND}" />
<meta property="og:locale" content="${T.locale}" />
<meta property="og:locale:alternate" content="${ctx.L === 'bg' ? 'en_GB' : 'bg_BG'}" />
<meta property="og:title" content="${p.title}" />
<meta property="og:description" content="${p.desc}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${p.title}" />
<meta name="twitter:description" content="${p.desc}" />
<meta name="theme-color" content="#FFFFFF" />
<link rel="icon" href="/landing/assets/app-icon.svg" type="image/svg+xml" />
<link rel="icon" href="/landing/assets/icons/favicon-32.png" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="/landing/assets/icons/apple-touch-icon.png" />
<link rel="manifest" href="/landing/assets/icons/site.webmanifest" />
<link rel="preload" href="/landing/assets/fonts/InterVariable.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="/landing/assets/tokens.css?${V}" />
<link rel="stylesheet" href="/landing/assets/site.css?${V}" />
<script type="application/ld+json">${JSON.stringify(p.jsonld)}</script>
</head>
<body>
<a class="skip" href="#main">${T.skip}</a>`;
};

const nav = (ctx, active) => {
  const T = ctx.T;
  return `
<header class="nav" id="nav">
  <div class="wrap inner">
    ${brand(ctx)}
    <nav class="nav-links" aria-label="${T.mainNav}">
      ${NAV(ctx).map(([h, t]) => `<a href="${href(ctx, h)}"${h === active ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
    </nav>
    <div class="nav-actions">
      ${langSwitch(ctx, active, 'lang-desktop')}
      <a class="btn btn-out btn-sm" href="/login">${T.cta.signin}</a>
      <a class="btn btn-ink btn-sm" href="/register">${T.cta.start}</a>
      <button class="nav-burger" id="burger" aria-label="${T.menu}" aria-expanded="false" aria-controls="mobile-menu"><span class="ic-menu">${I.menu}</span><span class="ic-close">${I.close}</span></button>
    </div>
  </div>
</header>
<nav class="mobile-menu" id="mobile-menu" aria-label="${T.mobileNav}">
  <div class="mm-lang">${langSwitch(ctx, active, 'lang-mobile')}</div>
  ${[...NAV(ctx), ['/faq', T.nav.faq], ['/contact', T.nav.contact]].map(([h, t]) => `<a class="mm-link" href="${href(ctx, h)}">${t} ${I.chev}</a>`).join('')}
  <div class="mm-actions"><a class="btn btn-ink" href="/register">${T.cta.start}</a><a class="btn btn-out" href="/login">${T.cta.signin}</a></div>
  <p class="mm-foot">${T.tagline}</p>
</nav>
<main id="main">`;
};

const fcol = (h, links) => `<div><h2 class="fh">${h}</h2>${links.map(([u, t]) => `<a href="${u}">${t}</a>`).join('')}</div>`;
const footer = (ctx) => {
  const T = ctx.T;
  return `</main>
<footer class="footer" aria-label="${T.footerNav}">
  <div class="wrap">
    <div class="cols">
      <div>
        ${brand(ctx)}
        <p class="about">${T.footer.about}</p>
      </div>
      ${fcol(T.footer.product, [[href(ctx, '/features'), T.footer.features], [href(ctx, '/#how'), T.nav.how], [href(ctx, '/#ai-accountant'), T.nav.ai], [href(ctx, '/pricing'), T.nav.pricing], [href(ctx, '/faq'), T.nav.faq]])}
      ${fcol(T.footer.company, [[href(ctx, '/about'), T.nav.about], [href(ctx, '/contact'), T.nav.contact], ['/login', T.cta.signin], ['/register', T.cta.createAccount]])}
      ${fcol(T.footer.legal, [['/landing/legal/privacy.html', T.footer.privacy], ['/landing/legal/terms.html', T.footer.terms], ['/landing/legal/cookies.html', T.footer.cookies], ['/landing/legal/gdpr.html', T.footer.gdpr]])}
    </div>
    <div class="bottom"><span>© ${new Date().getFullYear()} ${BRAND}. ${T.footer.rights}</span><span>${T.footer.line}</span></div>
  </div>
</footer>
<script src="/landing/assets/site.js?${V}" defer></script>
</body>
</html>`;
};

/* ============================================================================
   Product fragments (miniatures of the real screens, in the page language)
   ============================================================================ */
const bar = (ctx, crumb) => `<div class="ui-bar"><span class="brand">${LOGO}<span>acco</span></span><span class="crumb">${crumb}</span><span class="sp"><span class="av">АД</span></span></div>`;
const sup = (ctx) => (ctx.L === 'bg' ? 'Софтуер Прима ЕООД' : 'Softuer Prima EOOD');
const cust = (ctx) => (ctx.L === 'bg' ? 'Демо Фирма ЕООД' : 'Demo Firma EOOD');
const person = (ctx) => (ctx.L === 'bg' ? 'Ана Димитрова' : 'Ana Dimitrova');

const frPaper = (ctx, hl = '') => { const u = ctx.T.ui, m = ctx.m; return `
<div class="paper ui-paper">
  <p class="p-h5">${u.invoice}</p><div class="no">${u.no} 0000001180 · 30.09.2026</div>
  <div class="grid"><div><b>${u.supplier}</b><span>${sup(ctx)}</span><span class="mono" style="font-size:10.5px">${u.uic} 204117823</span></div><div><b>${u.customer}</b><span>${cust(ctx)}</span><span class="mono" style="font-size:10.5px">${u.uic} 123456789</span></div></div>
  <div class="row"><span>${u.subscription}</span><span class="num">${m('190.00')}</span></div>
  <div class="row"><span>${u.taxBase}</span><span class="num${hl === 'net' ? ' hl' : ''}">${m('190.00 €')}</span></div>
  <div class="row"><span>${u.vat20}</span><span class="num">${m('38.00 €')}</span></div>
  <div class="row total"><span>${u.total}</span><span class="num${hl === 'total' ? ' hl' : ''}">${m('228.00 €')}</span></div>
</div>`; };

const frReviewMain = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui lift">
  ${bar(ctx, `<span>${u.review}</span><span>›</span><b>f-1180-softprima.pdf</b>`)}
  <div class="ui-title"><p class="ui-h5">f-1180-softprima.pdf</p><div class="meta"><b>${sup(ctx)}</b><span>${u.no} 0000001180</span><span>30.09.2026</span><b class="num">${m('228.00 €')}</b></div></div>
  <div class="ui-h" style="border-top:1px solid var(--line);margin-top:10px"><b>${u.extracted}</b><span class="conf ok">${u.overall}</span></div>
  <div class="ui-fields">
    <div class="ui-group">${u.document}</div>
    <div class="ui-field"><div><b>${u.invoiceNo}</b><strong>0000001180</strong></div><span class="conf ok">98%</span></div>
    <div class="ui-field"><div><b>${u.taxEventDate}</b><strong>30.09.2026</strong></div><span class="conf ok">96%</span></div>
    <div class="ui-group">${u.amountsVat}</div>
    <div class="ui-field flag"><div><b>${u.taxBase}</b><strong>${m('190.00 €')}</strong></div><span class="conf warn">71%</span></div>
    <div class="ui-field"><div><b>${u.vat20}</b><strong>${m('38.00 €')}</strong></div><span class="conf ok">${u.checked}</span></div>
    <div class="ui-field"><div><b>${u.total}</b><strong>${m('228.00 €')}</strong></div><span class="conf ok">${u.checked}</span></div>
    <div class="ui-field"><div><b>${u.treatment}</b><strong>${u.standard}</strong></div><span class="conf ok">${u.rule}</span></div>
    <div class="ui-group">${u.supplier}</div>
    <div class="ui-field"><div><b>${u.name}</b><strong>${sup(ctx)}</strong></div><span class="conf ok">94%</span></div>
    <div class="ui-field"><div><b>${u.uic}</b><strong>204117823</strong></div><span class="conf ok">${u.checked}</span></div>
  </div>
</div>`; };

const frDecision = (ctx, state = 'review') => { const u = ctx.T.ui; return `
<div class="ui">
  <div class="ui-h"><b>${u.decision}</b>${state === 'posted' ? `<span class="pill ok">${u.posted}</span>` : state === 'approved' ? `<span class="pill ok">${u.approved}</span>` : `<span class="pill warn">${u.awaiting}</span>`}</div>
  <ul class="ui-steps">
    <li class="done"><i>✓</i>${u.stepExtraction}</li>
    <li class="${state === 'review' ? 'cur' : 'done'}"><i>${state === 'review' ? '' : '✓'}</i>${u.stepReview}</li>
    <li class="${state === 'review' ? '' : 'done'}"><i>${state === 'review' ? '' : '✓'}</i>${u.stepApproval}</li>
    <li class="${state === 'approved' ? 'cur' : state === 'posted' ? 'done' : ''}"><i>${state === 'posted' ? '✓' : ''}</i>${u.stepPosting}</li>
  </ul>
  <div class="ui-actions">${state === 'review' ? `<span class="ui-btn brand block">${u.approve}</span><span class="ui-btn block">${u.reject}</span>` : state === 'approved' ? `<span class="ui-btn brand block">${u.postToLedger}</span>` : `<span class="ui-note" style="margin:0">${u.journalEntry} <b class="mono">#417</b></span>`}</div>
</div>`; };

const frSuggestion = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui">
  <div class="ui-h"><b>${u.suggestion}</b><span class="pill neu">${u.fromMemory}</span></div>
  <div class="ui-lines">
    <div class="ui-line"><code>602</code><span>${u.drServices}</span><span class="r">${m('190.00 €')}</span></div>
    <div class="ui-line"><code>4531</code><span>${u.drInputVat}</span><span class="r">${m('38.00 €')}</span></div>
    <div class="ui-line"><code>401</code><span class="cr">${u.crSuppliers}</span><span class="r">${m('228.00 €')}</span></div>
  </div>
  <div class="ui-note"><b>${u.vatLabel}</b> ${u.vatNote}</div>
</div>`; };

const frTicket = (ctx) => { const u = ctx.T.ui; return `
<div class="ticket">
  <div class="t">${I.checkc} ${u.postedTitle}</div>
  <div class="m">${u.ticketJe}</div>
  <div class="by">${u.approvedBy} <b>${person(ctx)}</b> · ${u.recorded}</div>
</div>`; };

const frAR = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui ui-w">
  <div class="wt">${u.receivables} <span>${u.viewAll}</span></div>
  <div class="big">${m('14 320.00 €')}</div>
  <div class="kv"><span>${u.current}</span><b>${m('11 900.00 €')}</b></div>
  <div class="kv"><span>${u.overdue}</span><b class="warn">${m('2 420.00 €')}</b></div>
</div>`; };

const frAP = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui ui-w"><div class="wt">${u.payables} <span>${u.viewAll}</span></div><div class="big">${m('6 380.00 €')}</div><div class="kv"><span>${u.current}</span><b>${m('4 180.00 €')}</b></div><div class="kv"><span>${u.overdue}</span><b class="warn">${m('2 200.00 €')}</b></div></div>`; };

const barCell = (w, col) => `<td class="hide-sm"><span style="display:block;height:6px;border-radius:99px;background:var(--bg-warm);overflow:hidden"><span style="display:block;width:${w};height:100%;background:var(--${col});opacity:.8"></span></span></td>`;
const frAging = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui">
  <div class="ui-h"><b>${u.payablesByDue}</b><span>${u.asOf}</span></div>
  <table class="ui-table">
    <tr><th>${u.bucket}</th><th class="r">${u.docs}</th><th class="r">${u.amount}</th><th class="hide-sm">${u.share}</th></tr>
    <tr><td class="s">${u.current}</td><td class="r">7</td><td class="r">${m('4 180.00 €')}</td>${barCell('64%', 'brand')}</tr>
    <tr><td class="s">${u.d1_30}</td><td class="r">2</td><td class="r">${m('1 560.00 €')}</td>${barCell('24%', 'warn')}</tr>
    <tr><td class="s">${u.d31_60}</td><td class="r">1</td><td class="r">${m('640.00 €')}</td>${barCell('10%', 'err')}</tr>
    <tfoot><tr><td>${u.totalOpen}</td><td class="r">10</td><td class="r">${m('6 380.00 €')}</td><td class="hide-sm"></td></tr></tfoot>
  </table>
</div>`; };

const frBankMatch = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui">
  <div class="ui-h"><b>${u.bankStatement}</b><span>${u.toReconcile}</span></div>
  <table class="ui-table">
    <tr><th>${u.date}</th><th>${u.description}</th><th class="r">${u.amount}</th><th>${u.status}</th></tr>
    <tr><td>03.10</td><td class="s">${u.paymentInv}</td><td class="r">${m('-228.00 €')}</td><td><span class="pill warn">${u.suggested}</span></td></tr>
    <tr><td>02.10</td><td class="s">${u.receipt}</td><td class="r">${m('1 500.00 €')}</td><td><span class="pill ok">${u.matched}</span></td></tr>
    <tr><td>01.10</td><td class="s">${u.rent}</td><td class="r">${m('-640.00 €')}</td><td><span class="pill ok">${u.matched}</span></td></tr>
  </table>
  <div class="ui-note" style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px"><span><b>${u.match}</b> ${u.matchText} <span class="conf ok" style="margin-left:6px">98%</span></span><span class="ui-btn brand">${u.confirm}</span></div>
</div>`; };

const frTB = (ctx) => { const u = ctx.T.ui, m = ctx.m; const r = (a, n, d, c, b) => `<tr><td class="m">${a}</td><td class="s">${n}</td><td class="r">${m(d)}</td><td class="r">${m(c)}</td><td class="r hide-sm">${m(b)}</td></tr>`; return `
<div class="ui">
  <div class="ui-h"><b>${u.trialBalance}</b><span>${u.period}</span></div>
  <table class="ui-table">
    <tr><th>${u.account}</th><th>${u.name}</th><th class="r">${u.debit}</th><th class="r">${u.credit}</th><th class="r hide-sm">${u.balance}</th></tr>
    ${r('401', u.suppliers, '6 120.00 €', '12 500.00 €', '-6 380.00 €')}
    ${r('411', u.customers, '18 400.00 €', '4 080.00 €', '14 320.00 €')}
    ${r('4531', u.inputVat, '1 880.00 €', '0.00 €', '1 880.00 €')}
    ${r('4532', u.outputVat, '0.00 €', '3 120.00 €', '-3 120.00 €')}
    ${r('702', u.revenue, '0.00 €', '15 900.00 €', '-15 900.00 €')}
    <tfoot><tr><td colspan="2">${u.total}</td><td class="r">${m('26 400.00 €')}</td><td class="r">${m('35 600.00 €')}</td><td class="r hide-sm"><span class="pill ok">${u.balanced}</span></td></tr></tfoot>
  </table>
</div>`; };

const frVatKpis = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui-kpis">
  <div class="ui-kpi"><b>${u.outputVatK}</b><strong>${m('3 120.00 €')}</strong><small>${u.salesInvoices}</small></div>
  <div class="ui-kpi"><b>${u.inputVatK}</b><strong>${m('1 880.00 €')}</strong><small>${u.purchases}</small></div>
  <div class="ui-kpi"><b>${u.vatPayable}</b><strong class="ok">${m('1 240.00 €')}</strong><small>${u.period09}</small></div>
</div>`; };

const frSaft = (ctx) => { const u = ctx.T.ui, T = ctx.T; return `
<div class="ui flat">
  <div class="ui-h"><b>${u.saftExports}</b><span class="pill warn">${T.status.beta}</span></div>
  <table class="ui-table">
    <tr><th>${u.periodCol}</th><th>${u.status}</th><th class="r">${u.errors}</th><th class="r hide-sm">${u.warnings}</th><th></th></tr>
    <tr><td class="s">${u.sep}</td><td><span class="pill ok">${u.completed}</span></td><td class="r">0</td><td class="r hide-sm">3</td><td class="r"><span class="ui-btn">${u.dataset}</span></td></tr>
    <tr><td class="s">${u.aug}</td><td><span class="pill ok">${u.completed}</span></td><td class="r">0</td><td class="r hide-sm">1</td><td class="r"><span class="ui-btn">${u.dataset}</span></td></tr>
  </table>
</div>`; };

const citeIc = I.cite.replace('<svg', '<svg style="width:11px;height:11px"');
const frAssistant = (ctx) => { const u = ctx.T.ui; return `
<div class="ui">
  <div class="ui-h"><b>${I.spark.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px;margin-right:6px;color:var(--brand)"')}${u.aiTitle}</b><span>${u.readsOnly}</span></div>
  <div class="ui-chips"><span class="ui-chip on">${u.q1}</span><span class="ui-chip">${u.q2}</span><span class="ui-chip">${u.q3}</span></div>
  <div class="ui-qa">
    <div class="ui-q"><span>${u.q1}</span><span class="badges"><span class="conf ok">95%</span><span class="pill neu">${u.deterministic}</span></span></div>
    <div class="ui-a">${u.answer}</div>
    <div class="ui-src"><b>${u.sources}</b><span>${citeIc} ${u.src1}</span><span>${citeIc} ${u.src2}</span><span>${citeIc} ${u.src3}</span></div>
    <div class="ui-foot">${I.shield} ${u.foot}</div>
  </div>
</div>`; };

const frJournal = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui ui-je">
  <div class="ui-h"><b>${u.journal}</b><span>${u.appendOnly}</span></div>
  <div class="hd"><code>#417</code><span>${u.purchaseInvoice}</span><span class="pill ok">${u.posted}</span></div>
  <table class="ui-table">
    <tr><th>${u.account}</th><th>${u.description}</th><th class="r">${u.debit}</th><th class="r">${u.credit}</th></tr>
    <tr><td class="m">602</td><td>${u.externalServices}</td><td class="r">${m('190.00 €')}</td><td class="r">·</td></tr>
    <tr><td class="m">4531</td><td>${u.inputVat}</td><td class="r">${m('38.00 €')}</td><td class="r">·</td></tr>
    <tr><td class="m">401</td><td>${u.suppliersOf}</td><td class="r">·</td><td class="r">${m('228.00 €')}</td></tr>
    <tfoot><tr><td colspan="2">${u.balanced}</td><td class="r">${m('228.00 €')}</td><td class="r">${m('228.00 €')}</td></tr></tfoot>
  </table>
</div>`; };

const frDashboard = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `
<div class="ui lift" style="font-size:12px">
  ${bar(ctx, `<b>${u.dashboard}</b>`)}
  <div style="padding:16px;background:var(--bg-warm);display:flex;flex-direction:column;gap:12px">
    <div class="ui-kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <div class="ui-kpi"><b>${u.awaitingReview}</b><strong class="warn">4</strong><small>${u.needApproval}</small></div>
      <div class="ui-kpi"><b>${u.vatPayable}</b><strong>${m('1 240.00 €')}</strong><small>${u.period09}</small></div>
      <div class="ui-kpi"><b>${u.receivables}</b><strong>${m('14 320.00 €')}</strong><small>${u.overdue3}</small></div>
      <div class="ui-kpi"><b>${u.netResult}</b><strong class="ok">${m('18 420.50 €')}</strong><small>${u.fromLedger}</small></div>
    </div>
    <div class="ui flat">
      <div class="ui-h"><b>${u.recentDocs}</b><span>${u.all}</span></div>
      <table class="ui-table">
        <tr><th>${u.file}</th><th class="hide-sm">${u.supplier}</th><th>${u.status}</th><th class="r">${u.date}</th></tr>
        <tr><td class="s">f-1180-softprima.pdf</td><td class="hide-sm">${sup(ctx)}</td><td><span class="pill warn">${u.awaiting}</span></td><td class="r">03.10.2026</td></tr>
        <tr><td class="s">energo-88213.pdf</td><td class="hide-sm">Energo-Pro</td><td><span class="pill ok">${u.posted}</span></td><td class="r">02.10.2026</td></tr>
        <tr><td class="s">kurier-0917.jpg</td><td class="hide-sm">·</td><td><span class="pill info">${u.extracting}</span></td><td class="r">02.10.2026</td></tr>
      </table>
    </div>
  </div>
</div>`; };

const frUpload = (ctx) => { const u = ctx.T.ui; return `
<div class="ui">
  <div class="ui-h"><b>${u.uploadDocs}</b><span>${u.uploadMeta}</span></div>
  <div class="ui-drop"><span class="ui-drop-ic">${I.upload}</span><b>${u.drop}</b><span>${u.dropSub}</span></div>
  <table class="ui-table">
    <tr><th>${u.file}</th><th class="hide-sm">${u.size}</th><th>${u.status}</th><th class="r">${u.uploaded}</th></tr>
    <tr><td class="s">f-1180-softprima.pdf</td><td class="hide-sm">184 KB</td><td><span class="pill ok">${u.extractedFields}</span></td><td class="r">10:42</td></tr>
    <tr><td class="s">kurier-0917.jpg</td><td class="hide-sm">1.2 MB</td><td><span class="pill info">${u.extracting}</span></td><td class="r">10:41</td></tr>
    <tr><td class="s">invoice-2026-0031.xml</td><td class="hide-sm">9 KB</td><td><span class="pill ok">${u.parsedXml}</span></td><td class="r">10:39</td></tr>
  </table>
</div>`; };

const frAudit = (ctx) => { const u = ctx.T.ui; return `
<div class="ui">
  <div class="ui-h"><b>${u.auditTrail}</b><span class="conf ok">${u.chainVerified}</span></div>
  <ul class="ui-log">
    <li><i class="a-human"></i><div>${u.a1}</div><span>03.10 · 10:58</span></li>
    <li><i class="a-human"></i><div>${u.a2}</div><span>03.10 · 10:57</span></li>
    <li><i class="a-ai"></i><div>${u.a3}</div><span>03.10 · 10:44</span></li>
    <li><i class="a-auto"></i><div>${u.a4}</div><span>03.10 · 10:42</span></li>
    <li><i class="a-human"></i><div>${u.a5}</div><span>03.10 · 10:41</span></li>
  </ul>
</div>`; };

const frPeriods = (ctx) => { const u = ctx.T.ui; const who = ctx.L === 'bg' ? 'А. Димитрова' : 'A. Dimitrova'; return `
<div class="ui flat">
  <div class="ui-h"><b>${u.periods}</b><span>2026</span></div>
  <table class="ui-table">
    <tr><th>${u.periodCol}</th><th>${u.status}</th><th class="r hide-sm">${u.entries}</th><th class="r">${u.lockedBy}</th></tr>
    <tr><td class="s">${u.oct}</td><td><span class="pill info">${u.open}</span></td><td class="r hide-sm">14</td><td class="r">·</td></tr>
    <tr><td class="s">${u.sep}</td><td><span class="pill ok">${u.locked}</span></td><td class="r hide-sm">61</td><td class="r">${who}</td></tr>
    <tr><td class="s">${u.aug}</td><td><span class="pill ok">${u.locked}</span></td><td class="r hide-sm">57</td><td class="r">${who}</td></tr>
  </table>
</div>`; };

const frInvoices = (ctx) => { const u = ctx.T.ui, m = ctx.m; const c = ctx.L === 'bg' ? ['Делта Консулт ООД', 'Бета ЕООД', 'Гама АД'] : ['Delta Consult OOD', 'Beta EOOD', 'Gamma AD']; return `
<div class="ui"><div class="ui-h"><b>${u.invoices}</b><span class="ui-btn ink">${u.newDocument}</span></div><table class="ui-table"><tr><th>${u.number}</th><th>${u.customer}</th><th class="hide-sm">${u.date}</th><th class="hide-sm">${u.status}</th><th class="r">${u.amount}</th></tr>
<tr><td class="m">2026-0031</td><td class="s">${c[0]}</td><td class="hide-sm">28.09.2026</td><td class="hide-sm"><span class="pill ok">${u.issued}</span></td><td class="r">${m('1 800.00 €')}</td></tr>
<tr><td class="m">2026-0030</td><td class="s">${c[1]}</td><td class="hide-sm">22.09.2026</td><td class="hide-sm"><span class="pill ok">${u.issued}</span></td><td class="r">${m('360.00 €')}</td></tr>
<tr><td class="m">PF-0012</td><td class="s">${c[2]}</td><td class="hide-sm">20.09.2026</td><td class="hide-sm"><span class="pill neu">${u.proforma}</span></td><td class="r">${m('2 400.00 €')}</td></tr>
<tr><td class="m">CN-0003</td><td class="s">${c[1]}</td><td class="hide-sm">18.09.2026</td><td class="hide-sm"><span class="pill warn">${u.creditNote}</span></td><td class="r">${m('-120.00 €')}</td></tr></table></div>`; };

const frFieldsOne = (ctx) => { const u = ctx.T.ui, m = ctx.m; return `<div class="ui"><div class="ui-h"><b>${u.extracted}</b><span class="conf ok">94%</span></div><div class="ui-fields one"><div class="ui-group">${u.supplier}</div><div class="ui-field"><div><b>${u.name}</b><strong>${sup(ctx)}</strong></div><span class="conf ok">94%</span></div><div class="ui-field"><div><b>${u.uic}</b><strong>204117823</strong></div><span class="conf ok">${u.checked}</span></div><div class="ui-group">${u.amountsVat}</div><div class="ui-field flag"><div><b>${u.taxBase}</b><strong>${m('190.00 €')}</strong></div><span class="conf warn">71%</span></div><div class="ui-field"><div><b>${u.vat20}</b><strong>${m('38.00 €')}</strong></div><span class="conf ok">${u.checked}</span></div><div class="ui-field"><div><b>${u.total}</b><strong>${m('228.00 €')}</strong></div><span class="conf ok">${u.checked}</span></div></div></div>`; };

/* ============================================================================
   Home sections
   ============================================================================ */
const hero = (ctx) => { const T = ctx.T; return `
<section class="hero">
  <div class="wrap inner">
    <span class="eyebrow"><span>${T.hero.eyebrow}<span class="hide-m">${T.hero.eyebrowTail}</span></span></span>
    <h1 class="display">${T.hero.h1a} <span class="dim">${T.hero.h1b}</span></h1>
    <p class="lead">${T.hero.lead}<span class="hide-m">${T.hero.leadTail}</span></p>
    <div class="hero-cta">
      <a class="btn btn-ink btn-lg" href="/register">${T.cta.start} ${I.arrow}</a>
      <a class="btn btn-out btn-lg" href="#how">${T.cta.seeHow}</a>
    </div>
    <p class="hero-note">${T.hero.notes.map((n) => `<span>${n}</span>`).join('')}</p>
  </div>
  <div class="wrap-wide">
    <div class="scene" role="img" aria-label="${T.hero.sceneLabel}" data-reveal>
      <div class="sc-doc" aria-hidden="true">${frPaper(ctx, 'total')}</div>
      <div class="sc-main" aria-hidden="true">${frReviewMain(ctx)}</div>
      <div class="sc-sugg" aria-hidden="true">${frDecision(ctx, 'review')}</div>
      <div class="sc-ticket" aria-hidden="true">${frTicket(ctx)}</div>
    </div>
  </div>
</section>`; };

const facts = (ctx) => { const ic = [I.user, I.book, I.chain, I.vat]; return `
<section class="section-sm">
  <div class="wrap">
    <div class="facts">${ctx.T.facts.map(([b, d], i) => `<div>${ic[i]}<div><b>${b}</b><span>${d}</span></div></div>`).join('')}</div>
  </div>
</section>`; };

const MATRIX_LINKS = [['/features#capture', I.upload, 'upload'], ['/features#extraction', I.scan, 'extract'], ['/features#review', I.review, 'review'], ['/features#ledger', I.book, 'ledger'], ['/features#invoicing', I.invoice, 'invoices'], ['/features#banking', I.bank, 'banking'], ['/features#vat', I.vat, 'vat'], ['/features#reports', I.chart, 'reports'], ['/#ai-accountant', I.spark, 'assistant']];
const matrix = (ctx) => { const T = ctx.T; return `
<section class="section bg-warm hairline-top" id="product">
  <div class="wrap">
    <div class="split">
      <div class="sec-head"><span class="eyebrow">${T.matrix.eyebrow}</span><h2 class="h2">${T.matrix.h2}</h2></div>
      <p class="lead">${T.matrix.lead}</p>
    </div>
    <div class="matrix">
      ${T.matrix.items.map(([t, d], i) => `<a href="${href(ctx, MATRIX_LINKS[i][0])}"><span class="ic">${MATRIX_LINKS[i][1]}</span><h3>${t}</h3><p>${d}</p><span class="k">/${MATRIX_LINKS[i][2]}</span></a>`).join('')}
    </div>
  </div>
</section>`; };

const FLOW_KIND = ['auto', 'auto', 'human', 'auto', 'human', 'auto', 'ai'];
const flow = (ctx) => { const T = ctx.T; return `
<section class="section" id="how">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">${T.flow.eyebrow}</span><h2 class="h2">${T.flow.h2a} <span class="dim">${T.flow.h2b}</span></h2></div>
    <div class="flow">
      ${T.flow.steps.map(([t, d], i) => `<div class="flow-step ${FLOW_KIND[i]}" data-reveal><span class="dot"></span><span class="k">0${i + 1}</span><h3>${t}</h3><p>${d}</p><span class="who">${T.flow.who[FLOW_KIND[i]]}</span></div>`).join('')}
    </div>
    <div class="legend"><span><i class="l-auto"></i> ${T.flow.legend[0]}</span><span><i class="l-human"></i> ${T.flow.legend[1]}</span><span><i class="l-ai"></i> ${T.flow.legend[2]}</span></div>
  </div>
</section>`; };

const points = (items, icons) => `<ul class="points">${items.map(([b, d], i) => `<li>${icons[i]}<div><b>${b}</b><span>${d}</span></div></li>`).join('')}</ul>`;

const storyReview = (ctx) => { const T = ctx.T, u = T.ui, m = ctx.m; return `
<section class="section bg-warm hairline-top" id="review">
  <div class="wrap story wide">
    <div class="story-text">
      <span class="eyebrow">${T.review.eyebrow}</span>
      <h2 class="h2">${T.review.h2a} <span class="dim">${T.review.h2b}</span></h2>
      <p class="body">${T.review.body}</p>
      ${points(T.review.points, [I.check, I.eye, I.user])}
    </div>
    <div class="canvas" aria-hidden="true" data-reveal>
      <div class="rv-grid">
        <div class="ui">
          <div class="ui-h"><b>${u.extracted}</b><span class="conf ok">94%</span></div>
          <div class="ui-fields one">
            <div class="ui-field"><div><b>${u.supplier}</b><strong>${sup(ctx)}</strong></div><span class="conf ok">94%</span></div>
            <div class="ui-field"><div><b>${u.uic}</b><strong>204117823</strong></div><span class="conf ok">${u.checked}</span></div>
            <div class="ui-field flag"><div><b>${u.taxBase}</b><strong>${m('190.00 €')}</strong></div><span class="conf warn">71%</span></div>
            <div class="ui-field"><div><b>${u.vat20}</b><strong>${m('38.00 €')}</strong></div><span class="conf ok">${u.checked}</span></div>
            <div class="ui-field"><div><b>${u.total}</b><strong>${m('228.00 €')}</strong></div><span class="conf ok">${u.checked}</span></div>
            <div class="ui-field bad"><div><b>IBAN</b><strong>BG80 BNBG 9661 1020 3456 7</strong></div><span class="conf err">${u.invalid}</span></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">${frDecision(ctx, 'review')}${frSuggestion(ctx)}</div>
      </div>
      <span class="callout" style="left:22px;bottom:22px"><i></i> ${T.review.callout}</span>
    </div>
  </div>
</section>`; };

const statement = (ctx) => { const T = ctx.T; const k = ['i-auto', 'i-human', 'i-ai']; return `
<section class="section bg-ink on-ink">
  <div class="wrap">
    <div class="sec-head" style="max-width:820px"><span class="eyebrow">${T.statement.eyebrow}</span><h2 class="h2">${T.statement.h2a} <span class="dim">${T.statement.h2b}</span></h2></div>
    <div class="defs">
      ${T.statement.defs.map(([tag, h, p, exl, ex], i) => `<div data-reveal><span class="tag-k"><i class="${k[i]}"></i> ${tag}</span><h3>${h}</h3><p>${p}</p><p class="ex">${exl} <b>${ex}</b></p></div>`).join('')}
    </div>
  </div>
</section>`; };

const storyMoney = (ctx) => { const T = ctx.T; const ic = [I.invoice, I.clock, I.bank]; return `
<section class="section" id="position">
  <div class="wrap">
    <div class="split">
      <div class="sec-head"><span class="eyebrow">${T.money.eyebrow}</span><h2 class="h2">${T.money.h2a} <span class="dim">${T.money.h2b}</span></h2></div>
      <p class="lead">${T.money.lead}</p>
    </div>
    <div class="canvas" aria-hidden="true" data-reveal>
      <div class="collage">
        <div class="c1">${frAR(ctx)}</div>
        <div class="c2">${frAging(ctx)}</div>
        <div class="c3">${frBankMatch(ctx)}</div>
      </div>
    </div>
    <div class="grid-h three" style="margin-top:40px">
      ${T.money.notes.map(([b, p], i) => `<div>${ic[i]}<b>${b}</b><p>${p}</p></div>`).join('')}
    </div>
  </div>
</section>`; };

const storyTax = (ctx) => { const T = ctx.T; const pts = T.tax.points.map(([b, d], i) => (i === 2 ? [`${b} <span class="tag beta">${T.status.beta.toLowerCase()}</span>`, d] : [b, d])); return `
<section class="section bg-warm hairline-top" id="vat">
  <div class="wrap story flip">
    <div class="story-text">
      <span class="eyebrow">${T.tax.eyebrow}</span>
      <h2 class="h2">${T.tax.h2a} <span class="dim">${T.tax.h2b}</span></h2>
      <p class="body">${T.tax.body}</p>
      ${points(pts, [I.vat, I.chart, I.xml])}
    </div>
    <div class="canvas tint" aria-hidden="true" data-reveal>
      <div style="display:flex;flex-direction:column;gap:14px">${frVatKpis(ctx)}${frTB(ctx)}</div>
    </div>
  </div>
</section>`; };

const ai = (ctx) => { const T = ctx.T; return `
<section class="section bg-tint hairline-top" id="ai-accountant">
  <div class="wrap">
    <div class="split">
      <div class="sec-head"><span class="eyebrow">${T.ai.eyebrow}</span><h2 class="h2">${T.ai.h2a} <span class="dim">${T.ai.h2b}</span></h2></div>
      <p class="lead">${T.ai.lead}</p>
    </div>
    <div class="story" style="align-items:start;grid-template-columns:minmax(0,5fr) minmax(0,7fr)">
      <div class="story-text">
        <ul class="points" style="border-top:0;margin-top:0">${T.ai.points.map(([b, d], i) => `<li>${[I.cite, I.book, I.ban][i]}<div><b>${b}</b><span>${d}</span></div></li>`).join('')}</ul>
      </div>
      <div data-reveal aria-hidden="true">${frAssistant(ctx)}</div>
    </div>
  </div>
</section>`; };

const control = (ctx) => { const T = ctx.T; const ic = [I.shield, I.user, I.book, I.cal, I.layers]; return `
<section class="section" id="control">
  <div class="wrap">
    <div class="sec-head"><span class="eyebrow">${T.control.eyebrow}</span><h2 class="h2">${T.control.h2a} <span class="dim">${T.control.h2b}</span></h2></div>
    <div class="grid-h">
      ${T.control.items.map(([b, p], i) => `<div data-reveal>${ic[i]}<b>${b}</b><p>${p}</p></div>`).join('')}
    </div>
  </div>
</section>`; };

const status = (ctx) => { const S = ctx.T.status; return `
<section class="section-sm bg-warm hairline-top" id="status">
  <div class="wrap">
    <div class="split"><div class="sec-head"><span class="eyebrow">${S.eyebrow}</span><h2 class="h2 h2-sm">${S.h2}</h2></div><p class="lead">${S.lead}</p></div>
    <div class="status-cols">
      <div><h3>${S.available}</h3><ul class="status-list">${S.availableItems.map(([t, d, k]) => `<li><div><b>${t}</b>${d ? `<span class="d">${d}</span>` : ''}</div><span class="tag ${k === 'beta' ? 'beta' : 'live'}">${k === 'beta' ? S.beta : S.live}</span></li>`).join('')}</ul></div>
      <div><h3>${S.planned}</h3><ul class="status-list">${S.plannedItems.map(([t, d]) => `<li><div><b>${t}</b><span class="d">${d}</span></div><span class="tag planned">${S.plannedTag}</span></li>`).join('')}</ul></div>
    </div>
  </div>
</section>`; };

const faqList = (groups, openFirst = true, tag = 'h3') => groups.map((g, gi) => `<div class="faq-group"${tag === 'h2' ? ` id="faq-${gi}"` : ''}><${tag} class="faq-h">${g[0]}</${tag}><div class="faq">${g[1].map(([q, a], i) => `<details${openFirst && gi === 0 && i === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div>`).join('');
const faqHome = (ctx) => { const T = ctx.T; return `
<section class="section">
  <div class="wrap-narrow">
    <div class="sec-head"><span class="eyebrow">${T.faq.eyebrow}</span><h2 class="h2">${T.faq.h2}</h2></div>
    ${faqList([T.faq.groups[1], T.faq.groups[2]])}
    <p class="small" style="margin-top:22px"><a class="link" href="${href(ctx, '/faq')}">${T.cta.allQuestions} ${I.arrow}</a></p>
  </div>
</section>`; };

const cta = (ctx, h, p) => { const T = ctx.T; h = h || T.ctaBand.h; p = p || T.ctaBand.p; return `
<section class="section bg-ink on-ink">
  <div class="wrap cta">
    <div class="sec-head" style="margin-bottom:0"><h2 class="h2">${h}</h2><p class="lead">${p}</p><div class="cta-actions" style="margin-top:8px"><a class="btn btn-ink btn-lg" href="/register">${T.cta.start} ${I.arrow}</a><a class="btn btn-out btn-lg" href="${href(ctx, '/features')}">${T.cta.seeProduct}</a></div></div>
    <div class="cta-side"><p>${T.ctaBand.side[0]}</p><p>${T.ctaBand.side[1]}</p><p><a class="link" style="color:var(--on-ink)" href="${href(ctx, '/pricing')}">${T.cta.howAccess} ${I.arrow}</a></p></div>
  </div>
</section>`; };

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

const CH_IDS = ['capture', 'extraction', 'review', 'ledger', 'invoicing', 'banking', 'vat', 'reports', 'assistant'];
const CH_BG = ['white', 'white', 'white', 'warm', 'warm', 'warm', 'tint', 'tint', 'tint'];
const chapterFrag = (ctx, i) => {
  const T = ctx.T;
  switch (i) {
    case 0: return `<div class="canvas" aria-hidden="true">${frUpload(ctx)}</div>`;
    case 1: return `<div class="canvas" aria-hidden="true"><div class="rv-grid">${frFieldsOne(ctx)}<div>${frPaper(ctx, 'net')}</div></div><span class="callout" style="left:22px;bottom:22px"><i></i> ${T.product.extractionCallout}</span></div>`;
    case 2: return `<div class="canvas" aria-hidden="true"><div class="two">${frDecision(ctx, 'review')}${frSuggestion(ctx)}</div></div>`;
    case 3: return `<div class="canvas" aria-hidden="true"><div class="stack">${frJournal(ctx)}${frPeriods(ctx)}</div></div>`;
    case 4: return `<div class="canvas" aria-hidden="true">${frInvoices(ctx)}</div>`;
    case 5: return `<div class="canvas" aria-hidden="true"><div class="stack">${frBankMatch(ctx)}<div class="two">${frAR(ctx)}${frAP(ctx)}</div></div></div>`;
    case 6: return `<div class="canvas tint" aria-hidden="true"><div class="stack">${frVatKpis(ctx)}${frSaft(ctx)}</div></div>`;
    case 7: return `<div class="canvas tint" aria-hidden="true">${frTB(ctx)}</div>`;
    default: return `<div class="canvas tint" aria-hidden="true">${frAssistant(ctx)}</div>`;
  }
};
const bgStrip = (ctx) => { const B = ctx.T.product.bg; const ic = [I.checkc, I.vat, I.book, I.invoice, I.xml, I.scan]; return `
<section class="section bg-ink on-ink" id="bulgaria">
  <div class="wrap">
    <div class="split"><div class="sec-head"><span class="eyebrow">${B.eyebrow}</span><h2 class="h2">${B.h2a} <span class="dim">${B.h2b}</span></h2></div><p class="lead">${B.lead}</p></div>
    <div class="grid-h three rows2">${B.points.map(([t, d], i) => `<div>${ic[i]}<b>${t}</b><p>${d}</p></div>`).join('')}</div>
  </div>
</section>`; };

const featuresBody = (ctx) => { const T = ctx.T, P = T.product; return `
${pageHero(P.eyebrow, `${P.h1a} <span class="dim">${P.h1b}</span>`, P.lead, `<a class="btn btn-ink" href="/register">${T.cta.start} ${I.arrow}</a><a class="btn btn-out" href="${href(ctx, '/#how')}">${T.nav.how}</a>`,
  `<ol class="chapters">${P.chapters.map(([t], i) => `<li><a href="#${CH_IDS[i]}"><span class="k">0${i + 1}</span>${t}</a></li>`).join('')}</ol>`)}
<section class="section-sm"><div class="wrap" aria-hidden="true">${frDashboard(ctx)}</div></section>
${['white', 'warm', 'tint'].map((bg) => `<section class="section-sm${bg === 'warm' ? ' bg-warm hairline-top' : bg === 'tint' ? ' bg-tint hairline-top' : ''}"><div class="wrap">${P.chapters.map((c, i) => [c, i]).filter(([, i]) => CH_BG[i] === bg).map(([[t, sub, items], i]) => `<div class="frow" id="${CH_IDS[i]}"><div class="frow-text"><span class="k">0${i + 1} · ${t}</span><h2>${sub}</h2><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></div><div data-reveal>${chapterFrag(ctx, i)}</div></div>`).join('')}</div></section>`).join('')}
${bgStrip(ctx)}
${status(ctx)}
${cta(ctx, T.ctaBand.productH, T.ctaBand.productP)}`; };

const pricingBody = (ctx) => { const T = ctx.T, P = T.pricing; const ic = [I.layers, I.user, I.cal]; return `
${pageHero(P.eyebrow, `${P.h1a} <span class="dim">${P.h1b}</span>`, P.lead, `<a class="btn btn-ink" href="/register">${T.cta.createAccount} ${I.arrow}</a><a class="btn btn-out" href="${href(ctx, '/features')}">${T.cta.seeProduct}</a>`)}
<section class="section-sm"><div class="wrap">
  <div class="access" data-reveal>
    <div>
      <span class="eyebrow">${P.accessEyebrow}</span>
      <h2>${P.accessH2}</h2>
      <p class="price">${P.price} <small>${P.priceSmall}</small></p>
      <ul class="checks">${P.checks.map((c) => `<li>${I.check}<span>${c}</span></li>`).join('')}</ul>
    </div>
    <div>
      <span class="eyebrow">${P.howEyebrow}</span>
      <ol class="steps-v">${P.steps.map(([b, d], i) => `<li><span class="n">${i + 1}</span><div><b>${b}</b><span>${d}</span></div></li>`).join('')}</ol>
    </div>
  </div>
</div></section>
<section class="section-sm bg-warm hairline-top"><div class="wrap">
  <div class="split"><div class="sec-head"><span class="eyebrow">${P.meansEyebrow}</span><h2 class="h2 h2-sm">${P.meansH2}</h2></div></div>
  <div class="grid-h three">${P.means.map(([b, p], i) => `<div>${ic[i]}<b>${b}</b><p>${p}</p></div>`).join('')}</div>
</div></section>
<section class="section-sm"><div class="wrap">
  <div class="split last"><div class="sec-head"><span class="eyebrow">${P.whoEyebrow}</span><h2 class="h2 h2-sm">${P.whoH2}</h2></div><p class="lead">${P.whoLead}</p></div>
</div></section>
<section class="section-sm"><div class="wrap-narrow">${faqList([T.faq.groups[3], T.faq.groups[1]], false)}</div></section>
${cta(ctx, T.ctaBand.pricingH, T.ctaBand.pricingP)}`; };

const aboutBody = (ctx) => { const T = ctx.T, A = T.about; const k = ['i-auto', 'i-human', 'i-ai']; const ic = [I.scan, I.spark, I.bank]; return `
${pageHero(A.eyebrow, A.h1, A.lead)}
<section class="section-sm"><div class="wrap story">
  <div class="story-text">
    <p class="prose-lg">${A.proseLg}</p>
    <p class="body">${A.body}</p>
  </div>
  <div class="canvas" aria-hidden="true" data-reveal>${frAudit(ctx)}</div>
</div></section>
<section class="section bg-ink on-ink"><div class="wrap">
  <h2 class="statement">${A.statementA} <span class="dim">${A.statementB}</span></h2>
  <div class="defs">${A.defs.map(([tag, h, p], i) => `<div><span class="tag-k"><i class="${k[i]}"></i> ${tag}</span><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
</div></section>
<section class="section-sm"><div class="wrap">
  <div class="split"><div class="sec-head"><span class="eyebrow">${A.removesEyebrow}</span><h2 class="h2 h2-sm">${A.removesH2}</h2></div><p class="lead">${A.removesLead}</p></div>
  <div class="grid-h three">${A.removes.map(([b, p], i) => `<div>${ic[i]}<b>${b}</b><p>${p}</p></div>`).join('')}</div>
</div></section>
<section class="section-sm bg-warm hairline-top"><div class="wrap-narrow">
  <div class="sec-head"><span class="eyebrow">${A.missingEyebrow}</span><h2 class="h2 h2-sm">${A.missingH2}</h2></div>
  <ul class="status-list">${A.missing.map(([b, d]) => `<li><div><b>${b}</b><span class="d">${d}</span></div><span class="tag planned">${A.byDesign}</span></li>`).join('')}</ul>
</div></section>
${cta(ctx)}`; };

const faqBody = (ctx) => { const T = ctx.T; return `
${pageHero(T.faq.eyebrow, T.faq.pageH1, T.faq.pageLead)}
<section class="section-sm"><div class="wrap faq-layout">
  <nav class="faq-nav" aria-label="${T.faq.navLabel}">${T.faq.groups.map((g, i) => `<a href="#faq-${i}">${g[0]}<span>${g[1].length}</span></a>`).join('')}<a class="faq-nav-contact" href="${href(ctx, '/contact')}">${T.nav.contact} ${I.arrow}</a></nav>
  <div>${faqList(T.faq.groups, true, 'h2')}</div>
</div></section>
${cta(ctx)}`; };

const contactBody = (ctx) => { const T = ctx.T, C = T.contact; const paths = [['/register', I.user], ['/login', I.lock], [href(ctx, '/features'), I.layers], [href(ctx, '/faq'), I.cite]]; return `
${pageHero(C.eyebrow, `${C.h1a} <span class="dim">${C.h1b}</span>`, C.lead)}
<section class="section-sm"><div class="wrap contact">
  <aside class="contact-side">
    <div><b>${C.status[0]}</b><span>${C.status[1]}</span></div>
    <div><b>${C.who[0]}</b><span>${C.who[1]}</span></div>
    <div><b>${C.legal[0]}</b><span>${C.legal[1]}</span></div>
  </aside>
  <div class="contact-paths">
    ${C.paths.map(([b, d], i) => `<a class="path" href="${paths[i][0]}">${paths[i][1]}<div><b>${b}</b><span>${d}</span></div>${I.arrow}</a>`).join('')}
  </div>
</div></section>`; };

/* ---- pages ---------------------------------------------------------------- */
const KEYS = [['/', 'index.html', 'home'], ['/features', 'features.html', 'features'], ['/pricing', 'pricing.html', 'pricing'], ['/about', 'about.html', 'about'], ['/faq', 'faq.html', 'faq'], ['/contact', 'contact.html', 'contact']];
const BODIES = { home: (ctx) => hero(ctx) + facts(ctx) + matrix(ctx) + flow(ctx) + storyReview(ctx) + statement(ctx) + storyMoney(ctx) + storyTax(ctx) + ai(ctx) + control(ctx) + status(ctx) + faqHome(ctx) + cta(ctx), features: featuresBody, pricing: pricingBody, about: aboutBody, faq: faqBody, contact: contactBody };

const allUrls = [];
for (const L of ['bg', 'en']) {
  const ctx = mk(L); const T = ctx.T;
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: SITE, logo: `${SITE}/landing/assets/icons/icon-512.png` };
  for (const [key, file, id] of KEYS) {
    const url = urlFor(L, key); const alt = { bg: urlFor('bg', key), en: urlFor('en', key) };
    const [title, desc] = T.meta[id];
    const jsonld = id === 'home'
      ? { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: BRAND, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: SITE + url, inLanguage: L, description: T.meta.appDesc }
      : org;
    const html = head(ctx, { title, desc, url, alt, jsonld }) + nav(ctx, key) + BODIES[id](ctx) + footer(ctx);
    writeFileSync(join(OUT, L === 'bg' ? '' : 'en', file), html, 'utf8');
    allUrls.push({ url, alt });
  }
}
writeFileSync(join(PUB, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${allUrls.map(({ url, alt }) => `  <url><loc>${SITE}${url}</loc><xhtml:link rel="alternate" hreflang="bg" href="${SITE}${alt.bg}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}${alt.en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${alt.bg}"/></url>`).join('\n')}\n</urlset>\n`, 'utf8');
writeFileSync(join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /login\nDisallow: /register\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');
console.log(`built ${allUrls.length} pages (bg + en) → ${OUT}`);
