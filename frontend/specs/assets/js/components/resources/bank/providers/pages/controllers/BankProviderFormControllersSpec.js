import BankProviderNewController from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/BankProviderNewController.js';
import BankProviderEditController from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/BankProviderEditController.js';
import {
  emptyProviderFields,
  providerFieldsFromAccount,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/providerFormFields.js';

const ORG = { kind: 'organization', orgId: 5 };

const STORED = {
  id: 4,
  name: 'Office rent',
  bank_name: 'Landlord Ltd',
  branch: null,
  account_number: null,
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '0.00',
  notes: null,
  archived_at: null,
  type: 'provider_expense',
  provider_expense: {
    for_accountant: true,
    provider_tax_id: null,
  },
};

describe('provider form controllers', () => {
  let deps;

  beforeEach(() => {
    deps = {
      context: { kind: 'personal' },
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      onNotFound: jasmine.createSpy('onNotFound'),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['createProviderExpense', 'updateProviderExpense', 'createAccount', 'updateAccount']),
    };
    deps.client.createProviderExpense.and.resolveTo({ id: 4 });
    deps.client.updateProviderExpense.and.resolveTo({ id: 4 });
  });

  describe('BankProviderNewController', () => {
    it('creates through the provider call, then opens the provider', async () => {
      await new BankProviderNewController(deps).handleSubmit({
        ...emptyProviderFields('BRL', '2026-01-01'), name: 'Office rent',
      });

      expect(deps.client.createAccount).not.toHaveBeenCalled();
      expect(deps.client.createProviderExpense).toHaveBeenCalledWith(deps.context, jasmine.objectContaining({
        name: 'Office rent',
        provider_expense: { for_accountant: true, provider_tax_id: null },
      }));
      expect(deps.navigate).toHaveBeenCalledWith('#/bank/providers/4');
    });

    it('opens the provider under an organization', async () => {
      await new BankProviderNewController({ ...deps, context: ORG }).handleSubmit({ ...emptyProviderFields('BRL', '2026-01-01'), name: 'X' });

      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/providers/4');
    });

    it('keeps the values and shows the errors when invalid', async () => {
      await new BankProviderNewController(deps).handleSubmit({
        ...emptyProviderFields('BRL', '2026-01-01'), name: 'X', provider_tax_id: 'x'.repeat(40),
      });

      expect(deps.client.createProviderExpense).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({ provider_tax_id: jasmine.any(String) });
    });
  });

  describe('BankProviderEditController', () => {
    it('sends only the changed fields and provider keys, without type', async () => {
      await new BankProviderEditController({ ...deps, context: ORG })
        .handleSubmit(4, { ...providerFieldsFromAccount(STORED), bank_name: 'New Ltd', provider_tax_id: '9' }, STORED);

      expect(deps.client.updateAccount).not.toHaveBeenCalled();
      expect(deps.client.updateProviderExpense).toHaveBeenCalledWith(ORG, 4, { bank_name: 'New Ltd', provider_expense: { provider_tax_id: '9' } });
      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/providers/4');
    });

    it('clears the tax id with null', async () => {
      const stored = { ...STORED, provider_expense: { ...STORED.provider_expense, provider_tax_id: '1' } };

      await new BankProviderEditController(deps).handleSubmit(4, { ...providerFieldsFromAccount(stored), provider_tax_id: '' }, stored);

      expect(deps.client.updateProviderExpense).toHaveBeenCalledWith(deps.context, 4, { provider_expense: { provider_tax_id: null } });
    });

    it('turns For accountant off', async () => {
      await new BankProviderEditController(deps).handleSubmit(4, { ...providerFieldsFromAccount(STORED), for_accountant: false }, STORED);

      expect(deps.client.updateProviderExpense).toHaveBeenCalledWith(deps.context, 4, { provider_expense: { for_accountant: false } });
    });

    it('goes straight back to the provider when nothing changed', async () => {
      await new BankProviderEditController(deps).handleSubmit(4, providerFieldsFromAccount(STORED), STORED);

      expect(deps.client.updateProviderExpense).not.toHaveBeenCalled();
      expect(deps.navigate).toHaveBeenCalledWith('#/bank/providers/4');
    });

    it('sends only the name of an archived provider', async () => {
      const archived = { ...STORED, archived_at: '2026-02-01T00:00:00.000Z' };

      await new BankProviderEditController(deps).handleSubmit(4, { ...providerFieldsFromAccount(archived), name: 'Old rent' }, archived);

      expect(deps.client.updateProviderExpense).toHaveBeenCalledWith(deps.context, 4, { name: 'Old rent' });
    });
  });
});
