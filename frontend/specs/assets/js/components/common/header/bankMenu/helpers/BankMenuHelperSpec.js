import BankMenuHelper, {
  BANK_MENU_ENTRIES,
} from '../../../../../../../../assets/js/components/common/header/bankMenu/helpers/BankMenuHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BankMenuHelper', () => {
  it('lists only the Accounts entry for now', () => {
    expect(BANK_MENU_ENTRIES).toEqual([['Accounts', '/bank/accounts']]);
  });

  it('builds every entry from the Personal context', () => {
    const page = renderedOutput(BankMenuHelper.render({ context: { kind: 'personal' } }));

    expect(page.containsAttribute('href', '#/bank/accounts')).toBeTrue();
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
