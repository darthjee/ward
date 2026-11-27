import ReconciliationsClient from '../../../../assets/js/client/ReconciliationsClient.js';
import BankClient from '../../../../assets/js/client/BankClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];

const FORBIDDEN = { id: 9, status: 'finished', account_id: 3, reconciled_at: '2026-01-01' };
const STATEMENT = { statement_date: '2026-03-31', statement_balance: '-10.50' };

describe('ReconciliationsClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stub(json = {}) {
    globalThis.fetch = fetchSequence([{ ok: true, status: 200, json }]);
  }

  function lastCall() {
    const [path, options] = globalThis.fetch.calls.mostRecent().args;

    return { path, method: options.method, body: 'body' in options ? JSON.parse(options.body) : undefined };
  }

  CONTEXTS.forEach(([label, context, prefix]) => {
    describe(`in ${label}`, () => {
      const base = `${prefix}/bank/accounts/3/reconciliations`;

      it('lists a page of statements', async () => {
        stub({ reconciliations: [] });
        await ReconciliationsClient.listReconciliations(context, 3, 2);

        expect(lastCall()).toEqual({ path: `${base}.json?page=2`, method: 'GET', body: undefined });
      });

      it('lists the first page by default', async () => {
        stub({});
        await ReconciliationsClient.listReconciliations(context, 3);

        expect(lastCall().path).toBe(`${base}.json?page=1`);
      });

      it('starts a statement with whitelisted fields', async () => {
        stub({ id: 1 });
        await ReconciliationsClient.startReconciliation(context, 3, { ...STATEMENT, ...FORBIDDEN });

        expect(lastCall()).toEqual({ path: `${base}.json`, method: 'POST', body: STATEMENT });
      });

      it('fetches a statement', async () => {
        stub({ id: 4 });
        await ReconciliationsClient.getReconciliation(context, 3, 4);

        expect(lastCall()).toEqual({ path: `${base}/4.json`, method: 'GET', body: undefined });
      });

      it('edits a statement with whitelisted fields', async () => {
        stub({ id: 4 });
        await ReconciliationsClient.updateReconciliation(context, 3, 4, { ...STATEMENT, ...FORBIDDEN });

        expect(lastCall()).toEqual({ path: `${base}/4.json`, method: 'PATCH', body: STATEMENT });
      });

      it('cancels a statement', async () => {
        stub({});
        await ReconciliationsClient.cancelReconciliation(context, 3, 4);

        expect(lastCall()).toEqual({ path: `${base}/4.json`, method: 'DELETE', body: undefined });
      });

      it('ticks and unticks with whitelisted fields', async () => {
        stub({ id: 4 });
        await ReconciliationsClient.tickTransactions(context, 3, 4, { tick: [1], untick: [2], ...FORBIDDEN });

        expect(lastCall()).toEqual({ path: `${base}/4/ticks.json`, method: 'PATCH', body: { tick: [1], untick: [2] } });
      });

      it('finishes a statement', async () => {
        stub({ id: 4 });
        await ReconciliationsClient.finishReconciliation(context, 3, 4);

        expect(lastCall()).toEqual({ path: `${base}/4/finish.json`, method: 'POST', body: {} });
      });

      it('undoes a statement', async () => {
        stub({ id: 4 });
        await ReconciliationsClient.undoReconciliation(context, 3, 4);

        expect(lastCall()).toEqual({ path: `${base}/4/undo.json`, method: 'POST', body: {} });
      });
    });
  });

  [
    'listReconciliations', 'startReconciliation', 'getReconciliation', 'updateReconciliation',
    'cancelReconciliation', 'tickTransactions', 'finishReconciliation', 'undoReconciliation',
  ].forEach((method) => {
    it(`${method} is exposed through BankClient`, () => {
      expect(BankClient[method]).toBe(ReconciliationsClient[method]);
    });
  });
});
