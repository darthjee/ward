import BankAccountDetailController from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/controllers/BankAccountDetailController.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

describe('BankAccountDetailController', () => {
  let deps;
  let controller;

  beforeEach(() => {
    deps = {
      context: { kind: 'personal' },
      accountId: '12',
      setPending: jasmine.createSpy('setPending'),
      setError: jasmine.createSpy('setError'),
      setConfirm: jasmine.createSpy('setConfirm'),
      reload: jasmine.createSpy('reload'),
      onNotFound: jasmine.createSpy('onNotFound'),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['archiveAccount', 'unarchiveAccount', 'deleteAccount', 'deleteTransaction']),
    };
    deps.client.archiveAccount.and.resolveTo({ id: 12, account_number: '•••• 1234' });
    deps.client.unarchiveAccount.and.resolveTo({ id: 12 });
    deps.client.deleteAccount.and.resolveTo({});
    deps.client.deleteTransaction.and.resolveTo({});
    controller = new BankAccountDetailController(deps);
  });

  it('archives, then reloads instead of showing the masked response', async () => {
    await controller.archive();

    expect(deps.client.archiveAccount).toHaveBeenCalledWith(deps.context, '12');
    expect(deps.setPending.calls.allArgs()).toEqual([['archive'], [null]]);
    expect(deps.reload).toHaveBeenCalled();
  });

  it('unarchives, then reloads', async () => {
    await controller.unarchive();

    expect(deps.client.unarchiveAccount).toHaveBeenCalledWith(deps.context, '12');
    expect(deps.reload).toHaveBeenCalled();
  });

  it('deletes the account, then goes to the list', async () => {
    await controller.deleteAccount();

    expect(deps.setPending).toHaveBeenCalledWith('delete');
    expect(deps.setConfirm).toHaveBeenCalledWith(null);
    expect(deps.navigate).toHaveBeenCalledWith('#/bank/accounts');
  });

  it('deletes the account under an organization', async () => {
    await new BankAccountDetailController({ ...deps, context: { kind: 'organization', orgId: 5 } }).deleteAccount();

    expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/accounts');
  });

  it('deletes a transaction, then reloads the current page', async () => {
    await controller.deleteTransaction({ id: 3 });

    expect(deps.client.deleteTransaction).toHaveBeenCalledWith(deps.context, '12', 3);
    expect(deps.reload).toHaveBeenCalled();
  });

  it('does nothing more on an expired session', async () => {
    deps.client.archiveAccount.and.resolveTo(undefined);

    await controller.archive();

    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.setPending.calls.mostRecent().args[0]).toBeNull();
  });

  it('shows ACCOUNT_HAS_TRANSACTIONS and reloads (Delete disappears)', async () => {
    deps.client.deleteAccount.and.rejectWith(new ApiError(409, 'Archive it instead', 'ACCOUNT_HAS_TRANSACTIONS'));

    await controller.deleteAccount();

    expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ code: 'ACCOUNT_HAS_TRANSACTIONS', message: 'Archive it instead' }));
    expect(deps.reload).toHaveBeenCalled();
    expect(deps.setConfirm).toHaveBeenCalledWith(null);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('shows ACCOUNT_ARCHIVED and reloads (writes disappear)', async () => {
    deps.client.deleteTransaction.and.rejectWith(new ApiError(409, 'Archived', 'ACCOUNT_ARCHIVED'));

    await controller.deleteTransaction({ id: 3 });

    expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ code: 'ACCOUNT_ARCHIVED' }));
    expect(deps.reload).toHaveBeenCalled();
  });

  it('shows Not-found on an account 404', async () => {
    deps.client.archiveAccount.and.rejectWith(new ApiError(404, 'Not Found'));

    await controller.archive();

    expect(deps.onNotFound).toHaveBeenCalled();
  });

  it('reloads on a transaction 404', async () => {
    deps.client.deleteTransaction.and.rejectWith(new ApiError(404, 'Not Found'));

    await controller.deleteTransaction({ id: 3 });

    expect(deps.onNotFound).not.toHaveBeenCalled();
    expect(deps.reload).toHaveBeenCalled();
  });

  it('offers Retry on a 5xx', async () => {
    deps.client.unarchiveAccount.and.rejectWith(new ApiError(503, 'down'));

    await controller.unarchive();

    const error = deps.setError.calls.mostRecent().args[0];

    expect(error.kind).toBe('transient');

    deps.client.unarchiveAccount.and.resolveTo({ id: 12 });
    await error.retry();

    expect(deps.reload).toHaveBeenCalled();
  });

  it('uses the default navigation and client', () => {
    const plain = new BankAccountDetailController({ ...deps, navigate: undefined, client: undefined });

    expect(plain.client.archiveAccount).toEqual(jasmine.any(Function));
    expect(() => plain.navigate('#/x')).not.toThrow();
  });
});
