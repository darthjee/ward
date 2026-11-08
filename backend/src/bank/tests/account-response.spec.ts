import { maskAccountNumber, serializeAccount } from '../account-response.js';
import { buildAccount } from './account.test-support.js';

describe('maskAccountNumber', () => {
  it.each([
    ['12345-6', '•••• 45-6'],
    ['0001234', '•••• 1234'],
    ['12', '•••• 12'],
  ])('masks %p as %p', (raw, masked) => {
    expect(maskAccountNumber(raw)).toBe(masked);
  });

  it('keeps null', () => {
    expect(maskAccountNumber(null)).toBeNull();
  });
});

describe('serializeAccount', () => {
  const account = buildAccount({ userId: 7, organizationId: null });

  it('returns exactly the snake_case public fields with formatted amounts', () => {
    expect(serializeAccount(account, { balance: -123456n, mask: false })).toEqual({
      id: 1,
      type: 'regular',
      name: 'Nubank',
      bank_name: 'Nu',
      branch: '0001',
      account_number: '12345-6',
      currency: 'BRL',
      opening_date: '2026-01-01',
      opening_balance: '1000.00',
      balance: '-1234.56',
      archived_at: null,
      notes: null,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
    });
  });

  it('never includes owner fields', () => {
    const response = serializeAccount(buildAccount({ userId: null, organizationId: 3 }), { balance: 0n, mask: true });

    expect(Object.keys(response)).not.toEqual(expect.arrayContaining(['user_id']));
    expect(response).not.toHaveProperty('user_id');
    expect(response).not.toHaveProperty('organization_id');
    expect(response).not.toHaveProperty('userId');
    expect(response).not.toHaveProperty('organizationId');
  });

  it('masks the account number when asked', () => {
    expect(serializeAccount(account, { balance: 0n, mask: true }).account_number).toBe('•••• 45-6');
  });

  it('formats in the currency exponent', () => {
    const yen = buildAccount({ currency: 'JPY', openingBalance: 500n });

    expect(serializeAccount(yen, { balance: 500n, mask: false })).toMatchObject({ opening_balance: '500', balance: '500' });
  });

  it('adds the nested object under the type name', () => {
    const debt = buildAccount({ type: 'debt' });

    expect(serializeAccount(debt, { balance: 0n, mask: false, nested: { rate: '1' } }).debt).toEqual({ rate: '1' });
  });
});
