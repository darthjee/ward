import BillHistoryController, {
  EMPTY_HISTORY,
} from '../../../../../../../../../assets/js/components/resources/bank/common/bills/controllers/BillHistoryController.js';
import BillsClient from '../../../../../../../../../assets/js/client/BillsClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const DERIVED = {
  id: 1, status: 'paid', due_date: '2026-03-10', bill: null, off_schedule: false,
};
const ONE_OFF = {
  id: 2, status: 'paid', due_date: '2026-03-12', bill: { id: 30, description: 'Repair' }, off_schedule: false,
};

describe('BillHistoryController', () => {
  let client;
  let deps;

  function build(overrides = {}) {
    return new BillHistoryController({ ...deps, client, ...overrides });
  }

  beforeEach(() => {
    client = {
      listBillPayments: jasmine.createSpy('listBillPayments').and.resolveTo({ payments: [DERIVED], pagination: { total_pages: 1 } }),
      undoOccurrencePayment: jasmine.createSpy('undoOccurrencePayment').and.resolveTo({}),
      undoBillPayment: jasmine.createSpy('undoBillPayment').and.resolveTo({}),
    };
    deps = {
      context: CONTEXT,
      accountId: 7,
      setData: jasmine.createSpy('setData'),
      setError: jasmine.createSpy('setError'),
      setPending: jasmine.createSpy('setPending'),
      setConfirmation: jasmine.createSpy('setConfirmation'),
      reload: jasmine.createSpy('reload'),
      onUndone: jasmine.createSpy('onUndone'),
    };
  });

  it('defaults to the bills client and a no-op onUndone', () => {
    const controller = new BillHistoryController({ ...deps, onUndone: undefined });

    expect(controller.client).toBe(BillsClient);
    expect(controller.onUndone()).toBeUndefined();
  });

  describe('load', () => {
    it('loads the requested page', async () => {
      await build().load(2);

      expect(client.listBillPayments).toHaveBeenCalledWith(CONTEXT, 7, 2);
      expect(deps.setData).toHaveBeenCalledWith({ payments: [DERIVED], pagination: { total_pages: 1 } });
    });

    it('shows an empty history on a not-found', async () => {
      client.listBillPayments.and.rejectWith(new ApiError(404, 'Not found'));
      await build().load(1);

      expect(deps.setData).toHaveBeenCalledWith(EMPTY_HISTORY);
    });

    it('reports a failure with a retry that reloads', async () => {
      client.listBillPayments.and.rejectWith(new ApiError(503, 'Down'));
      await build().load(1);

      const error = deps.setError.calls.mostRecent().args[0];

      expect(error.kind).toBe('transient');
      error.retry();

      expect(deps.reload).toHaveBeenCalled();
    });

    it('drops a late answer', async () => {
      await build().load(1, () => false);

      expect(deps.setData).not.toHaveBeenCalled();
    });
  });

  describe('undo', () => {
    it('undoes a derived row through the occurrence route, then reloads', async () => {
      await build().undo(DERIVED);

      expect(client.undoOccurrencePayment).toHaveBeenCalledWith(CONTEXT, 7, '2026-03-10');
      expect(client.undoBillPayment).not.toHaveBeenCalled();
      expect(deps.setPending.calls.allArgs()).toEqual([[true], [false]]);
      expect(deps.setConfirmation).toHaveBeenCalledWith(null);
      expect(deps.reload).toHaveBeenCalled();
      expect(deps.onUndone).toHaveBeenCalled();
    });

    it('undoes a one-off row through the bill route', async () => {
      await build().undo(ONE_OFF);

      expect(client.undoBillPayment).toHaveBeenCalledWith(CONTEXT, 30);
      expect(client.undoOccurrencePayment).not.toHaveBeenCalled();
      expect(deps.reload).toHaveBeenCalled();
    });

    it('does not reload when the session expired', async () => {
      client.undoOccurrencePayment.and.resolveTo(undefined);
      await build().undo(DERIVED);

      expect(deps.reload).not.toHaveBeenCalled();
      expect(deps.setPending).toHaveBeenCalledWith(false);
    });

    it('shows a 404 (already undone) as an alert and reloads', async () => {
      client.undoOccurrencePayment.and.rejectWith(new ApiError(404, 'No payment', 'NOT_FOUND'));
      await build().undo(DERIVED);

      expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict', messages: ['No payment'] }));
      expect(deps.reload).toHaveBeenCalled();
      expect(deps.onUndone).toHaveBeenCalled();
    });

    it('shows a 409 and reloads', async () => {
      client.undoBillPayment.and.rejectWith(new ApiError(409, 'Archived', 'ACCOUNT_ARCHIVED'));
      await build().undo(ONE_OFF);

      expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict', code: 'ACCOUNT_ARCHIVED' }));
      expect(deps.reload).toHaveBeenCalled();
    });

    it('offers a retry on a transient failure, without reloading', async () => {
      client.undoOccurrencePayment.and.rejectWith(new ApiError(500, 'Boom'));
      await build().undo(DERIVED);

      const error = deps.setError.calls.mostRecent().args[0];

      expect(error.kind).toBe('transient');
      expect(deps.reload).not.toHaveBeenCalled();

      client.undoOccurrencePayment.and.resolveTo({});
      await error.retry();

      expect(client.undoOccurrencePayment).toHaveBeenCalledTimes(2);
      expect(deps.reload).toHaveBeenCalled();
    });
  });
});
