import { accountTypeOutcome, guardAccountType } from '../../../../../../../../assets/js/components/resources/bank/common/detail/accountTypeGuard.js';
import BankAccountLoader, { buildBankAccountLoadEffect } from '../../../../../../../../assets/js/components/resources/bank/common/detail/controllers/BankAccountLoader.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];
const LEDGER = { transactions: [], opening: null, pagination: { total_count: 0, total_pages: 1 } };

describe('accountTypeGuard', () => {
  CONTEXTS.forEach(([label, context, prefix]) => {
    describe(`in ${label}`, () => {
      it('redirects a debt opened under the accounts section to the debts detail', () => {
        expect(accountTypeOutcome({ id: 7, type: 'debt' }, { base: '/bank/accounts', context }))
          .toEqual({ kind: 'redirect', hash: `#${prefix}/bank/debts/7` });
      });

      it('redirects a regular account opened under the debts section to the accounts detail', () => {
        expect(accountTypeOutcome({ id: 12, type: 'regular' }, { base: '/bank/debts', context }))
          .toEqual({ kind: 'redirect', hash: `#${prefix}/bank/accounts/12` });
      });

      it('keeps the suffix on redirect (edit pages)', () => {
        expect(accountTypeOutcome({ id: 7, type: 'debt' }, { base: '/bank/accounts', context, suffix: '/edit' }))
          .toEqual({ kind: 'redirect', hash: `#${prefix}/bank/debts/7/edit` });
        expect(accountTypeOutcome({ id: 12, type: 'regular' }, { base: '/bank/debts', context, suffix: '/edit' }))
          .toEqual({ kind: 'redirect', hash: `#${prefix}/bank/accounts/12/edit` });
      });
    });
  });

  it('shows a matching type', () => {
    expect(accountTypeOutcome({ id: 7, type: 'debt' }, { base: '/bank/debts', context: {} })).toEqual({ kind: 'show' });
    expect(accountTypeOutcome({ id: 7, type: 'regular' }, { base: '/bank/accounts', context: {} })).toEqual({ kind: 'show' });
  });

  it('shows an account without a type, or under an unknown section', () => {
    expect(accountTypeOutcome({ id: 7 }, { base: '/bank/debts', context: {} })).toEqual({ kind: 'show' });
    expect(accountTypeOutcome({ id: 7, type: 'debt' }, { base: undefined, context: {} })).toEqual({ kind: 'show' });
  });

  it('treats a type without a section as not found', () => {
    expect(accountTypeOutcome({ id: 7, type: 'investment' }, { base: '/bank/debts', context: {} })).toEqual({ kind: 'notFound' });
  });

  describe('guardAccountType', () => {
    let callbacks;
    let navigate;

    beforeEach(() => {
      callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);
      navigate = jasmine.createSpy('navigate');
    });

    function guard(base) {
      return guardAccountType(callbacks, { base, context: { kind: 'personal' }, navigate });
    }

    it('passes a matching account through', () => {
      const loaded = { account: { id: 7, type: 'debt' }, ledger: LEDGER };

      guard('/bank/debts').onLoaded(loaded);

      expect(callbacks.onLoaded).toHaveBeenCalledWith(loaded);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('redirects instead of showing a wrong-type account', () => {
      guard('/bank/debts').onLoaded({ account: { id: 12, type: 'regular' }, ledger: LEDGER });

      expect(navigate).toHaveBeenCalledWith('#/bank/accounts/12');
      expect(callbacks.onLoaded).not.toHaveBeenCalled();
    });

    it('reports Not-found for a type without a section', () => {
      guard('/bank/accounts').onLoaded({ account: { id: 3, type: 'investment' }, ledger: LEDGER });

      expect(callbacks.onNotFound).toHaveBeenCalled();
      expect(callbacks.onLoaded).not.toHaveBeenCalled();
    });

    it('keeps the other callbacks', () => {
      const guarded = guard('/bank/debts');

      guarded.onError('e');

      expect(callbacks.onError).toHaveBeenCalledWith('e');
    });

    it('redirects a debt deep-linked under the accounts detail, through the loader', async () => {
      const client = jasmine.createSpyObj('client', ['getAccount', 'listTransactions']);

      client.getAccount.and.resolveTo({ id: 7, type: 'debt' });
      client.listTransactions.and.resolveTo(LEDGER);

      buildBankAccountLoadEffect(new BankAccountLoader(client), { kind: 'organization', orgId: 5 }, 7, 1, guardAccountType(
        callbacks,
        { base: '/bank/accounts', context: { kind: 'organization', orgId: 5 }, navigate },
      ))();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(navigate).toHaveBeenCalledWith('#/orgs/5/bank/debts/7');
      expect(callbacks.onLoaded).not.toHaveBeenCalled();
    });
  });
});
