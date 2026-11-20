import ProviderBillsClient, { PROVIDER_BILL_FIELDS } from '../../../../assets/js/client/ProviderBillsClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];

describe('ProviderBillsClient', () => {
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
      it('lists a page of bills', async () => {
        stub({ provider_bills: [], pagination: {} });
        await ProviderBillsClient.listProviderBills(context, 3, 2);

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/3/provider-bills.json?page=2`, method: 'GET', body: undefined,
        });
      });

      it('filters the bills by kind when given', async () => {
        stub({ provider_bills: [], pagination: {} });
        await ProviderBillsClient.listProviderBills(context, 3, 1, 'recurring');

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/3/provider-bills.json?page=1&kind=recurring`, method: 'GET', body: undefined,
        });
      });

      it('fetches one bill', async () => {
        stub({ id: 7 });

        expect(await ProviderBillsClient.getProviderBill(context, 7)).toEqual({ id: 7 });
        expect(lastCall()).toEqual({ path: `${prefix}/bank/provider-bills/7.json`, method: 'GET', body: undefined });
      });

      it('creates a bill', async () => {
        stub({ id: 7 }, 201);
        await ProviderBillsClient.createProviderBill(context, 3, { kind: 'one_off', description: 'X', id: 1 });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/3/provider-bills.json`,
          method: 'POST',
          body: { kind: 'one_off', description: 'X' },
        });
      });

      it('updates a bill without sending the kind', async () => {
        stub({ id: 7 });
        await ProviderBillsClient.updateProviderBill(context, 7, { kind: 'recurring', notes: 'n' });

        expect(lastCall()).toEqual({ path: `${prefix}/bank/provider-bills/7.json`, method: 'PATCH', body: { notes: 'n' } });
      });

      it('lists a page of the bill history', async () => {
        stub({ payments: [], pagination: {} });
        await ProviderBillsClient.listBillPayments(context, 7, 2);

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/provider-bills/7/bill-payments.json?page=2`, method: 'GET', body: undefined,
        });
      });

      it('pays an occurrence with a whitelisted body', async () => {
        stub({ id: 1 }, 201);
        await ProviderBillsClient.payOccurrence(context, 7, '2026-03-10', {
          status: 'paid', paid_on: '2026-03-11', amount: '5.00', other: 1,
        });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/provider-bills/7/occurrences/2026-03-10/payment.json`,
          method: 'POST',
          body: { status: 'paid', paid_on: '2026-03-11', amount: '5.00' },
        });
      });

      it('undoes an occurrence payment', async () => {
        stub(undefined, 204);
        await ProviderBillsClient.undoOccurrencePayment(context, 7, '2026-03-10');

        expect(lastCall()).toEqual(jasmine.objectContaining({
          path: `${prefix}/bank/provider-bills/7/occurrences/2026-03-10/payment.json`, method: 'DELETE',
        }));
      });

      it('deletes a bill', async () => {
        stub(undefined, 204);
        await ProviderBillsClient.deleteProviderBill(context, 7);

        expect(lastCall()).toEqual(jasmine.objectContaining({ path: `${prefix}/bank/provider-bills/7.json`, method: 'DELETE' }));
      });
    });
  });

  it('defaults to the first page', async () => {
    stub({ provider_bills: [], pagination: {} });
    await ProviderBillsClient.listProviderBills({ kind: 'personal' }, 3);

    expect(lastCall().path).toEqual('/bank/accounts/3/provider-bills.json?page=1');
  });

  it('defaults the history to the first page', async () => {
    stub({ payments: [], pagination: {} });
    await ProviderBillsClient.listBillPayments({ kind: 'personal' }, 7);

    expect(lastCall().path).toEqual('/bank/provider-bills/7/bill-payments.json?page=1');
  });

  it('exposes the bill fields', () => {
    expect(PROVIDER_BILL_FIELDS).toContain('expected_amount');
  });
});
