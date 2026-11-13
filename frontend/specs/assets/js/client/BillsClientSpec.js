import BillsClient, { BILL_FIELDS } from '../../../../assets/js/client/BillsClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];

const BODY = {
  provider_account_id: 3,
  paying_account_id: 4,
  due_date: '2026-03-10',
  amount: '12.50',
  description: 'Repair',
  notes: null,
};

describe('BillsClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stub(json = {}, status = 200) {
    globalThis.fetch = fetchSequence([{ ok: true, status, json }]);
  }

  function lastCall() {
    const [path, options] = globalThis.fetch.calls.mostRecent().args;

    return { path, method: options.method, body: 'body' in options ? JSON.parse(options.body) : undefined };
  }

  CONTEXTS.forEach(([label, context, prefix]) => {
    describe(`in ${label}`, () => {
      it('fetches one bill', async () => {
        stub({ id: 7 });

        expect(await BillsClient.getBill(context, 7)).toEqual({ id: 7 });
        expect(lastCall()).toEqual({ path: `${prefix}/bank/bills/7.json`, method: 'GET', body: undefined });
      });

      it('creates a bill', async () => {
        stub({ id: 7 }, 201);
        await BillsClient.createBill(context, BODY);

        expect(lastCall()).toEqual({ path: `${prefix}/bank/bills.json`, method: 'POST', body: BODY });
      });

      it('updates a bill', async () => {
        stub({ id: 7 });
        await BillsClient.updateBill(context, 7, { amount: '3.00' });

        expect(lastCall()).toEqual({ path: `${prefix}/bank/bills/7.json`, method: 'PATCH', body: { amount: '3.00' } });
      });

      it('deletes a bill', async () => {
        stub(undefined, 204);
        await BillsClient.deleteBill(context, 7);

        expect(lastCall()).toEqual(jasmine.objectContaining({ path: `${prefix}/bank/bills/7.json`, method: 'DELETE' }));
      });

      it('lists a page of the bill history', async () => {
        stub({ payments: [], pagination: { page: 2 } });

        expect(await BillsClient.listBillPayments(context, 3, 2)).toEqual({ payments: [], pagination: { page: 2 } });
        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/3/bill-payments.json?page=2`, method: 'GET', body: undefined,
        });
      });

      it('undoes a derived occurrence payment', async () => {
        stub(undefined, 204);
        await BillsClient.undoOccurrencePayment(context, 3, '2026-03-10');

        expect(lastCall()).toEqual(jasmine.objectContaining({
          path: `${prefix}/bank/accounts/3/occurrences/2026-03-10/payment.json`, method: 'DELETE',
        }));
      });

      it('undoes a one-off bill payment', async () => {
        stub(undefined, 204);
        await BillsClient.undoBillPayment(context, 7);

        expect(lastCall()).toEqual(jasmine.objectContaining({
          path: `${prefix}/bank/bills/7/payment.json`, method: 'DELETE',
        }));
      });
    });
  });

  it('defaults the bill history to the first page', async () => {
    stub({ payments: [], pagination: {} });
    await BillsClient.listBillPayments({ kind: 'personal' }, 3);

    expect(lastCall().path).toEqual('/bank/accounts/3/bill-payments.json?page=1');
  });

  it('whitelists the bill body, never sending owner or unknown fields', async () => {
    stub({ id: 7 }, 201);
    await BillsClient.createBill({ kind: 'personal' }, {
      ...BODY, user_id: 1, organization_id: 2, id: 9, payment: {},
    });

    expect(lastCall().body).toEqual(BODY);
  });

  it('drops undefined fields on update', async () => {
    stub({ id: 7 });
    await BillsClient.updateBill({ kind: 'personal' }, 7, { description: 'X', notes: undefined });

    expect(lastCall().body).toEqual({ description: 'X' });
  });

  it('exposes the bill fields', () => {
    expect(BILL_FIELDS).toEqual([
      'provider_account_id', 'paying_account_id', 'due_date', 'amount', 'description', 'notes',
    ]);
  });
});
