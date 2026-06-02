import type { ActiveRule, AccountSuggestion, CounterpartyRef, SupplierMatch, VatSuggestion } from './models';

const round = (n: number): number => Math.round(n * 1000) / 1000;
const norm = (s?: string): string => (s ?? '').toLowerCase().replace(/\b(ood|eood|ad|ооד|еоод|ад|ltd|gmbh)\b/g, '').replace(/[^a-z0-9\u0400-\u04ff]/gi, '').trim();

/** Supplier matching: EIK exact > VAT exact > normalized-name equality > none. Deterministic. */
export function matchSupplier(extracted: { eik?: string; vat?: string; name?: string }, counterparties: CounterpartyRef[]): SupplierMatch {
  for (const c of counterparties) if (extracted.eik && c.eik && extracted.eik === c.eik) return { counterparty: c, confidence: 0.98, basis: 'eik' };
  for (const c of counterparties) if (extracted.vat && c.vatNumber && extracted.vat === c.vatNumber) return { counterparty: c, confidence: 0.95, basis: 'vat' };
  for (const c of counterparties) if (extracted.name && norm(extracted.name) && norm(extracted.name) === norm(c.name)) return { counterparty: c, confidence: 0.72, basis: 'name' };
  return { counterparty: null, confidence: 0, basis: 'none' };
}

/** Account suggestion: explicit active rule > supplier history > default. */
export function suggestAccount(args: {
  match: SupplierMatch; rules: ActiveRule[]; history?: { accountCode: string; count: number }; defaultAccountCode: string;
}): AccountSuggestion {
  if (args.match.counterparty) {
    const rule = args.rules.find((r) => r.ruleType === 'supplier_account' && r.matchKey === args.match.counterparty!.eik && r.isActive && r.action.accountCode);
    if (rule) return { accountCode: rule.action.accountCode!, confidence: round(Math.min(0.95, rule.action.confidence ?? 0.9)), explanation: `Rule "${rule.name}" maps this supplier to ${rule.action.accountCode}.` };
    if (args.history && args.history.count > 0) return { accountCode: args.history.accountCode, confidence: round(Math.min(0.95, 0.7 + Math.min(args.history.count, 20) / 100)), explanation: `Previous ${args.history.count} invoices from this supplier posted to account ${args.history.accountCode}.` };
  }
  return { accountCode: args.defaultAccountCode, confidence: 0.5, explanation: `No supplier history; defaulted to ${args.defaultAccountCode}.` };
}

/** VAT suggestion from company registration + supplier country + extracted rate. */
export function suggestVat(args: {
  companyVatRegistered: boolean; supplierCountry: string; supplierIsEu: boolean; net?: string; vat?: string;
  vatCodes: { id: string; code: string; kind: string }[];
}): VatSuggestion {
  if (!args.companyVatRegistered) return { treatment: 'none', rate: 0, codeId: null, confidence: 0.8, explanation: 'Company is not VAT-registered; no input VAT.' };
  const rate = args.net && Number(args.net) > 0 ? Math.round((Number(args.vat) / Number(args.net)) * 100) : 0;
  let treatment: VatSuggestion['treatment']; let conf = 0.85; let explanation: string;
  if (args.supplierCountry === 'BG') { treatment = rate >= 20 ? 'standard' : rate >= 9 ? 'reduced' : 'zero'; explanation = `BG supplier, ${rate}% → ${treatment}.`; conf = 0.9; }
  else if (args.supplierIsEu) { treatment = 'intra_community'; explanation = 'EU supplier → intra-community / reverse charge.'; conf = 0.85; }
  else { treatment = 'import'; explanation = 'Non-EU supplier → import VAT.'; conf = 0.8; }
  const code = args.vatCodes.find((v) => v.kind === treatment) ?? null;
  return { treatment, rate, codeId: code ? code.id : null, confidence: round(code ? conf : Math.min(conf, 0.6)), explanation: explanation + (code ? ` Matched code ${code.code}.` : ' No matching VAT code configured.') };
}

export function aggregateConfidence(p: { extractionOverall: number; matchConfidence: number; accountConfidence: number; vatConfidence: number }): number {
  const total = p.extractionOverall * 0.3 + p.matchConfidence * 0.25 + p.accountConfidence * 0.3 + p.vatConfidence * 0.15;
  return round(total);
}
