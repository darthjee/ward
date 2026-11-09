import { maskAccountNumber, serializeAccount } from '../account-response.js';
import { buildAccount } from './account.test-support.js';
import { DebtAccountHandler } from '../account-types/debt-account.handler.js';
import { InvestmentAccountHandler } from '../account-types/investment-account.handler.js';
import { ProviderExpenseAccountHandler } from '../account-types/provider-expense-account.handler.js';
import { DebtDetails } from '../entities/debt-details.entity.js';
import { InvestmentDetails } from '../entities/investment-details.entity.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';

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

  it('serializes a debt account\'s debt object in snake_case, with decimal strings and null unset fields', () => {
    const debt = buildAccount({ type: 'debt', currency: 'BRL' });
    const details = Object.assign(new DebtDetails(), {
      accountId: debt.id,
      interestRate: '0.0000',
      interestPeriod: 'yearly',
      instalmentAmount: 123456n,
      instalmentFrequency: 'monthly',
      dueDay: 31,
      dueMonth: null,
      instalmentCount: null,
    });
    const nested = new DebtAccountHandler().serialize(details, debt);

    expect(serializeAccount(debt, { balance: -100000n, mask: false, nested })).toMatchObject({
      type: 'debt',
      balance: '-1000.00',
      debt: {
        interest_rate: '0',
        interest_period: 'yearly',
        instalment_amount: '1234.56',
        instalment_frequency: 'monthly',
        due_day: 31,
        due_month: null,
        instalment_count: null,
      },
    });
  });

  it('never adds a debt key to a regular account', () => {
    expect(serializeAccount(buildAccount(), { balance: 0n, mask: false })).not.toHaveProperty('debt');
  });

  it('serializes an investment account\'s investment object in snake_case, with the rate as a decimal string', () => {
    const investment = buildAccount({ type: 'investment', openingBalance: 0n });
    const details = Object.assign(new InvestmentDetails(), {
      accountId: investment.id,
      kind: 'savings',
      yieldRate: '1.1000',
      yieldPeriod: 'monthly',
      maturityDate: null,
      liquidityDays: 0,
    });
    const nested = new InvestmentAccountHandler().serialize(details);

    const response = serializeAccount(investment, { balance: -500n, mask: false, nested });

    expect(response).toMatchObject({
      type: 'investment',
      opening_balance: '0.00',
      balance: '-5.00',
      investment: { kind: 'savings', yield_rate: '1.1', yield_period: 'monthly', maturity_date: null, liquidity_days: 0 },
    });
    expect(response).not.toHaveProperty('debt');
  });

  it('never adds an investment key to a regular or debt account', () => {
    expect(serializeAccount(buildAccount(), { balance: 0n, mask: false })).not.toHaveProperty('investment');
    expect(serializeAccount(buildAccount({ type: 'debt' }), { balance: 0n, mask: false, nested: {} }))
      .not.toHaveProperty('investment');
  });

  it('serializes a provider account\'s provider_expense object in snake_case, with the amount as a decimal string', () => {
    const provider = buildAccount({ type: 'provider_expense', currency: 'BRL' });
    const details = Object.assign(new ProviderExpenseDetails(), {
      accountId: provider.id,
      forAccountant: true,
      providerTaxId: '12.345.678/0001-90',
      expectedAmount: 20000n,
      dueDay: 10,
      chargeFrequency: 'monthly',
      dueMonth: null,
    });
    const nested = new ProviderExpenseAccountHandler().serialize(details, provider);

    const response = serializeAccount(provider, { balance: -20000n, mask: false, nested });

    expect(response).toMatchObject({
      type: 'provider_expense',
      balance: '-200.00',
      provider_expense: {
        for_accountant: true,
        provider_tax_id: '12.345.678/0001-90',
        expected_amount: '200.00',
        charge_frequency: 'monthly',
        due_day: 10,
        due_month: null,
      },
    });
    expect(response).not.toHaveProperty('debt');
    expect(response).not.toHaveProperty('investment');
  });

  it('never adds a provider_expense key to a regular, debt or investment account', () => {
    expect(serializeAccount(buildAccount(), { balance: 0n, mask: false })).not.toHaveProperty('provider_expense');
    expect(serializeAccount(buildAccount({ type: 'debt' }), { balance: 0n, mask: false, nested: {} }))
      .not.toHaveProperty('provider_expense');
    expect(serializeAccount(buildAccount({ type: 'investment' }), { balance: 0n, mask: false, nested: {} }))
      .not.toHaveProperty('provider_expense');
  });
});
