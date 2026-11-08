import LedgerFormController from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/controllers/LedgerFormController.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const VALUES = {
  date: '2000-01-01', direction: 'out', amount: '12,50', description: 'Coffee', notes: '',
};
const TRANSACTION = { id: 3, description: 'Old', amount: '-1.00' };

describe('LedgerFormController', () => {
  let deps;
  let controller;

  beforeEach(() => {
    deps = {
      context: { kind: 'organization', orgId: 5 },
      accountId: '12',
      update: jasmine.createSpy('update'),
      reset: jasmine.createSpy('reset'),
      setError: jasmine.createSpy('setError'),
      reload: jasmine.createSpy('reload'),
      goToFirstPage: jasmine.createSpy('goToFirstPage'),
      client: jasmine.createSpyObj('client', ['createTransaction', 'updateTransaction']),
    };
    deps.client.createTransaction.and.resolveTo({ id: 9 });
    deps.client.updateTransaction.and.resolveTo({ id: 3 });
    controller = new LedgerFormController(deps);
  });

  it('creates a transaction with a signed amount', async () => {
    await controller.submit({ editing: null, values: VALUES }, { currency: 'BRL', page: 1 });

    expect(deps.client.createTransaction).toHaveBeenCalledWith(deps.context, '12', {
      date: '2000-01-01', amount: '-12.50', description: 'Coffee',
    });
    expect(deps.update).toHaveBeenCalledWith({ pending: true });
    expect(deps.reset).toHaveBeenCalled();
  });

  it('reloads after a create on page 1', async () => {
    await controller.submit({ editing: null, values: VALUES }, { currency: 'BRL', page: 1 });

    expect(deps.reload).toHaveBeenCalled();
    expect(deps.goToFirstPage).not.toHaveBeenCalled();
  });

  it('goes to page 1 after a create on another page', async () => {
    await controller.submit({ editing: null, values: VALUES }, { currency: 'BRL', page: 3 });

    expect(deps.goToFirstPage).toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('updates a transaction and reloads the current page', async () => {
    await controller.submit({ editing: TRANSACTION, values: { ...VALUES, direction: 'in' } }, { currency: 'BRL', page: 3 });

    expect(deps.client.updateTransaction).toHaveBeenCalledWith(deps.context, '12', 3, {
      date: '2000-01-01', amount: '12.50', description: 'Coffee', notes: null,
    });
    expect(deps.reload).toHaveBeenCalled();
    expect(deps.goToFirstPage).not.toHaveBeenCalled();
  });

  it('keeps the values and sends nothing on client errors', async () => {
    await controller.submit({ editing: null, values: { ...VALUES, amount: '0' } }, { currency: 'BRL', page: 1 });

    expect(deps.update).toHaveBeenCalledWith({ fieldErrors: { amount: jasmine.any(String) }, error: null });
    expect(deps.client.createTransaction).not.toHaveBeenCalled();
    expect(deps.reset).not.toHaveBeenCalled();
  });

  it('resets pending on an expired session', async () => {
    deps.client.createTransaction.and.resolveTo(undefined);

    await controller.submit({ editing: null, values: VALUES }, { currency: 'BRL', page: 1 });

    expect(deps.update.calls.mostRecent().args[0]).toEqual({ pending: false });
    expect(deps.reset).not.toHaveBeenCalled();
  });

  it('shows a 400 on the row, keeping the values', async () => {
    deps.client.createTransaction.and.rejectWith(new ApiError(400, 'Too many decimals', 'BAD_REQUEST'));

    await controller.submit({ editing: null, values: VALUES }, { currency: 'BRL', page: 1 });

    expect(deps.update).toHaveBeenCalledWith({ error: jasmine.objectContaining({ kind: 'validation', messages: ['Too many decimals'] }) });
    expect(deps.reset).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('shows ACCOUNT_ARCHIVED in the alert and reloads', async () => {
    deps.client.createTransaction.and.rejectWith(new ApiError(409, 'Archived', 'ACCOUNT_ARCHIVED'));

    await controller.submit({ editing: null, values: VALUES }, { currency: 'BRL', page: 1 });

    expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict', code: 'ACCOUNT_ARCHIVED' }));
    expect(deps.reload).toHaveBeenCalled();
  });

  it('reloads on a 404 (the reload shows Not-found for a missing account)', async () => {
    deps.client.updateTransaction.and.rejectWith(new ApiError(404, 'Not Found'));

    await controller.submit({ editing: TRANSACTION, values: VALUES }, { currency: 'BRL', page: 1 });

    expect(deps.reload).toHaveBeenCalled();
  });

  it('offers Retry on a network failure', async () => {
    deps.client.createTransaction.and.rejectWith(new TypeError('Failed to fetch'));

    await controller.submit({ editing: null, values: VALUES }, { currency: 'BRL', page: 1 });

    const error = deps.setError.calls.mostRecent().args[0];

    expect(error.kind).toBe('transient');

    deps.client.createTransaction.and.resolveTo({ id: 9 });
    await error.retry();

    expect(deps.client.createTransaction.calls.count()).toBe(2);
    expect(deps.reset).toHaveBeenCalled();
  });

  it('uses the default client', () => {
    const plain = new LedgerFormController({ ...deps, client: undefined });

    expect(plain.client.createTransaction).toEqual(jasmine.any(Function));
  });
});
