import BillFormController, {
  BILL_PAID_MESSAGE,
} from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/controllers/BillFormController.js';
import BillsClient from '../../../../../../../../../assets/js/client/BillsClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const VALID = {
  provider_account_id: '3', paying_account_id: '1', due_date: '2026-03-10', amount: '120.50', description: 'Repair', notes: '',
};
const BILL = {
  id: 9,
  provider_account: { id: 3, name: 'Plumber' },
  paying_account: { id: 1, name: 'Main' },
  due_date: '2026-03-10',
  amount: '120.50',
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
        createBill: jasmine.createSpy('createBill').and.resolveTo(BILL),
        updateBill: jasmine.createSpy('updateBill').and.resolveTo(BILL),
        deleteBill: jasmine.createSpy('deleteBill').and.resolveTo({}),
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

      expect(client.createBill).toHaveBeenCalledWith(context, {
        provider_account_id: 3, paying_account_id: 1, due_date: '2026-03-10', amount: '120.50', description: 'Repair', notes: null,
      });
      expect(deps.setPending).toHaveBeenCalledWith(true);
      expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
    });

    it('does not send an invalid form', async () => {
      await build().create({ ...VALID, description: '' }, 'BRL');

      expect(client.createBill).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({ description: jasmine.any(String) });
    });

    it('stays on the form when the session expired', async () => {
      client.createBill.and.resolveTo(undefined);
      await build().create(VALID, 'BRL');

      expect(deps.navigate).not.toHaveBeenCalled();
      expect(deps.setPending).toHaveBeenCalledWith(false);
    });

    it('sends only the changed fields on update', async () => {
      await build().update(BILL, { ...VALID, amount: '99', notes: 'Call' }, 'BRL');

      expect(client.updateBill).toHaveBeenCalledWith(context, 9, { amount: '99', notes: 'Call' });
      expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
    });

    it('goes straight back when nothing changed', async () => {
      await build().update(BILL, VALID, 'BRL');

      expect(client.updateBill).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({});
      expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
    });

    it('does not send an invalid update', async () => {
      await build().update(BILL, { ...VALID, amount: '0' }, 'BRL');

      expect(client.updateBill).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith({ amount: jasmine.any(String) });
    });

    it('shows a 422 on the form with the server message only', async () => {
      client.createBill.and.rejectWith(new ApiError(422, 'currency mismatch', 'CURRENCY_MISMATCH'));
      await build().create(VALID, 'BRL');

      expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({
        kind: 'validation', messages: ['currency mismatch'],
      }));
      expect(deps.navigate).not.toHaveBeenCalled();
    });

    it('tells the user to undo the payment first on a paid bill update', async () => {
      client.updateBill.and.rejectWith(new ApiError(409, 'The bill is paid; undo the payment first', 'BILL_PAID'));
      await build().update(BILL, { ...VALID, amount: '1' }, 'BRL');

      expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({
        kind: 'conflict', messages: [BILL_PAID_MESSAGE],
      }));
    });

    it('shows Not-found on a 404', async () => {
      client.updateBill.and.rejectWith(new ApiError(404, 'Not found'));
      await build().update(BILL, { ...VALID, amount: '1' }, 'BRL');

      expect(deps.onNotFound).toHaveBeenCalled();
    });

    it('offers a retry on a transient failure', async () => {
      client.createBill.and.rejectWith(new ApiError(503, 'Down'));
      await build().create(VALID, 'BRL');

      const error = deps.setSubmitError.calls.mostRecent().args[0];

      expect(error.kind).toBe('transient');

      client.createBill.and.resolveTo(BILL);
      await error.retry();

      expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
    });

    it('shows another conflict with its message', async () => {
      client.createBill.and.rejectWith(new ApiError(409, 'Archived', 'ACCOUNT_ARCHIVED'));
      await build().create(VALID, 'BRL');

      expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict', messages: ['Archived'] }));
    });

    describe('destroy', () => {
      it('deletes the bill, closes the confirmation and goes to its provider', async () => {
        await build().destroy(BILL);

        expect(client.deleteBill).toHaveBeenCalledWith(context, 9);
        expect(deps.setConfirming).toHaveBeenCalledWith(false);
        expect(deps.navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/3`);
      });

      it('stays when the session expired', async () => {
        client.deleteBill.and.resolveTo(undefined);
        await build().destroy(BILL);

        expect(deps.navigate).not.toHaveBeenCalled();
      });

      it('tells the user to undo the payment first on a paid bill', async () => {
        client.deleteBill.and.rejectWith(new ApiError(409, 'The bill is paid; undo the payment first', 'BILL_PAID'));
        await build().destroy(BILL);

        expect(deps.setConfirming).toHaveBeenCalledWith(false);
        expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({ messages: [BILL_PAID_MESSAGE] }));
        expect(deps.navigate).not.toHaveBeenCalled();
      });

      it('offers a retry on a transient failure', async () => {
        client.deleteBill.and.rejectWith(new ApiError(500, 'Boom'));
        await build().destroy(BILL);

        client.deleteBill.and.resolveTo({});
        await deps.setSubmitError.calls.mostRecent().args[0].retry();

        expect(client.deleteBill).toHaveBeenCalledTimes(2);
      });
    });
  });
});

describe('BillFormController defaults', () => {
  it('uses the bills client', () => {
    expect(new BillFormController({ context: { kind: 'personal' } }).client).toBe(BillsClient);
  });
});
