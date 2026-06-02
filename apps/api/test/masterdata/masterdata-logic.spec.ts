import { isValidEik } from '../../src/modules/masterdata/domain/validation/eik';
import { isValidVatNumberFormat } from '../../src/modules/masterdata/domain/validation/vat-number';
import { AccountRepository } from '../../src/modules/masterdata/infrastructure/account.repository';
import type { Account } from '../../src/modules/masterdata/domain/models';

describe('EIK validator', () => {
  it('accepts valid EIKs and rejects invalid', () => {
    expect(isValidEik('131071587')).toBe(true);   // known valid
    expect(isValidEik('111111113')).toBe(true);   // generated valid
    expect(isValidEik('123456789')).toBe(false);  // bad checksum
    expect(isValidEik('12345')).toBe(false);       // wrong length
    expect(isValidEik('abcdefghi')).toBe(false);   // non-digit
  });
});

describe('VAT number format', () => {
  it('validates BG (= BG + valid EIK) and other EU formats', () => {
    expect(isValidVatNumberFormat('BG111111113')).toBe(true);
    expect(isValidVatNumberFormat('BG123456789')).toBe(false); // bad EIK part
    expect(isValidVatNumberFormat('DE123456789')).toBe(true);
    expect(isValidVatNumberFormat('XX123')).toBe(false);
  });
});

describe('chart of accounts tree', () => {
  it('nests children under parents', () => {
    const repo = new AccountRepository();
    const flat: Account[] = [
      { id: 'g', companyId: 'c', code: '70', name: 'Revenue', type: 'revenue', normalBalance: 'credit', isPostable: false, status: 'active' },
      { id: 'c1', companyId: 'c', code: '701', name: 'Sales', type: 'revenue', normalBalance: 'credit', parentAccountId: 'g', isPostable: true, status: 'active' },
    ];
    const tree = repo.buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].code).toBe('701');
  });
});
