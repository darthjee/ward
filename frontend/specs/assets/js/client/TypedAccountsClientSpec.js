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

  it('is exposed through BankClient', () => {
    expect(BankClient.createProviderExpense).toBe(TypedAccountsClient.createProviderExpense);
    expect(BankClient.updateDebt).toBe(TypedAccountsClient.updateDebt);
  });
});
