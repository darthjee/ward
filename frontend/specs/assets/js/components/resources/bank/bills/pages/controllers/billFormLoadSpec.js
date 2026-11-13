import {
  buildBillFormLoadEffect,
  mergeLoadedBill,
} from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/controllers/billFormLoad.js';
import BankClient from '../../../../../../../../../assets/js/client/BankClient.js';
import BillsClient from '../../../../../../../../../assets/js/client/BillsClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { flushMicrotasks } from '../../../../../../../../support/flushMicrotasks.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const PROVIDERS = [{ id: 3, name: 'Plumber', currency: 'BRL' }];
const ACCOUNTS = [{ id: 1, name: 'Main', currency: 'BRL' }];
const BILL = { id: 9, provider_account: { id: 3 }, paying_account: { id: 1 }, due_date: '2026-03-10' };

describe('billFormLoad', () => {
  let clients;
  let callbacks;

  beforeEach(() => {
    clients = {
      bank: {
        listAccounts: jasmine.createSpy('listAccounts').and.callFake((_context, { type }) => Promise.resolve(
          type === 'regular' ? ACCOUNTS : PROVIDERS,
        )),
      },
      bills: { getBill: jasmine.createSpy('getBill').and.resolveTo(BILL) },
    };
    callbacks = {
      onLoaded: jasmine.createSpy('onLoaded'),
      onNotFound: jasmine.createSpy('onNotFound'),
      onError: jasmine.createSpy('onError'),
    };
  });

  describe('buildBillFormLoadEffect', () => {
    it('loads the non-archived providers and regular accounts on the new page', async () => {
      buildBillFormLoadEffect(CONTEXT, null, callbacks, clients)();
      await flushMicrotasks();

      expect(clients.bank.listAccounts).toHaveBeenCalledWith(CONTEXT, { type: 'provider_expense' });
      expect(clients.bank.listAccounts).toHaveBeenCalledWith(CONTEXT, { type: 'regular' });
      expect(clients.bills.getBill).not.toHaveBeenCalled();
      expect(callbacks.onLoaded).toHaveBeenCalledWith({ providers: PROVIDERS, accounts: ACCOUNTS, bill: null });
    });

    it('also loads the bill on the edit page', async () => {
      buildBillFormLoadEffect(CONTEXT, '9', callbacks, clients)();
      await flushMicrotasks();

      expect(clients.bills.getBill).toHaveBeenCalledWith(CONTEXT, '9');
      expect(callbacks.onLoaded).toHaveBeenCalledWith({ providers: PROVIDERS, accounts: ACCOUNTS, bill: BILL });
    });

    it('reports a 404 bill as not-found', async () => {
      clients.bills.getBill.and.rejectWith(new ApiError(404, 'Not found'));
      buildBillFormLoadEffect(CONTEXT, '9', callbacks, clients)();
      await flushMicrotasks();

      expect(callbacks.onNotFound).toHaveBeenCalled();
    });

    it('reports nothing when the session expired', async () => {
      clients.bills.getBill.and.resolveTo(undefined);
      buildBillFormLoadEffect(CONTEXT, '9', callbacks, clients)();
      await flushMicrotasks();

      expect(callbacks.onLoaded).not.toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('reports a failure', async () => {
      clients.bank.listAccounts.and.rejectWith(new ApiError(503, 'Down'));
      buildBillFormLoadEffect(CONTEXT, null, callbacks, clients)();
      await flushMicrotasks();

      expect(callbacks.onError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'transient' }));
    });

    it('defaults to the bank and bills clients', async () => {
      spyOn(BankClient, 'listAccounts').and.resolveTo([]);
      spyOn(BillsClient, 'getBill').and.resolveTo(BILL);
      buildBillFormLoadEffect(CONTEXT, '9', callbacks)();
      await flushMicrotasks();

      expect(BillsClient.getBill).toHaveBeenCalled();
      expect(callbacks.onLoaded).toHaveBeenCalled();
    });
  });

  describe('mergeLoadedBill', () => {
    it('fills the edit form from the bill on the first load', () => {
      expect(mergeLoadedBill(null, { providers: PROVIDERS, bill: BILL })).toEqual(jasmine.objectContaining({
        provider_account_id: '3', paying_account_id: '1',
      }));
    });

    it('keeps the user values on a reload', () => {
      const fields = { provider_account_id: '3', amount: 'typed' };

      expect(mergeLoadedBill(fields, { providers: PROVIDERS, bill: BILL })).toBe(fields);
    });

    it('keeps a pre-selected provider that is offered', () => {
      const fields = { provider_account_id: '3' };

      expect(mergeLoadedBill(fields, { providers: PROVIDERS, bill: null })).toBe(fields);
    });

    it('drops a pre-selected provider that is not offered (archived or unknown)', () => {
      expect(mergeLoadedBill({ provider_account_id: '99' }, { providers: PROVIDERS, bill: null }))
        .toEqual({ provider_account_id: '' });
    });

    it('keeps an empty or missing form as-is', () => {
      const fields = { provider_account_id: '' };

      expect(mergeLoadedBill(fields, { providers: PROVIDERS, bill: null })).toBe(fields);
      expect(mergeLoadedBill(null, { providers: PROVIDERS, bill: null })).toBeNull();
    });
  });
});
