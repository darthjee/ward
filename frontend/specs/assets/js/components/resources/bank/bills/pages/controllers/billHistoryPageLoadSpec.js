import { buildBillHistoryPageLoadEffect } from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/controllers/billHistoryPageLoad.js';
import BankClient from '../../../../../../../../../assets/js/client/BankClient.js';
import ProviderBillsClient from '../../../../../../../../../assets/js/client/ProviderBillsClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { flushMicrotasks } from '../../../../../../../../support/flushMicrotasks.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const BILL = { id: 9, provider_account_id: 3, description: 'Internet' };
const PROVIDER = { id: 3, name: 'Vivo', currency: 'BRL', archived_at: null };

describe('billHistoryPageLoad', () => {
  let clients;
  let callbacks;

  beforeEach(() => {
    clients = {
      bills: { getProviderBill: jasmine.createSpy('getProviderBill').and.resolveTo(BILL) },
      bank: { getAccount: jasmine.createSpy('getAccount').and.resolveTo(PROVIDER) },
    };
    callbacks = {
      onLoaded: jasmine.createSpy('onLoaded'),
      onNotFound: jasmine.createSpy('onNotFound'),
      onError: jasmine.createSpy('onError'),
    };
  });

  it('loads the bill, then its provider', async () => {
    buildBillHistoryPageLoadEffect(CONTEXT, '9', callbacks, clients)();
    await flushMicrotasks();

    expect(clients.bills.getProviderBill).toHaveBeenCalledWith(CONTEXT, '9');
    expect(clients.bank.getAccount).toHaveBeenCalledWith(CONTEXT, 3);
    expect(callbacks.onLoaded).toHaveBeenCalledWith({ bill: BILL, provider: PROVIDER });
  });

  it('reports Not-found when the bill is missing', async () => {
    clients.bills.getProviderBill.and.rejectWith(new ApiError(404, 'Not found'));
    buildBillHistoryPageLoadEffect(CONTEXT, '9', callbacks, clients)();
    await flushMicrotasks();

    expect(callbacks.onNotFound).toHaveBeenCalled();
    expect(clients.bank.getAccount).not.toHaveBeenCalled();
  });

  it('reports Not-found when the provider is missing', async () => {
    clients.bank.getAccount.and.rejectWith(new ApiError(404, 'Not found'));
    buildBillHistoryPageLoadEffect(CONTEXT, '9', callbacks, clients)();
    await flushMicrotasks();

    expect(callbacks.onNotFound).toHaveBeenCalled();
  });

  it('reports other failures', async () => {
    clients.bills.getProviderBill.and.rejectWith(new ApiError(503, 'Down'));
    buildBillHistoryPageLoadEffect(CONTEXT, '9', callbacks, clients)();
    await flushMicrotasks();

    expect(callbacks.onError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'transient' }));
  });

  it('reports nothing when the session expired', async () => {
    clients.bills.getProviderBill.and.resolveTo(undefined);
    buildBillHistoryPageLoadEffect(CONTEXT, '9', callbacks, clients)();
    await flushMicrotasks();

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();

    clients.bills.getProviderBill.and.resolveTo(BILL);
    clients.bank.getAccount.and.resolveTo(undefined);
    buildBillHistoryPageLoadEffect(CONTEXT, '9', callbacks, clients)();
    await flushMicrotasks();

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
  });

  it('defaults to the provider bills and bank clients', async () => {
    spyOn(ProviderBillsClient, 'getProviderBill').and.resolveTo(BILL);
    spyOn(BankClient, 'getAccount').and.resolveTo(PROVIDER);
    buildBillHistoryPageLoadEffect(CONTEXT, '9', callbacks)();
    await flushMicrotasks();

    expect(callbacks.onLoaded).toHaveBeenCalled();
  });
});
