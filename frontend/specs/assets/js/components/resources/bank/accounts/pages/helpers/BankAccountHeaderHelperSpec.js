import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import BankAccountHeaderHelper, {
  ARCHIVED_BANNER,
} from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/helpers/BankAccountHeaderHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ACCOUNT = {
  id: 12,
  name: 'Main',
  bank_name: 'Bank A',
  branch: '001',
  account_number: '0012345-6',
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '10.00',
  balance: '-1234.56',
  archived_at: null,
  notes: 'Some notes',
};

const noop = () => undefined;
const HANDLERS = { onArchive: noop, onUnarchive: noop, onDeleteAccount: noop };

function output(state = {}, account = {}) {
  return renderedOutput(BankAccountHeaderHelper.render({
    account: { ...ACCOUNT, ...account },
    hasTransactions: false,
    actionPending: null,
    context: { kind: 'personal' },
    ...state,
  }, HANDLERS));
}

describe('BankAccountHeaderHelper', () => {
  it('renders every field with the full account number and the balance', () => {
    const page = output();

    expect(page.containsInOrder('Main', formatMoney('-1234.56', 'BRL'), 'Bank A', '001', '0012345-6', 'BRL', formatDate('2026-01-01')))
      .toBeTrue();
    expect(page.contains('Some notes')).toBeTrue();
  });

  it('shows Delete only when the account has no transactions', () => {
    expect(output().contains('>Delete<')).toBeTrue();
    expect(output({ hasTransactions: true }).contains('>Delete<')).toBeFalse();
  });

  it('shows Edit and Archive for an active account', () => {
    const page = output();

    expect(page.containsInOrder('href="#/bank/accounts/12/edit"', 'Edit')).toBeTrue();
    expect(page.contains('>Archive<')).toBeTrue();
    expect(page.contains('Unarchive')).toBeFalse();
    expect(page.contains(ARCHIVED_BANNER)).toBeFalse();
  });

  it('shows the banner and only Unarchive and Rename when archived', () => {
    const page = output({}, { archived_at: '2026-02-01T00:00:00.000Z' });

    expect(page.contains(ARCHIVED_BANNER)).toBeTrue();
    expect(page.contains('>Unarchive<')).toBeTrue();
    expect(page.contains('>Rename<')).toBeTrue();
    expect(page.contains('>Archive<')).toBeFalse();
    expect(page.contains('>Delete<')).toBeFalse();
    expect(page.contains('>Edit<')).toBeFalse();
  });

  it('builds the edit link under an organization', () => {
    expect(output({ context: { kind: 'organization', orgId: 5 } })
      .containsAttribute('href', '#/orgs/5/bank/accounts/12/edit')).toBeTrue();
  });

  it('disables the actions while one is in flight', () => {
    expect(output({ actionPending: 'archive' }).contains('disabled=""')).toBeTrue();
    expect(output().contains('disabled=""')).toBeFalse();
  });

  it('shows a dash for blank fields', () => {
    expect(output({}, { bank_name: null }).contains('—')).toBeTrue();
  });

  it('escapes user input', () => {
    const page = output({}, { name: '<img src=x>', notes: '<script>x</script>' });

    expect(page.containsTag('img')).toBeFalse();
    expect(page.containsTag('script')).toBeFalse();
  });
});
