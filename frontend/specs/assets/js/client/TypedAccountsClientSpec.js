import TypedAccountsClient from '../../../../assets/js/client/TypedAccountsClient.js';
import BankClient from '../../../../assets/js/client/BankClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';

const CONTEXT = { kind: 'personal' };

describe('TypedAccountsClient', () => {
  beforeEach(() => {
    spyOn(ApiClient, 'postJson').and.resolveTo({ id: 1 });
    spyOn(ApiClient, 'patchJson').and.resolveTo({ id: 1 });
  });

  [
    ['createDebt', 'debt', 'debt'],
    ['createInvestment', 'investment', 'investment'],
    ['createProviderExpense', 'provider_expense', 'provider_expense'],
  ].forEach(([method, type, key]) => {
    it(`${method} posts type ${type}`, async () => {
      await TypedAccountsClient[method](CONTEXT, { name: 'A', [key]: {} });

      expect(ApiClient.postJson).toHaveBeenCalledWith('/bank/accounts.json', { type, name: 'A', [key]: {} });
    });
  });

  ['updateDebt', 'updateInvestment', 'updateProviderExpense'].forEach((method) => {
    it(`${method} patches without a type`, async () => {
      await TypedAccountsClient[method](CONTEXT, 4, { name: 'A', type: 'regular' });

      expect(ApiClient.patchJson).toHaveBeenCalledWith('/bank/accounts/4.json', { name: 'A' });
    });
  });

  const SCHEDULE = { bills_from: '2026-01-01', show_in_calendar: false, paying_account_id: 9 };

  it('createDebt passes the schedule fields through', async () => {
    await TypedAccountsClient.createDebt(CONTEXT, { name: 'A', debt: { ...SCHEDULE, paying_account: { id: 9 } } });

    expect(ApiClient.postJson.calls.mostRecent().args[1].debt).toEqual(SCHEDULE);
  });

  it('updateDebt keeps null schedule fields (they clear)', async () => {
    await TypedAccountsClient.updateDebt(CONTEXT, 4, { debt: { bills_from: null, paying_account_id: null } });

    expect(ApiClient.patchJson).toHaveBeenCalledWith('/bank/accounts/4.json', {
      debt: { bills_from: null, paying_account_id: null },
    });
  });

  const PROVIDER_SCHEDULE = {
    ...SCHEDULE, expected_amount: '200.00', charge_frequency: 'monthly', due_day: 10, due_month: 3,
  };
  const PROVIDER_DETAILS = { for_accountant: true, provider_tax_id: '12.345.678/0001-90' };

  it('createProviderExpense strips every schedule key from provider_expense', async () => {
    await TypedAccountsClient.createProviderExpense(CONTEXT, { name: 'A', provider_expense: { ...PROVIDER_SCHEDULE, ...PROVIDER_DETAILS } });

    expect(ApiClient.postJson.calls.mostRecent().args[1].provider_expense).toEqual(PROVIDER_DETAILS);
  });

  it('updateProviderExpense strips every schedule key from provider_expense', async () => {
    await TypedAccountsClient.updateProviderExpense(CONTEXT, 4, { provider_expense: { ...PROVIDER_SCHEDULE, bills_from: null } });

    expect(ApiClient.patchJson).toHaveBeenCalledWith('/bank/accounts/4.json', { provider_expense: {} });
  });

  it('updateProviderExpense passes for_accountant and provider_tax_id through, keeping null', async () => {
    await TypedAccountsClient.updateProviderExpense(CONTEXT, 4, { provider_expense: { for_accountant: false, provider_tax_id: null } });

    expect(ApiClient.patchJson).toHaveBeenCalledWith('/bank/accounts/4.json', {
      provider_expense: { for_accountant: false, provider_tax_id: null },
    });
  });

  it('is exposed through BankClient', () => {
    expect(BankClient.createProviderExpense).toBe(TypedAccountsClient.createProviderExpense);
    expect(BankClient.updateDebt).toBe(TypedAccountsClient.updateDebt);
  });
});
