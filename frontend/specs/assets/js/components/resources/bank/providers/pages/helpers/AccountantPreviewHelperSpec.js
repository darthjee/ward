import AccountantPreviewHelper from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/AccountantPreviewHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const CHARGES = [
  {
    id: 7, date: '2026-02-05', description: 'Internet', amount: '-129.90', sent_to_accountant_at: null,
    account: { id: 4, name: 'Office ISP', bank_name: 'Fiber Co', currency: 'BRL' },
  },
  {
    id: 9, date: '2026-02-10', description: 'Hosting', amount: '-20.00', sent_to_accountant_at: null,
    account: { id: 5, name: 'Host', bank_name: null, currency: 'USD' },
  },
];

function render(overrides = {}) {
  return AccountantPreviewHelper.render({
    charges: CHARGES, loading: false, context: { kind: 'personal' }, ...overrides,
  });
}

describe('AccountantPreviewHelper', () => {
  it('renders nothing before a preview, or a loading notice while loading', () => {
    expect(render({ charges: null })).toBeNull();
    expect(renderedOutput(render({ charges: null, loading: true })).contains('Loading')).toBeTrue();
  });

  it('renders the empty-state message', () => {
    expect(renderedOutput(render({ charges: [] })).contains('No charges in this range.')).toBeTrue();
  });

  it('renders the rows, then the per-currency totals', () => {
    expect(renderedOutput(render()).containsInOrder(
      'Office ISP', 'Host', `Total BRL: ${formatMoney('-129.90', 'BRL')}`, `Total USD: ${formatMoney('-20.00', 'USD')}`,
    )).toBeTrue();
  });
});
