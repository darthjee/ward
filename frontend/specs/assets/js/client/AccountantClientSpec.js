import AccountantClient from '../../../../assets/js/client/AccountantClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];

describe('AccountantClient', () => {
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
      it('lists the unsent charges of a range', async () => {
        stub({ charges: [{ id: 1 }] });

        expect(await AccountantClient.listCharges(context, { from: '2026-02-01', to: '2026-02-28', includeSent: false }))
          .toEqual({ charges: [{ id: 1 }] });
        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accountant/charges.json?from=2026-02-01&to=2026-02-28&include_sent=false`,
          method: 'GET',
          body: undefined,
        });
      });

      it('includes the sent charges when asked', async () => {
        stub({ charges: [] });
        await AccountantClient.listCharges(context, { from: '2026-02-01', to: '2026-02-28', includeSent: true });

        expect(lastCall().path).toEqual(`${prefix}/bank/accountant/charges.json?from=2026-02-01&to=2026-02-28&include_sent=true`);
      });

      it('marks charges as sent with only the transaction ids', async () => {
        stub({ charges: [{ id: 1, sent_to_accountant_at: '2026-03-01T00:00:00Z' }] });
        await AccountantClient.markSent(context, [1, 2]);

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accountant/mark-sent.json`, method: 'POST', body: { transaction_ids: [1, 2] },
        });
      });

      it('marks charges as unsent with only the transaction ids', async () => {
        stub({ charges: [{ id: 1, sent_to_accountant_at: null }] });
        await AccountantClient.markUnsent(context, [1]);

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accountant/mark-unsent.json`, method: 'POST', body: { transaction_ids: [1] },
        });
      });
    });
  });

  it('defaults to unsent charges only', async () => {
    stub({ charges: [] });
    await AccountantClient.listCharges({ kind: 'personal' }, { from: '2026-02-01', to: '2026-02-28' });

    expect(lastCall().path).toContain('include_sent=false');
  });

  it('sends an empty id list for missing ids', async () => {
    stub({ charges: [] });
    await AccountantClient.markSent({ kind: 'personal' }, undefined);

    expect(lastCall().body).toEqual({ transaction_ids: [] });
  });
});
