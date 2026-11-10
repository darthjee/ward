import MarkUnsentController from '../../../../../../../../../assets/js/components/resources/bank/providers/common/controllers/MarkUnsentController.js';
import AccountantClient from '../../../../../../../../../assets/js/client/AccountantClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const ORG = { kind: 'organization', orgId: 5 };

describe('MarkUnsentController', () => {
  let deps;

  beforeEach(() => {
    deps = {
      context: ORG,
      setPending: jasmine.createSpy('setPending'),
      setError: jasmine.createSpy('setError'),
      reload: jasmine.createSpy('reload'),
      client: jasmine.createSpyObj('client', ['markUnsent']),
    };
  });

  it('posts the single id, then reloads', async () => {
    deps.client.markUnsent.and.resolveTo({ charges: [{ id: 9, sent_to_accountant_at: null }] });

    await new MarkUnsentController(deps).markUnsent({ id: 9 });

    expect(deps.client.markUnsent).toHaveBeenCalledWith(ORG, [9]);
    expect(deps.setPending.calls.allArgs()).toEqual([[true], [false]]);
    expect(deps.setError).toHaveBeenCalledWith(null);
    expect(deps.reload).toHaveBeenCalled();
  });

  it('does not reload when the session expired', async () => {
    deps.client.markUnsent.and.resolveTo(undefined);

    await new MarkUnsentController(deps).markUnsent({ id: 9 });

    expect(deps.setPending).toHaveBeenCalledWith(false);
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('shows a network failure with Retry', async () => {
    deps.client.markUnsent.and.rejectWith(new ApiError(500, 'boom'));

    await new MarkUnsentController(deps).markUnsent({ id: 9 });

    const error = deps.setError.calls.mostRecent().args[0];

    expect(error.kind).toBe('transient');
    expect(deps.reload).not.toHaveBeenCalled();

    deps.client.markUnsent.and.resolveTo({ charges: [] });
    await error.retry();

    expect(deps.client.markUnsent).toHaveBeenCalledTimes(2);
    expect(deps.reload).toHaveBeenCalled();
  });

  it('shows a 404 and reloads', async () => {
    deps.client.markUnsent.and.rejectWith(new ApiError(404, 'gone'));

    await new MarkUnsentController(deps).markUnsent({ id: 9 });

    expect(deps.setError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: jasmine.any(String) }));
    expect(deps.setError.calls.mostRecent().args[0].retry).toBeUndefined();
    expect(deps.reload).toHaveBeenCalled();
  });

  it('defaults to the AccountantClient', () => {
    expect(new MarkUnsentController({ ...deps, client: undefined }).client).toBe(AccountantClient);
  });
});
