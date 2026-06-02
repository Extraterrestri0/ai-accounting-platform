import { matchSupplier, suggestAccount, suggestVat, aggregateConfidence } from '../../src/modules/docintel/domain/rules/rules-engine';
import type { ActiveRule, CounterpartyRef } from '../../src/modules/docintel/domain/rules/models';

const cps: CounterpartyRef[] = [{ id: 'cp1', name: 'Acme OOD', eik: '111111113', vatNumber: 'BG111111113', countryCode: 'BG' }];

describe('supplier matching', () => {
  it('EIK exact > VAT > name > none', () => {
    expect(matchSupplier({ eik: '111111113' }, cps)).toMatchObject({ basis: 'eik', confidence: 0.98 });
    expect(matchSupplier({ vat: 'BG111111113' }, cps)).toMatchObject({ basis: 'vat' });
    expect(matchSupplier({ name: 'ACME ood' }, cps).basis).toBe('name');
    expect(matchSupplier({ eik: '999999999' }, cps).counterparty).toBeNull();
  });
});

describe('account suggestion', () => {
  const match = matchSupplier({ eik: '111111113' }, cps);
  it('uses an explicit active rule', () => {
    const rules: ActiveRule[] = [{ ruleType: 'supplier_account', matchKey: '111111113', isActive: true, name: 'Acme->602', action: { accountCode: '602', confidence: 0.9 } }];
    expect(suggestAccount({ match, rules, defaultAccountCode: '609' }).accountCode).toBe('602');
  });
  it('falls back to supplier history (example: 18 invoices → 602 @0.88)', () => {
    const r = suggestAccount({ match, rules: [], history: { accountCode: '602', count: 18 }, defaultAccountCode: '609' });
    expect(r.accountCode).toBe('602');
    expect(r.confidence).toBe(0.88);
    expect(r.explanation).toMatch(/Previous 18 invoices/);
  });
  it('defaults when no match/history', () => {
    expect(suggestAccount({ match: { counterparty: null, confidence: 0, basis: 'none' }, rules: [], defaultAccountCode: '602' }).confidence).toBe(0.5);
  });
});

describe('VAT suggestion', () => {
  const vatCodes = [{ id: 'v1', code: 'STD20', kind: 'standard' }, { id: 'v2', code: 'IC', kind: 'intra_community' }];
  it('BG standard 20% → standard/STD20', () => {
    const v = suggestVat({ companyVatRegistered: true, supplierCountry: 'BG', supplierIsEu: true, net: '200', vat: '40', vatCodes });
    expect(v).toMatchObject({ treatment: 'standard', rate: 20, codeId: 'v1' });
  });
  it('EU foreign supplier → intra_community', () => {
    expect(suggestVat({ companyVatRegistered: true, supplierCountry: 'DE', supplierIsEu: true, net: '100', vat: '0', vatCodes }).treatment).toBe('intra_community');
  });
  it('not VAT-registered → none', () => {
    expect(suggestVat({ companyVatRegistered: false, supplierCountry: 'BG', supplierIsEu: true, net: '200', vat: '40', vatCodes }).treatment).toBe('none');
  });
});

describe('confidence aggregation', () => {
  it('combines signals into (0,1]', () => {
    const c = aggregateConfidence({ extractionOverall: 0.87, matchConfidence: 0.98, accountConfidence: 0.9, vatConfidence: 0.9 });
    expect(c).toBeGreaterThan(0); expect(c).toBeLessThanOrEqual(1);
  });
});
