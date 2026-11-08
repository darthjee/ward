import BankMenuHelper, {
  BANK_MENU_ENTRIES,
} from '../../../../../../../../assets/js/components/common/header/bankMenu/helpers/BankMenuHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BankMenuHelper', () => {
  it('lists the Accounts, Debts then Investments entry', () => {
    expect(BANK_MENU_ENTRIES).toEqual([
      ['Accounts', '/bank/accounts'], ['Debts', '/bank/debts'], ['Investments', '/bank/investments'],
    ]);
  });

  it('builds every entry from the Personal context', () => {
    const page = renderedOutput(BankMenuHelper.render({ context: { kind: 'personal' } }));

    expect(page.containsInOrder('href="#/bank/accounts"', 'Accounts', 'href="#/bank/debts"', 'Debts', 'href="#/bank/investments"', 'Investments'))
      .toBeTrue();
  });

  it('builds the default entries from an organization context', () => {
    const page = renderedOutput(BankMenuHelper.render({ context: { kind: 'organization', orgId: 7 } }));

    expect(page.containsInOrder('href="#/orgs/7/bank/accounts"', 'href="#/orgs/7/bank/debts"', 'href="#/orgs/7/bank/investments"'))
      .toBeTrue();
  });

  it('builds every entry from an organization context', () => {
    const page = renderedOutput(BankMenuHelper.render(
      { context: { kind: 'organization', orgId: 7 } },
      [['Accounts', '/bank/accounts'], ['Other', '/bank/other']],
    ));

    expect(page.containsInOrder('href="#/orgs/7/bank/accounts"', 'Accounts', 'href="#/orgs/7/bank/other"', 'Other'))
      .toBeTrue();
  });
});
