import BankInvestmentNewController from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/controllers/BankInvestmentNewController.js';
import BankInvestmentEditController from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/controllers/BankInvestmentEditController.js';
import {
  emptyInvestmentFields,
  investmentFieldsFromAccount,
} from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/controllers/investmentFormFields.js';

const ORG = { kind: 'organization', orgId: 5 };

const STORED = {
  id: 3,
  name: 'CDB',
  bank_name: 'Broker A',
  branch: null,
  account_number: null,
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '0.00',
  notes: null,
  archived_at: null,
  type: 'investment',
  investment: {
    kind: 'fixed_income', yield_rate: '12.5', yield_period: 'yearly', maturity_date: null, liquidity_days: 0,
  },
};

describe('investment form controllers', () => {
  let deps;

  beforeEach(() => {
    deps = {
      context: { kind: 'personal' },
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      onNotFound: jasmine.createSpy('onNotFound'),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['createInvestment', 'updateInvestment', 'createAccount', 'updateAccount']),
    };
    deps.client.createInvestment.and.resolveTo({ id: 3 });
    deps.client.updateInvestment.and.resolveTo({ id: 3 });
  });

  describe('BankInvestmentNewController', () => {
    it('creates through the investment call with opening_balance "0", then opens the investment', async () => {
      await new BankInvestmentNewController(deps).handleSubmit({
        ...emptyInvestmentFields('BRL', '2026-01-01'), name: 'CDB', kind: 'fund', yield_rate: '2', yield_period: 'yearly',
      });

      expect(deps.client.createAccount).not.toHaveBeenCalled();
      expect(deps.client.createInvestment).toHaveBeenCalledWith(deps.context, jasmine.objectContaining({
        name: 'CDB',
        opening_balance: '0',
        investment: jasmine.objectContaining({ kind: 'fund', yield_rate: '2', yield_period: 'yearly' }),
      }));
      expect(deps.navigate).toHaveBeenCalledWith('#/bank/investments/3');
    });

    it('opens the investment under an organization', async () => {
      await new BankInvestmentNewController({ ...deps, context: ORG })
        .handleSubmit({ ...emptyInvestmentFields('BRL', '2026-01-01'), name: 'X' });

      expect(deps.client.createInvestment).toHaveBeenCalledWith(ORG, jasmine.any(Object));
      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/investments/3');
    });

    it('keeps the values and shows the errors when invalid', async () => {
      await new BankInvestmentNewController(deps)
        .handleSubmit({ ...emptyInvestmentFields('BRL', '2026-01-01'), name: 'X', yield_rate: '3' });

      expect(deps.client.createInvestment).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({ yield_period: 'Choose the yield period' });
    });
  });

  describe('BankInvestmentEditController', () => {
    it('sends only the changed fields and investment keys, without type or opening balance', async () => {
      await new BankInvestmentEditController({ ...deps, context: ORG })
        .handleSubmit(3, { ...investmentFieldsFromAccount(STORED), bank_name: 'Broker B', maturity_date: '2027-01-01' }, STORED);

      expect(deps.client.updateAccount).not.toHaveBeenCalled();
      expect(deps.client.updateInvestment).toHaveBeenCalledWith(ORG, 3, {
        bank_name: 'Broker B', investment: { maturity_date: '2027-01-01' },
      });
      expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/investments/3');
    });

    it('clears the rate by sending both nulls (edge case 10)', async () => {
      await new BankInvestmentEditController(deps)
        .handleSubmit(3, { ...investmentFieldsFromAccount(STORED), yield_rate: '' }, STORED);

      expect(deps.client.updateInvestment).toHaveBeenCalledWith(deps.context, 3, {
        investment: { yield_rate: null, yield_period: null },
      });
    });

    it('clears an optional field with null', async () => {
      await new BankInvestmentEditController(deps)
        .handleSubmit(3, { ...investmentFieldsFromAccount(STORED), kind: '' }, STORED);

      expect(deps.client.updateInvestment).toHaveBeenCalledWith(deps.context, 3, { investment: { kind: null } });
    });

    it('goes straight back to the investment when nothing changed', async () => {
      await new BankInvestmentEditController(deps).handleSubmit(3, investmentFieldsFromAccount(STORED), STORED);

      expect(deps.client.updateInvestment).not.toHaveBeenCalled();
      expect(deps.navigate).toHaveBeenCalledWith('#/bank/investments/3');
    });

    it('sends only the name of an archived investment', async () => {
      const archived = { ...STORED, archived_at: '2026-02-01T00:00:00.000Z' };

      await new BankInvestmentEditController(deps)
        .handleSubmit(3, { ...investmentFieldsFromAccount(archived), name: 'Old CDB' }, archived);

      expect(deps.client.updateInvestment).toHaveBeenCalledWith(deps.context, 3, { name: 'Old CDB' });
    });
  });
});
