import { ledgerPageHref } from '../../../../../../../../assets/js/components/resources/bank/common/detail/ledgerPageHref.js';

describe('ledgerPageHref', () => {
  it('builds the hash of a ledger page under the accounts section', () => {
    expect(ledgerPageHref({ kind: 'personal' }, '/bank/accounts', 12, 3)).toBe('#/bank/accounts/12?page=3');
    expect(ledgerPageHref({ kind: 'organization', orgId: 5 }, '/bank/accounts', 12, 1)).toBe('#/orgs/5/bank/accounts/12?page=1');
  });

  it('builds the hash of a ledger page under the debts section', () => {
    expect(ledgerPageHref({ kind: 'personal' }, '/bank/debts', 7, 2)).toBe('#/bank/debts/7?page=2');
    expect(ledgerPageHref({ kind: 'organization', orgId: 5 }, '/bank/debts', 7, 1)).toBe('#/orgs/5/bank/debts/7?page=1');
  });
});
