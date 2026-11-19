import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import ProviderInfoHelper from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/ProviderInfoHelper.jsx';
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

  it('renders the provider info block without schedule entries', () => {
    const page = output();

    expect(page.containsInOrder('Provider info', 'Provider tax id', '12.345.678/0001-90', 'For accountant', 'Yes')).toBeTrue();
    ['Expected amount', 'Frequency', 'Due day', 'Due month', 'Bills from', 'Show in Calendar', 'Default paying account']
      .forEach((label) => expect(page.contains(label)).toBeFalse());
  });

  it('shows "—" for a personal provider', () => {
    expect(output({ for_accountant: false }).containsInOrder('For accountant', '—')).toBeTrue();
  });

  it('tolerates a missing provider_expense object', () => {
    const page = renderedOutput(ProviderInfoHelper.render({ ...PROVIDER, provider_expense: null }));

    expect(page.containsInOrder('Provider tax id', '—', 'For accountant', '—')).toBeTrue();
  });

  it('escapes the provider and the tax id', () => {
    const page = output({ provider_tax_id: '<b>x</b>' }, { bank_name: '<script>x</script>' });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.containsTag('b')).toBeFalse();
  });
});
