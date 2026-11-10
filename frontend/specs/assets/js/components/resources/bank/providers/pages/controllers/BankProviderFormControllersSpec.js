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
    expected_amount: '200.00',
    charge_frequency: 'monthly',
    due_day: null,
    due_month: null,
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
        ...emptyProviderFields('BRL', '2026-01-01'), name: 'Office rent', expected_amount: '200',
      });

      expect(deps.client.createAccount).not.toHaveBeenCalled();
      expect(deps.client.createProviderExpense).toHaveBeenCalledWith(deps.context, jasmine.objectContaining({
        name: 'Office rent',
        provider_expense: jasmine.objectContaining({ for_accountant: true, expected_amount: '200', charge_frequency: 'monthly' }),
      }));
      expect(deps.navigate).toHaveBeenCalledWith('#/bank/providers/4');
    });

    it('opens the provider under an organization', async () => {
      await new BankProviderNewController({ ...deps, context: ORG }).handleSubmit({ ...emptyProviderFields('BRL', '2026-01-01'), name: 'X' });

      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/providers/4');
    });

    it('keeps the values and shows the errors when invalid', async () => {
      await new BankProviderNewController(deps).handleSubmit({
        ...emptyProviderFields('BRL', '2026-01-01'), name: 'X', charge_frequency: 'yearly',
      });

      expect(deps.client.createProviderExpense).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({ due_month: jasmine.any(String) });
    });
  });

  describe('BankProviderEditController', () => {
    it('sends only the changed fields and provider keys, without type', async () => {
      await new BankProviderEditController({ ...deps, context: ORG })
        .handleSubmit(4, { ...providerFieldsFromAccount(STORED), bank_name: 'New Ltd', due_day: '15' }, STORED);

      expect(deps.client.updateAccount).not.toHaveBeenCalled();
      expect(deps.client.updateProviderExpense).toHaveBeenCalledWith(ORG, 4, { bank_name: 'New Ltd', provider_expense: { due_day: 15 } });
      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/providers/4');
    });

    it('clears the expected amount with null', async () => {
      await new BankProviderEditController(deps).handleSubmit(4, { ...providerFieldsFromAccount(STORED), expected_amount: '' }, STORED);

      expect(deps.client.updateProviderExpense).toHaveBeenCalledWith(deps.context, 4, { provider_expense: { expected_amount: null } });
    });

    it('switches to yearly with the due month', async () => {
      await new BankProviderEditController(deps).handleSubmit(4, {
        ...providerFieldsFromAccount(STORED), charge_frequency: 'yearly', due_month: '6',
      }, STORED);

      expect(deps.client.updateProviderExpense).toHaveBeenCalledWith(deps.context, 4, {
        provider_expense: { charge_frequency: 'yearly', due_month: 6 },
      });
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
