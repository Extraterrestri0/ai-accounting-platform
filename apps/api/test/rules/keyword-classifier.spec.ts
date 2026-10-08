import { classifyByKeywords } from '../../src/modules/docintel/domain/classification/keyword-classifier';

describe('expense keyword classifier (Task 1.2)', () => {
  it('classifies telecom suppliers (A1 / Vivacom / Yettel)', () => {
    expect(classifyByKeywords('Фактура от A1 България')?.code).toBe('TELECOM');
    expect(classifyByKeywords('VIVACOM mobile services')?.code).toBe('TELECOM');
    expect(classifyByKeywords('Yettel месечна такса')?.code).toBe('TELECOM');
    expect(classifyByKeywords('абонамент за интернет')?.code).toBe('TELECOM');
  });

  it('classifies fuel suppliers (Shell / OMV / Lukoil / бензин)', () => {
    expect(classifyByKeywords('SHELL EOOD')?.code).toBe('FUEL');
    expect(classifyByKeywords('OMV Bulgaria')?.code).toBe('FUEL');
    expect(classifyByKeywords('Лукойл гориво')?.code).toBe('FUEL');
    expect(classifyByKeywords('покупка дизел')?.code).toBe('FUEL');
  });

  it('classifies advertising (Facebook / Google Ads / реклама)', () => {
    expect(classifyByKeywords('Facebook Ireland Ltd')?.code).toBe('ADVERTISING');
    expect(classifyByKeywords('Google Ads campaign')?.code).toBe('ADVERTISING');
    expect(classifyByKeywords('услуги за реклама')?.code).toBe('ADVERTISING');
  });

  it('classifies SaaS / software (Microsoft / GitHub / subscription)', () => {
    expect(classifyByKeywords('Microsoft 365 subscription')?.code).toBe('SAAS');
    expect(classifyByKeywords('GitHub Inc')?.code).toBe('SAAS');
    expect(classifyByKeywords('софтуер лиценз')?.code).toBe('SAAS');
  });

  it('classifies rent and bank fees', () => {
    expect(classifyByKeywords('наем офис')?.code).toBe('RENT');
    expect(classifyByKeywords('банкова такса за превод')?.code).toBe('BANKFEES');
  });

  it('returns a brand match with higher confidence than a keyword match', () => {
    const brand = classifyByKeywords('Shell')!;
    const keyword = classifyByKeywords('гориво')!;
    expect(brand.confidence).toBeGreaterThan(keyword.confidence);
  });

  it('returns null (→ caller defaults to Other) for unknown text', () => {
    expect(classifyByKeywords('Random Unknown Supplier 123')).toBeNull();
    expect(classifyByKeywords('')).toBeNull();
  });
});
