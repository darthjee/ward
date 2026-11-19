import BillFormController, {
  BILL_PAID_MESSAGE,
} from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/controllers/BillFormController.js';
import ProviderBillsClient from '../../../../../../../../../assets/js/client/ProviderBillsClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const VALID = {
  kind: 'one_off', provider_account_id: '3', paying_account_id: '1', due_date: '2026-03-10', expected_amount: '120.50', description: 'Repair', notes: '',
};
const RECURRING_FIELDS = {
  ...VALID, kind: 'recurring', charge_frequency: 'monthly', due_day: '5', due_month: '', bills_from: '', show_in_calendar: true, paying_account_id: '',
};
const BILL = {
  id: 9,
  kind: 'one_off',
  provider_account_id: 3,
  paying_account_id: 1,
  due_date: '2026-03-10',
  expected_amount: '120.50',
  description: 'Repair',
  notes: null,
};

[
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
].forEach(([label, context, prefix]) => {
  describe(`BillFormController in ${label}`, () => {
    let client;
    let deps;

    function build() {
      return new BillFormController({ ...deps, client });
    }

    beforeEach(() => {
      client = {
        createProviderBill: jasmine.createSpy('createProviderBill').and.resolveTo(BILL),
        updateProviderBill: jasmine.createSpy('updateProviderBill').and.resolveTo(BILL),
        deleteProviderBill: jasmine.createSpy('deleteProviderBill').and.resolveTo({}),
      };
      deps = {
        context,
        setFieldErrors: jasmine.createSpy('setFieldErrors'),
        setSubmitError: jasmine.createSpy('setSubmitError'),
        setPending: jasmine.createSpy('setPending'),
        setConfirming: jasmine.createSpy('setConfirming'),
        onNotFound: jasmine.createSpy('onNotFound'),
        navigate: jasmine.createSpy('navigate'),
      };
    });

    it('returns to the provider, or to the providers list without one', () => {
      expect(build().returnHash(3)).toBe(`#${prefix}/bank/providers/3`);
      expect(build().returnHash('')).toBe(`#${prefix}/bank/providers`);
      expect(build().returnHash(undefined)).toBe(`#${prefix}/bank/providers`);
    });

    it('creates the bill, then goes to its provider', async () => {
      await build().create(VALID, 'BRL');

      expect(client.createProviderBill).toHaveBeenCalledWith(context, 3, {
        kind: 'one_off', provider_account_id: 3, paying_account_id: 1, due_date: '2026-03-10', expected_amount: '120.50', description: 'Repair', notes: null,
      });
      expect(deps.setPending).toHaveBeenCalledWith(true);
      expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
    });

    it('does not send an invalid form', async () => {
      await build().create({ ...VALID, description: '' }, 'BRL');

      expect(client.createProviderBill).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({ description: jasmine.any(String) });
    });

    it('stays on the form when the session expired', async () => {
      client.createProviderBill.and.resolveTo(undefined);
      await build().create(VALID, 'BRL');

      expect(deps.navigate).not.toHaveBeenCalled();
      expect(deps.setPending).toHaveBeenCalledWith(false);
    });

    it('sends only the changed fields on update', async () => {
      await build().update(BILL, { ...VALID, expected_amount: '99', notes: 'Call' }, 'BRL');

      expect(client.updateProviderBill).toHaveBeenCalledWith(context, 9, { expected_amount: '99', notes: 'Call' });
      expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
    });

    it('creates a recurring bill under its provider, without one-off fields', async () => {
      await build().create(RECURRING_FIELDS, 'BRL');

      const [, providerId, body] = client.createProviderBill.calls.mostRecent().args;

      expect(providerId).toBe(3);
      expect(body.kind).toBe('recurring');
      expect(body.due_day).toBe(5);
      expect('due_date' in body).toBeFalse();
    });

    it('never sends the kind or the provider when updating a recurring bill', async () => {
      const recurring = {
        id: 11, kind: 'recurring', provider_account_id: 3, paying_account_id: null, expected_amount: '120.50', description: 'Repair', notes: null, charge_frequency: 'monthly', due_day: 5, due_month: null, bills_from: null, show_in_calendar: true,
      };

      await build().update(recurring, { ...RECURRING_FIELDS, provider_account_id: '4', due_day: '6' }, 'BRL');

      expect(client.updateProviderBill).toHaveBeenCalledWith(context, 11, { due_day: 6 });
    });

    it('goes straight back when nothing changed', async () => {
      await build().update(BILL, VALID, 'BRL');

      expect(client.updateProviderBill).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({});
      expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
    });

    it('does not send an invalid update', async () => {
      await build().update(BILL, { ...VALID, expected_amount: '0' }, 'BRL');

      expect(client.updateProviderBill).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({ expected_amount: jasmine.any(String) });
    });

    it('shows an unmapped 422 on the form with the server message only', async () => {
      client.createProviderBill.and.rejectWith(new ApiError(422, 'odd', 'ODD'));
      await build().create(VALID, 'BRL');

      expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({
        kind: 'validation', messages: ['odd'],
      }));
      expect(deps.navigate).not.toHaveBeenCalled();
    });

    [
      ['PROVIDER_BILL_NAME_TAKEN', 'description', 'A recurring bill with this description already exists for this provider'],
      ['CURRENCY_MISMATCH', 'paying_account_id', "Account currency must match the provider's"],
      ['ACCOUNT_NOT_FOUND', 'paying_account_id', 'Account not available'],
    ].forEach(([code, field, message]) => {
      it(`shows ${code} on the ${field} field`, async () => {
        client.createProviderBill.and.rejectWith(new ApiError(409, 'server', code));
        await build().create(VALID, 'BRL');

        expect(deps.setFieldErrors).toHaveBeenCalledWith({ [field]: message });
        expect(deps.navigate).not.toHaveBeenCalled();
      });
    });

    [
      ['PROVIDER_BILL_LIMIT', 'This provider already has 50 recurring bills'],
      ['ACCOUNT_ARCHIVED', 'The provider is archived'],
      ['PROVIDER_BILL_KIND_LOCKED', "A bill's kind can't be changed."],
      ['PROVIDER_BILL_PROVIDER_LOCKED', "A recurring bill can't be moved to another provider."],
      ['PROVIDER_BILL_PAID', BILL_PAID_MESSAGE],
      ['BILL_PAID', BILL_PAID_MESSAGE],
    ].forEach(([code, message]) => {
      it(`shows ${code} on the form`, async () => {
        client.createProviderBill.and.rejectWith(new ApiError(409, 'server', code));
        await build().create(VALID, 'BRL');

        expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({ messages: [message] }));
      });
    });

    it('tells the user to undo the payment first on a paid bill update', async () => {
      client.updateProviderBill.and.rejectWith(new ApiError(409, 'The bill is paid; undo the payment first', 'BILL_PAID'));
      await build().update(BILL, { ...VALID, expected_amount: '1' }, 'BRL');

      expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({
        kind: 'conflict', messages: [BILL_PAID_MESSAGE],
      }));
    });

    it('shows Not-found on a 404', async () => {
      client.updateProviderBill.and.rejectWith(new ApiError(404, 'Not found'));
      await build().update(BILL, { ...VALID, expected_amount: '1' }, 'BRL');

      expect(deps.onNotFound).toHaveBeenCalled();
    });

    it('offers a retry on a transient failure', async () => {
      client.createProviderBill.and.rejectWith(new ApiError(503, 'Down'));
      await build().create(VALID, 'BRL');

      const error = deps.setSubmitError.calls.mostRecent().args[0];

      expect(error.kind).toBe('transient');

      client.createProviderBill.and.resolveTo(BILL);
      await error.retry();

      expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
    });

    it('shows another conflict with its message', async () => {
      client.createProviderBill.and.rejectWith(new ApiError(409, 'Other', 'OTHER'));
      await build().create(VALID, 'BRL');

      expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict', messages: ['Other'] }));
    });

    describe('destroy', () => {
      it('deletes the bill, closes the confirmation and goes to its provider', async () => {
        await build().destroy(BILL);

        expect(client.deleteProviderBill).toHaveBeenCalledWith(context, 9);
        expect(deps.setConfirming).toHaveBeenCalledWith(false);
        expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
      });

      it('stays when the session expired', async () => {
        client.deleteProviderBill.and.resolveTo(undefined);
        await build().destroy(BILL);

        expect(deps.navigate).not.toHaveBeenCalled();
      });

      it('tells the user to undo the payment first on a paid bill', async () => {
        client.deleteProviderBill.and.rejectWith(new ApiError(409, 'The bill is paid; undo the payment first', 'BILL_PAID'));
        await build().destroy(BILL);

        expect(deps.setConfirming).toHaveBeenCalledWith(false);
        expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({ messages: [BILL_PAID_MESSAGE] }));
        expect(deps.navigate).not.toHaveBeenCalled();
      });

      it('offers a retry on a transient failure', async () => {
        client.deleteProviderBill.and.rejectWith(new ApiError(500, 'Boom'));
        await build().destroy(BILL);

        client.deleteProviderBill.and.resolveTo({});
        await deps.setSubmitError.calls.mostRecent().args[0].retry();

        expect(client.deleteProviderBill).toHaveBeenCalledTimes(2);
      });
    });
  });
});

describe('BillFormController defaults', () => {
  it('uses the bills client', () => {
    expect(new BillFormController({ context: { kind: 'personal' } }).client).toBe(ProviderBillsClient);
  });
});
