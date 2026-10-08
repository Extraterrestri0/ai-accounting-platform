import { toViesCsv } from '../../src/modules/vies/domain/csv';
import { normalizeVat, hasEuPrefix } from '../../src/modules/vies/domain/vat-number';
import type { ViesDatasetRow } from '../../src/modules/vies/domain/models';

describe('VAT normalization (Task 4.2)', () => {
  it('strips spaces/punctuation and upper-cases', () => {
    expect(normalizeVat(' de 123.456-789 ')).toEqual({ normalized: 'DE123456789', countryCode: 'DE' });
  });
  it('maps the Greek EL prefix to GR', () => {
    expect(normalizeVat('EL123456789').countryCode).toBe('GR');
  });
  it('detects EU vs non-EU prefixes', () => {
    expect(hasEuPrefix('DE123456789')).toBe(true);
    expect(hasEuPrefix('EL123456789')).toBe(true);
    expect(hasEuPrefix('US123456789')).toBe(false);
    expect(hasEuPrefix('')).toBe(false);
  });
});

describe('VIES dataset CSV (Task 4.2)', () => {
  const rows: ViesDatasetRow[] = [
    { counterpartyName: 'ACME GmbH', vatNumber: 'DE123456789', countryCode: 'DE', invoiceId: 'i1', invoiceNumber: '2026-0001', invoiceDate: '2026-05-04', taxableAmount: '1000.00', currency: 'EUR' },
    { counterpartyName: 'Beta, S.A.', vatNumber: 'ES A1234567Z', countryCode: 'ES', invoiceId: 'i2', invoiceNumber: '2026-0002', invoiceDate: '2026-05-09', taxableAmount: '-200.00', currency: 'EUR' },
  ];

  it('emits a header + one line per row, CRLF-separated', () => {
    const csv = toViesCsv(rows);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Клиент,ДДС номер,Държава,Фактура,Дата,Данъчна основа,Валута');
    expect(lines[1]).toBe('ACME GmbH,DE123456789,DE,2026-0001,2026-05-04,1000.00,EUR');
  });

  it('quotes fields that contain a comma', () => {
    const csv = toViesCsv(rows);
    expect(csv).toContain('"Beta, S.A."');
  });

  it('handles an empty dataset (header only)', () => {
    expect(toViesCsv([])).toBe('Клиент,ДДС номер,Държава,Фактура,Дата,Данъчна основа,Валута');
  });
});
