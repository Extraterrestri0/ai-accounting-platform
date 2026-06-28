import type { RuleCard } from './models';

/**
 * Curated Bulgarian VAT rule cards (ADR-001 §6). Versioned + effective-dated; the
 * deductibility evaluator and templates cite these — the model NEVER recalls law from
 * weights. `reviewedBy: null` = pending accountant sign-off → every citation of the card
 * carries `reviewPending: true` and the UI shows a badge. Reviewing all cards is a
 * beta-exit checklist item. Informative only — not tax advice (disclaimer in UI).
 */
export const RULE_CARDS: RuleCard[] = [
  {
    id: 'vat.right_to_deduct', version: '1.0',
    title: 'Право на приспадане на данъчен кредит',
    summary: 'Регистрирано лице има право да приспадне ДДС за получени стоки/услуги, когато ги използва за облагаеми доставки и разполага с данъчен документ по чл. 71.',
    legalReference: 'чл. 69 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { vatTreatments: ['standard', 'reduced'] },
  },
  {
    id: 'vat.car_no_deduct', version: '1.0',
    title: 'Без данъчен кредит — лек автомобил',
    summary: 'Не е налице право на данъчен кредит за придобит/нает лек автомобил и за стоките/услугите за неговата поддръжка и експлоатация (с изключенията по чл. 70, ал. 2 — напр. таксиметрови, отдаване под наем, препродажба).',
    legalReference: 'чл. 70, ал. 1, т. 4–5 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { expenseCategories: ['VEHICLE', 'CAR'], keywords: ['лек автомобил', 'лекия автомобил'] },
  },
  {
    id: 'vat.representation_no_deduct', version: '1.0',
    title: 'Без данъчен кредит — представителни разходи',
    summary: 'Не е налице право на данъчен кредит за стоки/услуги, предназначени за представителни или развлекателни цели.',
    legalReference: 'чл. 70, ал. 1, т. 3 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { expenseCategories: ['REPRESENTATION', 'ENTERTAINMENT'], keywords: ['представителни'] },
  },
  {
    id: 'vat.personal_use_no_deduct', version: '1.0',
    title: 'Без данъчен кредит — лични нужди',
    summary: 'Не е налице право на данъчен кредит за стоки/услуги за безвъзмездни доставки или за дейности, различни от икономическата дейност на лицето.',
    legalReference: 'чл. 70, ал. 1, т. 2 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { expenseCategories: ['PERSONAL'], keywords: ['лични нужди'] },
  },
  {
    id: 'vat.standard_rate', version: '1.0',
    title: 'Стандартна ставка 20%',
    summary: 'Стандартната ставка на ДДС е 20 на сто и се прилага за облагаемите доставки, освен изрично посочените с друга ставка.',
    legalReference: 'чл. 66 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { vatTreatments: ['standard'] },
  },
  {
    id: 'vat.reduced_rate_9', version: '1.0',
    title: 'Намалена ставка 9%',
    summary: 'Намалена ставка 9% се прилага за изрично изброени доставки (напр. настаняване в хотели).',
    legalReference: 'чл. 66а ЗДДС',
    effectiveFrom: '2011-04-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { vatTreatments: ['reduced'] },
  },
  {
    id: 'vat.reverse_charge', version: '1.0',
    title: 'Обратно начисляване',
    summary: 'При обратно начисляване данъкът е изискуем от получателя; доставчикът не начислява ДДС, а получателят си самоначислява (и при право на кредит — приспада).',
    legalReference: 'чл. 82, ал. 2 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { vatTreatments: ['reverse_charge'] },
  },
  {
    id: 'vat.intra_community', version: '1.0',
    title: 'Вътреобщностна доставка / придобиване',
    summary: 'ВОД към регистрирано в друга държава членка лице е облагаема с нулева ставка; ВОП подлежи на самоначисляване от получателя.',
    legalReference: 'чл. 7 и чл. 84 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { vatTreatments: ['intra_community'] },
  },
  {
    id: 'vat.exempt_supplies', version: '1.0',
    title: 'Освободени доставки',
    summary: 'За освободени доставки (глава четвърта ЗДДС) не се начислява ДДС и не е налице право на данъчен кредит за свързаните покупки.',
    legalReference: 'чл. 38–50 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { vatTreatments: ['exempt'] },
  },
  {
    id: 'vat.invoice_requirements', version: '1.0',
    title: 'Изисквания към фактурата',
    summary: 'Фактурата трябва да съдържа задължителните реквизити (номер, дата, идентификация на доставчик/получател, основа, ставка, данък); без редовен документ правото на кредит е застрашено.',
    legalReference: 'чл. 113–114 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: { keywords: ['реквизити'] },
  },
  {
    id: 'vat.deduct_deadline', version: '1.0',
    title: 'Срок за упражняване на правото на кредит',
    summary: 'Правото на приспадане се упражнява в периода на възникване или в един от следващите 12 данъчни периода.',
    legalReference: 'чл. 72 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: {},
  },
  {
    id: 'vat.filing_deadline', version: '1.0',
    title: 'Срок за подаване на справка-декларацията',
    summary: 'Справка-декларацията и дневниците се подават до 14-о число на месеца, следващ данъчния период.',
    legalReference: 'чл. 125, ал. 5 ЗДДС',
    effectiveFrom: '2007-01-01', effectiveTo: null, reviewedBy: null, reviewedAt: null,
    matchers: {},
  },
];

/** Cards effective as-of a date (never "today" implicitly — caller passes the document/period date). */
export function resolveCards(asOfISO: string): RuleCard[] {
  return RULE_CARDS.filter((c) => c.effectiveFrom <= asOfISO && (c.effectiveTo === null || asOfISO <= c.effectiveTo));
}

export function cardById(id: string): RuleCard | undefined {
  return RULE_CARDS.find((c) => c.id === id);
}
