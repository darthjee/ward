import ReconcileTicker from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/controllers/ReconcileTicker.js';
import { INITIAL_RECONCILE } from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/controllers/ReconcileController.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const ACCOUNT = {
  id: 7, type: 'regular', currency: 'BRL', opening_date: '2026-01-01', open_reconciliation_id: null,
};
const STATEMENT = {
  id: 4, status: 'open', statement_date: '2026-03-31', statement_balance: '100.00', difference: '40.00',
};
const ROWS = [
  { id: 1, date: '2026-02-01', reconciliation: null },
  { id: 2, date: '2026-02-02', reconciliation: { id: 4 } },
  { id: 3, date: '2026-04-02', reconciliation: null },
  { id: 5, date: '2026-02-03', reconciliation: { id: 1 } },
];

describe('ReconcileTicker', () => {
  let client;
  let state;

  function setReconcile(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  }

  function build() {
    return new ReconcileTicker({
      context: CONTEXT, accountId: 7, account: ACCOUNT, setReconcile, client,
    });
  }

  function active(extra = {}) {
    state = { ...INITIAL_RECONCILE, mode: 'active', statement: STATEMENT, ticked: new Map(), ...extra };
  }

  beforeEach(() => {
    client = {
      tickTransactions: jasmine.createSpy('tickTransactions').and.resolveTo({ ...STATEMENT, difference: '10.00' }),
    };
  });

  describe('toggle', () => {
    it('ticks optimistically and takes the difference from the response', async () => {
      active();
      await build().toggle(ROWS[0], state);

      expect(client.tickTransactions).toHaveBeenCalledWith(CONTEXT, 7, 4, { tick: [1] });
      expect(state.ticked.get(1)).toBeTrue();
      expect(state.statement.difference).toBe('10.00');
    });

    it('unticks a ticked row', async () => {
      active();
      await build().toggle(ROWS[1], state);

      expect(client.tickTransactions).toHaveBeenCalledWith(CONTEXT, 7, 4, { untick: [2] });
      expect(state.ticked.get(2)).toBeFalse();
    });

    it('flips the checkbox before the answer arrives', async () => {
      active();
      let seen;

      client.tickTransactions.and.callFake(() => {
        seen = state.ticked.get(1);
        return Promise.resolve(STATEMENT);
      });
      await build().toggle(ROWS[0], state);

      expect(seen).toBeTrue();
    });

    ['TRANSACTION_NOT_ELIGIBLE', 'RECONCILIATION_FINISHED'].forEach((code) => {
      it(`reverts the checkbox and the difference on ${code}`, async () => {
        active();
        client.tickTransactions.and.rejectWith(new ApiError(409, 'server', code));
        await build().toggle(ROWS[0], state);

        expect(state.ticked.has(1)).toBeFalse();
        expect(state.statement).toBe(STATEMENT);
        expect(state.error.code).toBe(code);
        expect(state.error.messages[0]).not.toBe('server');
      });
    });

    it('restores an earlier overlay entry on error', async () => {
      active({ ticked: new Map([[2, true]]) });
      client.tickTransactions.and.rejectWith(new ApiError(500, 'down'));
      await build().toggle(ROWS[1], state);

      expect(state.ticked.get(2)).toBeTrue();
      expect(state.error.kind).toBe('transient');
    });
  });

  describe('bulk ticks', () => {
    it('ticks every unticked eligible row in one call', async () => {
      active();
      await build().tickAll(ROWS, state);

      expect(client.tickTransactions).toHaveBeenCalledTimes(1);
      expect(client.tickTransactions).toHaveBeenCalledWith(CONTEXT, 7, 4, { tick: [1] });
    });

    it('unticks every ticked eligible row in one call', async () => {
      active();
      await build().untickAll(ROWS, state);

      expect(client.tickTransactions).toHaveBeenCalledTimes(1);
      expect(client.tickTransactions).toHaveBeenCalledWith(CONTEXT, 7, 4, { untick: [2] });
    });

    it('sends nothing for an empty set', async () => {
      active();
      await build().tickAll([ROWS[2], ROWS[3]], state);
      await build().untickAll([ROWS[0]], state);

      expect(client.tickTransactions).not.toHaveBeenCalled();
    });

    it('reverts every row on error', async () => {
      active();
      client.tickTransactions.and.rejectWith(new ApiError(500, 'down'));
      await build().tickAll(ROWS, state);

      expect(state.ticked.size).toBe(0);
    });
  });
});
