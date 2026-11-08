import BankDebtNewController from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/controllers/BankDebtNewController.js';
import BankDebtEditController from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/controllers/BankDebtEditController.js';
import { debtFieldsFromAccount, emptyDebtFields } from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/controllers/debtFormFields.js';

const ORG = { kind: 'organization', orgId: 5 };

const STORED = {
  id: 7,
  name: 'Car loan',
  bank_name: 'Bank A',
  branch: null,
  account_number: null,
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '-10000.00',
  notes: null,
  archived_at: null,
  type: 'debt',
  debt: {
    interest_rate: '1.99',
    interest_period: 'monthly',
    instalment_amount: null,
    instalment_frequency: 'monthly',
    due_day: null,
    due_month: null,
    instalment_count: null,
  },
};

describe('debt form controllers', () => {
  let deps;

  beforeEach(() => {
    deps = {
      context: { kind: 'personal' },
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      onNotFound: jasmine.createSpy('onNotFound'),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['createDebt', 'updateDebt', 'createAccount', 'updateAccount']),
    };
    deps.client.createDebt.and.resolveTo({ id: 7 });
    deps.client.updateDebt.and.resolveTo({ id: 7 });
  });

  describe('BankDebtNewController', () => {
    it('creates through the debt call with the negated amount owed, then opens the debt', async () => {
      await new BankDebtNewController(deps).handleSubmit({
        ...emptyDebtFields('BRL', '2026-01-01'), name: 'Car loan', opening_balance: '10000', interest_rate: '2', interest_period: 'yearly',
      });

      expect(deps.client.createAccount).not.toHaveBeenCalled();
      expect(deps.client.createDebt).toHaveBeenCalledWith(deps.context, jasmine.objectContaining({
        name: 'Car loan',
        opening_balance: '-10000',
        debt: jasmine.objectContaining({ interest_rate: '2', interest_period: 'yearly' }),
      }));
      expect(deps.navigate).toHaveBeenCalledWith('#/bank/debts/7');
    });

    it('opens the debt under an organization', async () => {
      await new BankDebtNewController({ ...deps, context: ORG }).handleSubmit({ ...emptyDebtFields('BRL', '2026-01-01'), name: 'X' });

      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/debts/7');
    });

    it('keeps the values and shows the errors when invalid', async () => {
      await new BankDebtNewController(deps).handleSubmit({ ...emptyDebtFields('BRL', '2026-01-01'), name: 'X', interest_rate: '3' });

      expect(deps.client.createDebt).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({ interest_period: jasmine.any(String) });
    });
  });

  describe('BankDebtEditController', () => {
    it('sends only the changed fields and debt keys through the debt call, without type', async () => {
      await new BankDebtEditController({ ...deps, context: ORG })
        .handleSubmit(7, { ...debtFieldsFromAccount(STORED), bank_name: 'Bank B', due_day: '15' }, STORED);

      expect(deps.client.updateAccount).not.toHaveBeenCalled();
      expect(deps.client.updateDebt).toHaveBeenCalledWith(ORG, 7, { bank_name: 'Bank B', debt: { due_day: 15 } });
      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/debts/7');
    });

    it('clears the rate by sending both nulls', async () => {
      await new BankDebtEditController(deps).handleSubmit(7, { ...debtFieldsFromAccount(STORED), interest_rate: '' }, STORED);

      expect(deps.client.updateDebt).toHaveBeenCalledWith(deps.context, 7, { debt: { interest_rate: null, interest_period: null } });
    });

    it('sends the amount owed negated', async () => {
      await new BankDebtEditController(deps).handleSubmit(7, { ...debtFieldsFromAccount(STORED), opening_balance: '9000' }, STORED);

      expect(deps.client.updateDebt).toHaveBeenCalledWith(deps.context, 7, { opening_balance: '-9000' });
    });

    it('goes straight back to the debt when nothing changed', async () => {
      await new BankDebtEditController(deps).handleSubmit(7, debtFieldsFromAccount(STORED), STORED);

      expect(deps.client.updateDebt).not.toHaveBeenCalled();
      expect(deps.navigate).toHaveBeenCalledWith('#/bank/debts/7');
    });

    it('sends only the name of an archived debt', async () => {
      const archived = { ...STORED, archived_at: '2026-02-01T00:00:00.000Z' };

      await new BankDebtEditController(deps).handleSubmit(7, { ...debtFieldsFromAccount(archived), name: 'Old loan' }, archived);

      expect(deps.client.updateDebt).toHaveBeenCalledWith(deps.context, 7, { name: 'Old loan' });
    });
  });
});
