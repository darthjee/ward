import BankBillHistoryHelper from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/helpers/BankBillHistoryHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PROVIDER = { id: 3, name: 'Vivo', currency: 'BRL', archived_at: null };
const RECURRING = {
  id: 9, kind: 'recurring', description: 'Internet', expected_amount: '100.00', charge_frequency: 'monthly', provider_account_id: 3,
};
const ONE_OFF = { id: 10, kind: 'one_off', description: 'Repair', expected_amount: '30.00', charge_frequency: null, provider_account_id: 3 };
const HANDLERS = { onRetryLoad: () => undefined };

function output(overrides = {}) {
  return renderedOutput(BankBillHistoryHelper.render({
    context: { kind: 'personal' }, bill: RECURRING, provider: PROVIDER, loadError: null, ...overrides,
  }, HANDLERS));
}

describe('BankBillHistoryHelper', () => {
  it('links back to the provider, in the active context', () => {
    expect(output().containsInOrder('href="#/bank/providers/3"', '← Vivo')).toBeTrue();
    expect(output({ context: { kind: 'organization', orgId: 5 } }).containsAttribute('href', '#/orgs/5/bank/providers/3')).toBeTrue();
  });

  it('shows the header of a recurring bill with its expected amount', () => {
    expect(output().containsInOrder('Internet — Vivo', 'Recurring', formatMoney('100.00', 'BRL'))).toBeTrue();
  });

  it('shows the header of a one-off bill without an expected amount', () => {
    const page = output({ bill: ONE_OFF });

    expect(page.containsInOrder('Repair — Vivo', 'One-off')).toBeTrue();
    expect(page.contains(formatMoney('30.00', 'BRL'))).toBeFalse();
  });

  it('renders the bill history below the header', () => {
    expect(output().containsInOrder('Internet — Vivo', 'Bill history', 'Loading')).toBeTrue();
  });

  it('shows a loading notice, without a header, until loaded', () => {
    const page = output({ bill: null, provider: null });

    expect(page.contains('Loading')).toBeTrue();
    expect(page.contains('Bill history')).toBeFalse();
  });

  it('shows no loading notice on a load error', () => {
    expect(output({ bill: null, provider: null, loadError: { kind: 'transient', message: 'Down', messages: ['Down'] } }).contains('Loading'))
      .toBeFalse();
  });
});
