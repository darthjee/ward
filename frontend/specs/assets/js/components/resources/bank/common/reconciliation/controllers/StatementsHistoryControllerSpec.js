import StatementsHistoryController, {
  EMPTY_HISTORY,
} from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/controllers/StatementsHistoryController.js';
import BankClient from '../../../../../../../../../assets/js/client/BankClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import sessionExpiredError from '../../../../../../../../support/sessionExpiredError.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const ROW = { id: 4, status: 'finished', undoable: true };

describe('StatementsHistoryController', () => {
  let client;
  let deps;

  function build(overrides = {}) {
    return new StatementsHistoryController({ ...deps, client, ...overrides });
  }

  beforeEach(() => {
    client = {
      listReconciliations: jasmine.createSpy('listReconciliations').and.resolveTo({ reconciliations: [ROW], pagination: { total_pages: 1 } }),
      undoReconciliation: jasmine.createSpy('undoReconciliation').and.resolveTo({}),
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

  it('defaults to the bank client and a no-op onUndone', () => {
    const controller = new StatementsHistoryController({ ...deps, onUndone: undefined });

    expect(controller.client).toBe(BankClient);
    expect(controller.onUndone()).toBeUndefined();
  });

  describe('load', () => {
    it('loads the requested page', async () => {
      await build().load(2);

      expect(client.listReconciliations).toHaveBeenCalledWith(CONTEXT, 7, 2);
      expect(deps.setData).toHaveBeenCalledWith({ reconciliations: [ROW], pagination: { total_pages: 1 } });
    });

    it('shows an empty history on a not-found', async () => {
      client.listReconciliations.and.rejectWith(new ApiError(404, 'Not found'));
      await build().load(1);

      expect(deps.setData).toHaveBeenCalledWith(EMPTY_HISTORY);
    });

    it('reports a failure with a retry that reloads', async () => {
      client.listReconciliations.and.rejectWith(new ApiError(503, 'Down'));
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
    it('undoes the statement, then reloads the history and the account', async () => {
      await build().undo(ROW);

      expect(client.undoReconciliation).toHaveBeenCalledWith(CONTEXT, 7, 4);
      expect(deps.setPending.calls.allArgs()).toEqual([[true], [false]]);
      expect(deps.setConfirmation).toHaveBeenCalledWith(null);
      expect(deps.reload).toHaveBeenCalled();
      expect(deps.onUndone).toHaveBeenCalled();
    });

    it('does not reload when the session expired', async () => {
      client.undoReconciliation.and.rejectWith(sessionExpiredError());
      await build().undo(ROW);

      expect(deps.setError).toHaveBeenCalledTimes(1);
      expect(deps.reload).not.toHaveBeenCalled();
      expect(deps.setPending).toHaveBeenCalledWith(false);
    });

    it('offers a retry on a transient failure, without reloading', async () => {
      client.undoReconciliation.and.rejectWith(new ApiError(500, 'Down'));
      await build().undo(ROW);

      const error = deps.setError.calls.mostRecent().args[0];

      expect(error.kind).toBe('transient');
      expect(deps.reload).not.toHaveBeenCalled();

      client.undoReconciliation.and.resolveTo({});
      await error.retry();

      expect(client.undoReconciliation).toHaveBeenCalledTimes(2);
    });

    ['RECONCILIATION_NOT_LATEST', 'RECONCILIATION_OPEN'].forEach((code) => {
      it(`shows the ${code} message and reloads`, async () => {
        client.undoReconciliation.and.rejectWith(new ApiError(409, 'server', code));
        await build().undo(ROW);

        const error = deps.setError.calls.mostRecent().args[0];

        expect(error.kind).toBe('conflict');
        expect(error.messages[0]).not.toBe('server');
        expect(deps.reload).toHaveBeenCalled();
        expect(deps.onUndone).toHaveBeenCalled();
      });
    });

    it('shows a not-found like a conflict and reloads', async () => {
      client.undoReconciliation.and.rejectWith(new ApiError(404, 'gone', 'NOT_FOUND'));
      await build().undo(ROW);

      expect(deps.setError.calls.mostRecent().args[0].kind).toBe('conflict');
      expect(deps.reload).toHaveBeenCalled();
    });

    it('shows the permission message on a 403', async () => {
      client.undoReconciliation.and.rejectWith(new ApiError(403, 'no', 'FORBIDDEN'));
      await build().undo(ROW);

      expect(deps.setError.calls.mostRecent().args[0].kind).toBe('forbidden');
    });
  });
});
