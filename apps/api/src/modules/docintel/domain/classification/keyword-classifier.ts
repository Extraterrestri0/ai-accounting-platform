/**
 * Deterministic keyword/brand classifier for purchase expenses (Task 1.2).
 * Pure + testable. Returns the matched expense-category CODE with a confidence and
 * a human reason, or null when nothing matches (caller then falls back to 'Other').
 * Brand matches outrank generic keyword matches. Bulgarian + English.
 */
export interface KeywordHit { code: string; confidence: number; reason: string; }

interface Rule { code: string; brands: string[]; keywords: string[]; }

// Order matters: more specific categories first (a SaaS invoice mentioning "услуга" should still be SaaS).
const RULES: Rule[] = [
  { code: 'TELECOM', brands: ['a1', 'vivacom', 'yettel', 'telenor', 'mtel', 'mobiltel', 'bulsatcom'], keywords: ['mobile', 'мобил', 'интернет', 'internet', 'telecom', 'телеком', 'роуминг', 'sim карта'] },
  { code: 'FUEL', brands: ['shell', 'omv', 'lukoil', 'лукойл', 'eko', ' еко ', 'petrol', 'петрол', 'gazprom', 'rompetrol'], keywords: ['fuel', 'бензин', 'дизел', 'гориво', 'diesel'] },
  { code: 'ADVERTISING', brands: ['facebook', 'meta platforms', 'google ads', 'instagram', 'tiktok ads', 'linkedin ads'], keywords: ['реклама', 'advertising', ' ads ', 'кампания', 'campaign', 'маркетинг', 'marketing'] },
  { code: 'SAAS', brands: ['microsoft', 'google workspace', 'adobe', 'github', 'atlassian', 'slack', 'notion', 'amazon web services', 'aws', 'azure', 'dropbox', 'zoom', 'figma', 'openai'], keywords: ['saas', 'software', 'софтуер', 'subscription', 'абонамент', 'license', 'лиценз', 'cloud', 'облак'] },
  { code: 'RENT', brands: [], keywords: ['наем', ' rent', 'lease', 'аренда', 'под наем'] },
  { code: 'BANKFEES', brands: [], keywords: ['bank fee', 'такса банка', 'банкова такса', 'bank charge', 'такса превод', 'обслужване на сметка'] },
  { code: 'OFFICE', brands: ['office 1', 'office1'], keywords: ['office supplies', 'канцеларск', 'хартия', 'тонер', 'toner', 'консумативи'] },
  { code: 'TRAVEL', brands: ['wizz air', 'ryanair', 'bulgaria air', 'booking.com', 'airbnb'], keywords: ['travel', 'hotel', 'flight', 'командировк', 'хотел', 'самолетен билет', 'нощувк'] },
  { code: 'EXTSERV', brands: [], keywords: ['консулт', 'consulting', 'счетоводн', 'юридическ', 'legal', 'audit', 'одит'] },
];

export function classifyByKeywords(text: string): KeywordHit | null {
  const t = ` ${(text ?? '').toLowerCase()} `;
  if (t.trim().length === 0) return null;
  for (const r of RULES) {
    const brand = r.brands.find((b) => t.includes(b));
    if (brand) return { code: r.code, confidence: 0.95, reason: `Текстът съдържа „${brand.trim()}“ → ${r.code}.` };
  }
  for (const r of RULES) {
    const kw = r.keywords.find((k) => t.includes(k));
    if (kw) return { code: r.code, confidence: 0.82, reason: `Ключова дума „${kw.trim()}“ → ${r.code}.` };
  }
  return null;
}
