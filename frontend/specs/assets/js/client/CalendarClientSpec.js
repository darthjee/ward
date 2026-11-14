import CalendarClient, { paymentBody, SKIP_BODY } from '../../../../assets/js/client/CalendarClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];

const FIELDS = {
  paid_on: '2026-11-10', amount: '10.00', paying_account_id: 4, record_charge: true, junk: 1,
};

describe('CalendarClient', () => {
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

  describe('paymentBody', () => {
    it('sends record_charge for providers and bills', () => {
      ['provider', 'bill'].forEach((kind) => {
        expect(paymentBody({ kind }, FIELDS)).toEqual({
          status: 'paid', paid_on: '2026-11-10', amount: '10.00', paying_account_id: 4, record_charge: true,
        });
      });
    });

    it('drops record_charge for debts', () => {
      expect(paymentBody({ kind: 'debt' }, FIELDS).record_charge).toBeUndefined();
    });

    it('skip body has only the status', () => {
      expect(SKIP_BODY).toEqual({ status: 'skipped' });
    });
  });

  CONTEXTS.forEach(([label, context, prefix]) => {
    describe(`in ${label}`, () => {
      it('gets the calendar', async () => {
        stub({ occurrences: [], totals: [] });

        expect(await CalendarClient.getCalendar(context, '2026-11-01', '2026-11-30'))
          .toEqual({ occurrences: [], totals: [] });
        expect(lastCall()).toEqual({
          path: `${prefix}/bank/calendar.json?from=2026-11-01&to=2026-11-30`, method: 'GET', body: undefined,
        });
      });

      it('gets the overdue', async () => {
        stub({ occurrences: [], totals: [] });
        await CalendarClient.getOverdue(context);

        expect(lastCall()).toEqual({ path: `${prefix}/bank/calendar/overdue.json`, method: 'GET', body: undefined });
      });

      it('pays a derived occurrence with the whitelisted body', async () => {
        stub({}, 201);
        await CalendarClient.payOccurrence(context, 3, '2026-11-10', { status: 'paid', ...FIELDS });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/3/occurrences/2026-11-10/payment.json`,
          method: 'POST',
          body: { status: 'paid', paid_on: '2026-11-10', amount: '10.00', paying_account_id: 4, record_charge: true },
        });
      });

      it('skips a derived occurrence', async () => {
        stub({}, 201);
        await CalendarClient.payOccurrence(context, 3, '2026-11-10', SKIP_BODY);

        expect(lastCall().body).toEqual({ status: 'skipped' });
      });

      it('pays a bill', async () => {
        stub({}, 201);
        await CalendarClient.payBill(context, 9, SKIP_BODY);

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/bills/9/payment.json`, method: 'POST', body: { status: 'skipped' },
        });
      });

      it('propagates ApiError', async () => {
        globalThis.fetch = fetchSequence([{ ok: false, status: 409, json: { error: 'OCCURRENCE_ALREADY_PAID' } }]);

        await expectAsync(CalendarClient.payBill(context, 9, SKIP_BODY)).toBeRejectedWithError(ApiError);
      });
    });
  });
});
