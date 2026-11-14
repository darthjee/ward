import CalendarActionsController from '../../../../../../../../../assets/js/components/resources/bank/calendar/common/controllers/CalendarActionsController.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const DERIVED = {
  kind: 'debt', source_account: { id: 3, name: 'Loan', type: 'debt' }, bill: null,
  nominal_date: '2026-11-10', effective_date: '2026-11-12', expected_amount: '10.00', currency: 'BRL',
  status: 'open', default_paying_account: { id: 4, name: 'Main' },
};
const BILL = {
  ...DERIVED, kind: 'bill', source_account: { id: 6, name: 'Gym', type: 'provider_expense' }, bill: { id: 9, description: 'Fix' },
};
const ACCOUNTS = [{ id: 4, name: 'Main', currency: 'BRL', type: 'regular' }];

describe('CalendarActionsController', () => {
  let client;
  let billsClient;
  let deps;
  let controller;

  beforeEach(() => {
    client = {
      payOccurrence: jasmine.createSpy('payOccurrence').and.resolveTo({}),
      payBill: jasmine.createSpy('payBill').and.resolveTo({}),
    };
    billsClient = {
      undoOccurrencePayment: jasmine.createSpy('undoOccurrencePayment').and.resolveTo({}),
      undoBillPayment: jasmine.createSpy('undoBillPayment').and.resolveTo({}),
    };
    deps = {
      context: CONTEXT,
      setDialog: jasmine.createSpy('setDialog'),
      setFields: jasmine.createSpy('setFields'),
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setPending: jasmine.createSpy('setPending'),
      setError: jasmine.createSpy('setError'),
      onChanged: jasmine.createSpy('onChanged'),
    };
    controller = new CalendarActionsController({ ...deps, client, billsClient });
  });

  it('opens Pay with the initial fields', () => {
    controller.openPay(DERIVED, ACCOUNTS);

    expect(deps.setFields.calls.mostRecent().args[0].paying_account_id).toEqual('4');
    expect(deps.setDialog).toHaveBeenCalledWith({ type: 'pay', occurrence: DERIVED });
  });

  it('opens a confirmation', () => {
    controller.openConfirm('skip', DERIVED);

    expect(deps.setDialog).toHaveBeenCalledWith({ type: 'skip', occurrence: DERIVED });
  });

  describe('confirmPay', () => {
    const fields = { amount: '10.00', paid_on: '2026-01-01', paying_account_id: '4', record_charge: true };

    it('pays a derived debt by the nominal date, without record_charge', async () => {
      await controller.confirmPay(DERIVED, fields);

      expect(client.payOccurrence).toHaveBeenCalledWith(CONTEXT, 3, '2026-11-10', {
        status: 'paid', paid_on: '2026-01-01', amount: '10.00', paying_account_id: 4,
      });
      expect(deps.setDialog).toHaveBeenCalledWith(null);
      expect(deps.onChanged).toHaveBeenCalled();
    });

    it('pays a bill with record_charge', async () => {
      await controller.confirmPay(BILL, fields);

      expect(client.payBill).toHaveBeenCalledWith(CONTEXT, 9, {
        status: 'paid', paid_on: '2026-01-01', amount: '10.00', paying_account_id: 4, record_charge: true,
      });
    });

    it('does not send an invalid form', async () => {
      await controller.confirmPay(DERIVED, { ...fields, amount: '' });

      expect(client.payOccurrence).not.toHaveBeenCalled();
      expect(deps.setFieldErrors).toHaveBeenCalledWith(jasmine.objectContaining({ amount: jasmine.any(String) }));
    });

    it('closes, shows the conflict and reloads on 409', async () => {
      client.payOccurrence.and.rejectWith(new ApiError(409, 'Already paid', 'OCCURRENCE_ALREADY_PAID'));
      await controller.confirmPay(DERIVED, fields);

      expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict', code: 'OCCURRENCE_ALREADY_PAID' }));
      expect(deps.setDialog).toHaveBeenCalledWith(null);
      expect(deps.onChanged).toHaveBeenCalled();
    });

    it('keeps the dialog open on 400', async () => {
      client.payOccurrence.and.rejectWith(new ApiError(400, 'Bad', 'BAD_REQUEST'));
      await controller.confirmPay(DERIVED, fields);

      expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'validation' }));
      expect(deps.setDialog).not.toHaveBeenCalledWith(null);
      expect(deps.onChanged).not.toHaveBeenCalled();
    });

    it('offers a retry on a transient failure', async () => {
      client.payOccurrence.and.rejectWith(new Error('network'));
      await controller.confirmPay(DERIVED, fields);

      const error = deps.setError.calls.mostRecent().args[0];

      expect(error.kind).toEqual('transient');
      client.payOccurrence.and.resolveTo({});
      await error.retry();

      expect(deps.onChanged).toHaveBeenCalled();
    });

    it('does not reload when the session expired', async () => {
      client.payOccurrence.and.resolveTo(undefined);
      await controller.confirmPay(DERIVED, fields);

      expect(deps.onChanged).not.toHaveBeenCalled();
    });
  });

  describe('confirmSkip', () => {
    it('posts exactly the skipped status to the derived route', async () => {
      await controller.confirmSkip(DERIVED);

      expect(client.payOccurrence).toHaveBeenCalledWith(CONTEXT, 3, '2026-11-10', { status: 'skipped' });
    });

    it('posts it to the bill route for a bill', async () => {
      await controller.confirmSkip(BILL);

      expect(client.payBill).toHaveBeenCalledWith(CONTEXT, 9, { status: 'skipped' });
    });
  });

  describe('confirmUndo', () => {
    it('undoes a derived entry by the nominal date', async () => {
      await controller.confirmUndo({ ...DERIVED, status: 'paid' });

      expect(billsClient.undoOccurrencePayment).toHaveBeenCalledWith(CONTEXT, 3, '2026-11-10');
      expect(deps.onChanged).toHaveBeenCalled();
    });

    it('undoes a bill', async () => {
      await controller.confirmUndo(BILL);

      expect(billsClient.undoBillPayment).toHaveBeenCalledWith(CONTEXT, 9);
    });

    it('shows a 404 as a conflict and reloads', async () => {
      billsClient.undoBillPayment.and.rejectWith(new ApiError(404, 'Gone', 'NOT_FOUND'));
      await controller.confirmUndo(BILL);

      expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict' }));
      expect(deps.onChanged).toHaveBeenCalled();
    });

    it('shows ACCOUNT_ARCHIVED and reloads', async () => {
      billsClient.undoBillPayment.and.rejectWith(new ApiError(409, 'Archived', 'ACCOUNT_ARCHIVED'));
      await controller.confirmUndo(BILL);

      expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ code: 'ACCOUNT_ARCHIVED' }));
      expect(deps.onChanged).toHaveBeenCalled();
    });
  });
});
