import * as XLSX from 'xlsx';
import { CsvStatementParser } from '../../src/modules/banking/infrastructure/parsers/csv-parser';
import { XlsxStatementParser } from '../../src/modules/banking/infrastructure/parsers/xlsx-parser';

const csv = new CsvStatementParser();
const xlsx = new XlsxStatementParser();

describe('CSV parser (Task 3.2)', () => {
  it('parses headers + rows (comma)', () => {
    const buf = Buffer.from('date,amount,currency,counterparty_name,reference\n2026-05-14,1200.00,EUR,ACME,INV-1\n2026-05-15,-300.00,EUR,Beta,REF-2\n');
    const rows = csv.parse(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: '2026-05-14', amount: '1200.00', counterparty_name: 'ACME', reference: 'INV-1' });
  });
  it('handles semicolon delimiter + quoted fields', () => {
    const buf = Buffer.from('date;amount;description\n2026-05-14;1200,00;"Payment, thanks"\n');
    const rows = csv.parse(buf);
    expect(rows[0].description).toBe('Payment, thanks');
    expect(rows[0].amount).toBe('1200,00');
  });
});

describe('XLSX parser (Task 3.2)', () => {
  it('parses an xlsx workbook (first sheet, header row)', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['date', 'amount', 'currency', 'counterparty_name', 'reference'],
      ['2026-05-14', 1200, 'EUR', 'ACME', 'INV-1'],
      ['2026-05-15', -300, 'EUR', 'Beta', 'REF-2'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const rows = xlsx.parse(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: '2026-05-14', amount: '1200', counterparty_name: 'ACME' });
    expect(rows[1].amount).toBe('-300');
  });
});
