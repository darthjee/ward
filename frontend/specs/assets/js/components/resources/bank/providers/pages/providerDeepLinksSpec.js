import BankAccountLoader, {
  buildBankAccountLoadEffect,
} from '../../../../../../../../assets/js/components/resources/bank/common/detail/controllers/BankAccountLoader.js';
import { guardAccountType } from '../../../../../../../../assets/js/components/resources/bank/common/detail/accountTypeGuard.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];
const LEDGER = { transactions: [], opening: null, pagination: { total_count: 0, total_pages: 1 } };

// The detail pages guard under their base with no suffix (useAccountLedger), the edit pages
// with `/edit` (useAccountEditPage); both load through BankAccountLoader.
const PAGES = [['detail', ''], ['edit', '/edit']];

describe('provider wrong-type deep links', () => {
  let client;
  let callbacks;
  let navigate;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['getAccount', 'listTransactions']);
    client.listTransactions.and.resolveTo(LEDGER);
    callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);
    navigate = jasmine.createSpy('navigate');
  });

  async function open(base, account, context, suffix) {
    client.getAccount.and.resolveTo(account);
    buildBankAccountLoadEffect(
      new BankAccountLoader(client),
      context,
      account.id,
      1,
      guardAccountType(callbacks, {
        base, context, suffix, navigate,
      }),
    )();
    await flushMicrotasks();
    await flushMicrotasks();
  }

  CONTEXTS.forEach(([label, context, prefix]) => {
    describe(`in ${label}`, () => {
      PAGES.forEach(([page, suffix]) => {
        ['/bank/accounts', '/bank/debts', '/bank/investments'].forEach((base) => {
          it(`redirects a provider opened on the ${base} ${page} page to the providers ${page} page`, async () => {
            await open(base, { id: 4, type: 'provider_expense' }, context, suffix);

            expect(navigate).toHaveBeenCalledWith(`#${prefix}/bank/providers/4${suffix}`);
            expect(callbacks.onLoaded).not.toHaveBeenCalled();
            expect(callbacks.onNotFound).not.toHaveBeenCalled();
          });
        });

        [['regular', '/bank/accounts'], ['debt', '/bank/debts'], ['investment', '/bank/investments']].forEach(([type, own]) => {
          it(`redirects a ${type} account opened on the providers ${page} page to ${own}`, async () => {
            await open('/bank/providers', { id: 12, type }, context, suffix);

            expect(navigate).toHaveBeenCalledWith(`#${prefix}${own}/12${suffix}`);
            expect(callbacks.onLoaded).not.toHaveBeenCalled();
          });
        });

        it(`shows a provider on the providers ${page} page`, async () => {
          await open('/bank/providers', { id: 4, type: 'provider_expense' }, context, suffix);

          expect(navigate).not.toHaveBeenCalled();
          expect(callbacks.onNotFound).not.toHaveBeenCalled();
          expect(callbacks.onLoaded).toHaveBeenCalledWith({ account: { id: 4, type: 'provider_expense' }, ledger: LEDGER });
        });
      });
    });
  });
});
