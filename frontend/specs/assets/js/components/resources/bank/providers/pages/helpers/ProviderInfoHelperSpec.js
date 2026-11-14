import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import ProviderInfoHelper from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/ProviderInfoHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { monthName } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PROVIDER = {
  id: 4,
  name: 'Office rent',
  bank_name: 'Landlord Ltd',
  branch: null,
  account_number: 'C-123',
  currency: 'BRL',
  opening_date: '2026-01-01',
  notes: null,
  provider_expense: {
    for_accountant: true,
    provider_tax_id: '12.345.678/0001-90',
    expected_amount: '200.00',
    charge_frequency: 'yearly',
    due_day: 10,
    due_month: 3,
  },
};

function output(details = {}, account = {}) {
  return renderedOutput(ProviderInfoHelper.render({
    ...PROVIDER, ...account, provider_expense: { ...PROVIDER.provider_expense, ...details },
  }));
}

describe('ProviderInfoHelper', () => {
  it('renders the common fields with the provider labels', () => {
    expect(output().containsInOrder(
      'Provider', 'Landlord Ltd', 'Branch', '—', 'Customer / contract number', 'C-123', 'Currency', 'BRL', 'Opening date', formatDate('2026-01-01'),
    )).toBeTrue();
  });

  it('renders the provider info block', () => {
    expect(output().containsInOrder(
      'Provider info',
      'Provider tax id', '12.345.678/0001-90',
      'Expected amount', `${formatMoney('200.00', 'BRL')} / year`,
      'Frequency', 'Yearly',
      'Due day', '10',
      'Due month', monthName(3),
      'For accountant', 'Yes',
    )).toBeTrue();
  });

  it('shows "—" for a missing expected amount and a personal provider', () => {
    const page = output({ expected_amount: null, for_accountant: false, charge_frequency: 'monthly' });

    expect(page.containsInOrder('Expected amount', '—', 'Frequency', 'Monthly')).toBeTrue();
    expect(page.containsInOrder('For accountant', '—')).toBeTrue();
  });

  it('shows the due day and month only when set', () => {
    const page = output({ due_day: null, due_month: null, charge_frequency: 'monthly' });

    expect(page.contains('Due day')).toBeFalse();
    expect(page.contains('Due month')).toBeFalse();
  });

  it('tolerates a missing provider_expense object', () => {
    const page = renderedOutput(ProviderInfoHelper.render({ ...PROVIDER, provider_expense: null }));

    expect(page.containsInOrder('Expected amount', '—')).toBeTrue();
  });

  it('renders the schedule values after the provider info', () => {
    const page = output({ bills_from: '2026-02-01', show_in_calendar: false, paying_account: { id: 9, name: 'Main' } });

    expect(page.containsInOrder(
      'For accountant', 'Bills from', formatDate('2026-02-01'), 'Show in Calendar', 'No', 'Default paying account', 'Main',
    )).toBeTrue();
  });

  it('shows "—" for blank schedule values and Show in Calendar on by default', () => {
    expect(output({ bills_from: null, paying_account: null }).containsInOrder(
      'Bills from', '—', 'Show in Calendar', 'Yes', 'Default paying account', '—',
    )).toBeTrue();
  });

  it('escapes the default paying account name', () => {
    const page = output({ paying_account: { id: 9, name: '<img src=x onerror=alert(1)>' } });

    expect(page.containsTag('img')).toBeFalse();
    expect(page.contains('&lt;img')).toBeTrue();
  });

  it('escapes the provider and the tax id', () => {
    const page = output({ provider_tax_id: '<b>x</b>' }, { bank_name: '<script>x</script>' });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.containsTag('b')).toBeFalse();
  });
});
