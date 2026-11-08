import BankAccountsLoader, {
  buildBankAccountsLoadEffect,
} from '../../../../../../../../../assets/js/components/resources/bank/common/list/controllers/BankAccountsLoader.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { fetchSequence } from '../../../../../../../../support/fetchSequence.js';
import { flushMicrotasks } from '../../../../../../../../support/flushMicrotasks.js';

const PERSONAL = { kind: 'personal' };
const ACCOUNTS = [{ id: 1, name: 'Main' }];

describe('BankAccountsLoader', () => {
  let client;
  let callbacks;
  let loader;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['listAccounts']);
    client.listAccounts.and.resolveTo(ACCOUNTS);
    callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);
    loader = new BankAccountsLoader(client);
  });

  it('lists the accounts with the archived filter and reports them', async () => {
    await loader.load(PERSONAL, true, callbacks);

    expect(client.listAccounts).toHaveBeenCalledWith(PERSONAL, { archived: true, type: 'regular' });
    expect(callbacks.onLoaded).toHaveBeenCalledWith(ACCOUNTS);
  });

  it('lists the accounts of the given type (debts only)', async () => {
    await new BankAccountsLoader(client, { type: 'debt' }).load(PERSONAL, false, callbacks);

    expect(client.listAccounts).toHaveBeenCalledWith(PERSONAL, { archived: false, type: 'debt' });
  });

  it('reports Not-found on a 404', async () => {
    client.listAccounts.and.rejectWith(new ApiError(404, 'Not Found', 'NOT_FOUND'));

    await loader.load(PERSONAL, false, callbacks);

    expect(callbacks.onNotFound).toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('reports a transient error on a 5xx', async () => {
    client.listAccounts.and.rejectWith(new ApiError(500, 'boom'));

    await loader.load(PERSONAL, false, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'transient' }));
  });

  it('reports a transient error on a network failure', async () => {
    client.listAccounts.and.rejectWith(new TypeError('Failed to fetch'));

    await loader.load(PERSONAL, false, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'transient' }));
  });

  it('reports nothing on an expired session', async () => {
    client.listAccounts.and.resolveTo(undefined);

    await loader.load(PERSONAL, false, callbacks);

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('drops late answers', async () => {
    await loader.load(PERSONAL, false, callbacks, () => false);
    client.listAccounts.and.rejectWith(new ApiError(404, 'Not Found'));
    await loader.load(PERSONAL, false, callbacks, () => false);

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
    expect(callbacks.onNotFound).not.toHaveBeenCalled();
  });

  describe('buildBankAccountsLoadEffect', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    [
      [PERSONAL, '/bank/accounts.json?type=regular&archived=false'],
      [{ kind: 'organization', orgId: 5 }, '/orgs/5/bank/accounts.json?type=regular&archived=false'],
    ].forEach(([context, path]) => {
      it(`loads regular accounts from ${path}`, async () => {
        globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: ACCOUNTS }]);

        buildBankAccountsLoadEffect(new BankAccountsLoader(), context, false, callbacks)();
        await flushMicrotasks();
        await flushMicrotasks();

        expect(globalThis.fetch.calls.mostRecent().args[0]).toBe(path);
        expect(callbacks.onLoaded).toHaveBeenCalledWith(ACCOUNTS);
      });
    });

    it('drops the answer after cleanup', async () => {
      const cleanup = buildBankAccountsLoadEffect(loader, PERSONAL, false, callbacks)();

      cleanup();
      await flushMicrotasks();

      expect(callbacks.onLoaded).not.toHaveBeenCalled();
    });
  });
});
