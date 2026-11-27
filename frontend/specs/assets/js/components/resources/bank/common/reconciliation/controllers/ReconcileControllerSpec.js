import ReconcileController, {
  INITIAL_RECONCILE,
} from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/controllers/ReconcileController.js';
import BankClient from '../../../../../../../../../assets/js/client/BankClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import sessionExpiredError from '../../../../../../../../support/sessionExpiredError.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const ACCOUNT = {
  id: 7, type: 'regular', currency: 'BRL', opening_date: '2026-01-01', open_reconciliation_id: null,
};
const STATEMENT = {
  id: 4, status: 'open', statement_date: '2026-03-31', statement_balance: '100.00', difference: '40.00',
};
describe('ReconcileController', () => {
  let client;
  let state;
  let reload;

  function setReconcile(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  }

  function build(account = ACCOUNT) {
    return new ReconcileController({
      context: CONTEXT, accountId: 7, account, setReconcile, reload, client,
    });
  }

  function active(extra = {}) {
    state = { ...INITIAL_RECONCILE, mode: 'active', statement: STATEMENT, ticked: new Map(), ...extra };
  }

  beforeEach(() => {
    state = { ...INITIAL_RECONCILE, ticked: new Map() };
    reload = jasmine.createSpy('reload');
    client = {
      getReconciliation: jasmine.createSpy('getReconciliation').and.resolveTo(STATEMENT),
      startReconciliation: jasmine.createSpy('startReconciliation').and.resolveTo(STATEMENT),
      updateReconciliation: jasmine.createSpy('updateReconciliation').and.resolveTo(STATEMENT),
      cancelReconciliation: jasmine.createSpy('cancelReconciliation').and.resolveTo({}),
      tickTransactions: jasmine.createSpy('tickTransactions').and.resolveTo({ ...STATEMENT, difference: '10.00' }),
      finishReconciliation: jasmine.createSpy('finishReconciliation').and.resolveTo({}),
    };
  });

  it('defaults to the bank client', () => {
    expect(new ReconcileController({ context: CONTEXT, accountId: 7, account: ACCOUNT, setReconcile, reload }).client)
      .toBe(BankClient);
  });

  describe('open', () => {
    it('opens the start form when no statement is open', async () => {
      await build().open();

      expect(state.mode).toBe('form');
      expect(state.formKind).toBe('start');
      expect(state.fields.statement_balance).toBe('');
      expect(client.getReconciliation).not.toHaveBeenCalled();
    });

    it('fetches the open statement and goes active', async () => {
      await build({ ...ACCOUNT, open_reconciliation_id: 4 }).open();

      expect(client.getReconciliation).toHaveBeenCalledWith(CONTEXT, 7, 4);
      expect(state.mode).toBe('active');
      expect(state.statement).toBe(STATEMENT);
    });

    it('shows a failure to fetch', async () => {
      client.getReconciliation.and.rejectWith(new ApiError(404, 'gone', 'NOT_FOUND'));
      await build({ ...ACCOUNT, open_reconciliation_id: 4 }).open();

      expect(state.mode).toBe('off');
      expect(state.error.kind).toBe('conflict');
      expect(state.pending).toBeFalse();
    });
  });

  describe('forms', () => {
    it('opens the edit form prefilled', () => {
      build().openEdit(STATEMENT);

      expect(state.formKind).toBe('edit');
      expect(state.fields).toEqual({ statement_date: '2026-03-31', statement_balance: '100.00' });
    });

    it('closes a start form out of the mode, without a request', () => {
      state = { ...state, mode: 'form' };
      build().closeForm(null);

      expect(state.mode).toBe('off');
      expect(client.startReconciliation).not.toHaveBeenCalled();
    });

    it('closes an edit form back to the statement', () => {
      build().closeForm(STATEMENT);

      expect(state.mode).toBe('active');
    });

    it('changes a field', () => {
      state = { ...state, fields: { statement_date: 'a', statement_balance: '' } };
      build().changeField('statement_balance', '5');

      expect(state.fields).toEqual({ statement_date: 'a', statement_balance: '5' });
    });
  });

  describe('submitForm', () => {
    it('rejects an invalid balance without a request', async () => {
      await build().submitForm({ formKind: 'start', fields: { statement_date: '2026-03-31', statement_balance: 'x' }, statement: null });

      expect(state.fieldErrors.statement_balance).toBeDefined();
      expect(client.startReconciliation).not.toHaveBeenCalled();
    });

    it('starts with exactly the two keys, goes active and reloads', async () => {
      await build().submitForm({
        formKind: 'start', fields: { statement_date: '2026-03-31', statement_balance: '100,00', x: 1 }, statement: null,
      });

      expect(client.startReconciliation).toHaveBeenCalledWith(CONTEXT, 7, {
        statement_date: '2026-03-31', statement_balance: '100.00',
      });
      expect(state.mode).toBe('active');
      expect(state.statement).toBe(STATEMENT);
      expect(reload).toHaveBeenCalled();
    });

    it('edits the open statement', async () => {
      await build().submitForm({
        formKind: 'edit', fields: { statement_date: '2026-03-30', statement_balance: '90' }, statement: STATEMENT,
      });

      expect(client.updateReconciliation).toHaveBeenCalledWith(CONTEXT, 7, 4, {
        statement_date: '2026-03-30', statement_balance: '90',
      });
      expect(state.mode).toBe('active');
      expect(reload).not.toHaveBeenCalled();
    });

    it('negates a debt balance on submit', async () => {
      await build({ ...ACCOUNT, type: 'debt' }).submitForm({
        formKind: 'start', fields: { statement_date: '2026-03-31', statement_balance: '300' }, statement: null,
      });

      expect(client.startReconciliation.calls.mostRecent().args[2].statement_balance).toBe('-300');
    });

    ['RECONCILIATION_OUT_OF_ORDER', 'RECONCILIATION_FINISHED'].forEach((code) => {
      it(`keeps the form and shows the ${code} message`, async () => {
        client.updateReconciliation.and.rejectWith(new ApiError(409, 'server', code));
        state = { ...state, mode: 'form', formKind: 'edit' };
        await build().submitForm({
          formKind: 'edit', fields: { statement_date: '2026-03-30', statement_balance: '90' }, statement: STATEMENT,
        });

        expect(state.mode).toBe('form');
        expect(state.error.messages[0]).not.toBe('server');
        expect(state.error.code).toBe(code);
        expect(state.pending).toBeFalse();
      });
    });

    it('shows nothing for an expired session', async () => {
      client.startReconciliation.and.rejectWith(sessionExpiredError());
      await build().submitForm({
        formKind: 'start', fields: { statement_date: '2026-03-31', statement_balance: '1' }, statement: null,
      });

      expect(state.error).toBeNull();
      expect(state.pending).toBeFalse();
    });
  });

  describe('toggleOnlyUncleared', () => {
    it('flips the filter without a request', () => {
      active();
      build().toggleOnlyUncleared();

      expect(state.onlyUncleared).toBeTrue();
      expect(client.tickTransactions).not.toHaveBeenCalled();
      expect(client.getReconciliation).not.toHaveBeenCalled();
    });
  });

  describe('finish', () => {
    it('leaves the mode, reloads and bumps the history', async () => {
      active({ onlyUncleared: true });
      await build().finish(STATEMENT);

      expect(client.finishReconciliation).toHaveBeenCalledWith(CONTEXT, 7, 4);
      expect(state.mode).toBe('off');
      expect(state.statement).toBeNull();
      expect(state.onlyUncleared).toBeFalse();
      expect(state.historyVersion).toBe(1);
      expect(reload).toHaveBeenCalled();
    });

    it('shows the unbalanced message and stays', async () => {
      active();
      client.finishReconciliation.and.rejectWith(new ApiError(409, 'server', 'RECONCILIATION_UNBALANCED'));
      await build().finish(STATEMENT);

      expect(state.mode).toBe('active');
      expect(state.error.messages).toEqual(['The difference must be 0 to finish.']);
      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('opens and dismisses the confirmation without a request', () => {
      active();
      const controller = build();

      controller.requestCancel();
      expect(state.cancelConfirm).toBeTrue();

      controller.dismissCancel();
      expect(state.cancelConfirm).toBeFalse();
      expect(client.cancelReconciliation).not.toHaveBeenCalled();
    });

    it('confirming sends the DELETE, leaves the mode and reloads', async () => {
      active({ cancelConfirm: true });
      await build().confirmCancel(STATEMENT);

      expect(client.cancelReconciliation).toHaveBeenCalledWith(CONTEXT, 7, 4);
      expect(state.mode).toBe('off');
      expect(state.cancelConfirm).toBeFalse();
      expect(state.historyVersion).toBe(1);
      expect(reload).toHaveBeenCalled();
    });

    it('shows the permission message on a 403 and closes the confirmation', async () => {
      active({ cancelConfirm: true });
      client.cancelReconciliation.and.rejectWith(new ApiError(403, 'no', 'FORBIDDEN'));
      await build().confirmCancel(STATEMENT);

      expect(state.mode).toBe('active');
      expect(state.cancelConfirm).toBeFalse();
      expect(state.error.kind).toBe('forbidden');
    });
  });

  describe('housekeeping', () => {
    it('clears the overlay when the ledger reloads', () => {
      active({ ticked: new Map([[1, true]]) });
      build().onLedgerReloaded();

      expect(state.ticked.size).toBe(0);
    });

    it('resets the mode, keeping the history version', () => {
      active({ historyVersion: 3, ticked: new Map([[1, true]]) });
      build().resetMode();

      expect(state.mode).toBe('off');
      expect(state.statement).toBeNull();
      expect(state.ticked.size).toBe(0);
      expect(state.historyVersion).toBe(3);
    });

    it('dismisses the error', () => {
      active({ error: { kind: 'conflict' } });
      build().dismissError();

      expect(state.error).toBeNull();
    });
  });
});
