import BankAccountLoader, {
  buildBankAccountLoadEffect,
  buildBankSettingsLoadEffect,
} from '../../../../../../../../../assets/js/components/resources/bank/common/detail/controllers/BankAccountLoader.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { fetchSequence } from '../../../../../../../../support/fetchSequence.js';
import { flushMicrotasks } from '../../../../../../../../support/flushMicrotasks.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };
const ACCOUNT = { id: 12, name: 'Main', currency: 'BRL' };
const LEDGER = { transactions: [], opening: null, pagination: { page: 1, total_count: 0, total_pages: 1 } };

describe('BankAccountLoader', () => {
  let client;
  let callbacks;
  let loader;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['getAccount', 'listTransactions', 'getSettings']);
    client.getAccount.and.resolveTo(ACCOUNT);
    client.listTransactions.and.resolveTo(LEDGER);
    client.getSettings.and.resolveTo({ default_currency: 'BRL' });
    callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);
    loader = new BankAccountLoader(client);
  });

  it('loads the account and the ledger page together', async () => {
    await loader.load(ORG, 12, 3, callbacks);

    expect(client.getAccount).toHaveBeenCalledWith(ORG, 12);
    expect(client.listTransactions).toHaveBeenCalledWith(ORG, 12, 3);
    expect(callbacks.onLoaded).toHaveBeenCalledWith({ account: ACCOUNT, ledger: LEDGER });
  });

  it('reports nothing when the session expired', async () => {
    client.listTransactions.and.resolveTo(undefined);

    await loader.load(PERSONAL, 12, 1, callbacks);

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
  });

  it('reports Not-found on a 404', async () => {
    client.getAccount.and.rejectWith(new ApiError(404, 'Not Found', 'NOT_FOUND'));

    await loader.load(PERSONAL, 12, 1, callbacks);

    expect(callbacks.onNotFound).toHaveBeenCalled();
  });

  it('loads the settings', async () => {
    await loader.loadSettings(PERSONAL, callbacks);

    expect(callbacks.onLoaded).toHaveBeenCalledWith({ default_currency: 'BRL' });
  });

  it('reports a settings failure', async () => {
    client.getSettings.and.rejectWith(new ApiError(500, 'boom'));

    await loader.loadSettings(PERSONAL, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'transient' }));
  });

  describe('effects', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('loads the account and ledger under an organization', async () => {
      globalThis.fetch = fetchSequence([
        { ok: true, status: 200, json: ACCOUNT },
        { ok: true, status: 200, json: LEDGER },
      ]);

      buildBankAccountLoadEffect(new BankAccountLoader(), ORG, 12, 2, callbacks)();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      const paths = globalThis.fetch.calls.allArgs().map(([path]) => path);

      expect(paths).toEqual(['/orgs/5/bank/accounts/12.json', '/orgs/5/bank/accounts/12/transactions.json?page=2']);
      expect(callbacks.onLoaded).toHaveBeenCalledWith({ account: ACCOUNT, ledger: LEDGER });
    });

    it('loads the settings in Personal', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { default_currency: 'USD' } }]);

      buildBankSettingsLoadEffect(new BankAccountLoader(), PERSONAL, callbacks)();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(globalThis.fetch.calls.mostRecent().args[0]).toBe('/bank/settings.json');
      expect(callbacks.onLoaded).toHaveBeenCalledWith({ default_currency: 'USD' });
    });

    it('drops answers after cleanup', async () => {
      buildBankAccountLoadEffect(loader, PERSONAL, 12, 1, callbacks)()();
      buildBankSettingsLoadEffect(loader, PERSONAL, callbacks)()();
      await flushMicrotasks();

      expect(callbacks.onLoaded).not.toHaveBeenCalled();
    });
  });
});
