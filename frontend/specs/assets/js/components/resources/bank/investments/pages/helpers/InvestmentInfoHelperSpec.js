import InvestmentInfoHelper from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/helpers/InvestmentInfoHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const INVESTMENT = {
  id: 3,
  name: 'CDB',
  bank_name: 'Broker A',
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '0.00',
  notes: '110% CDI',
  investment: {
    kind: 'fixed_income', yield_rate: '12.5', yield_period: 'yearly', maturity_date: '2020-01-01', liquidity_days: 30,
  },
};

function output(account = {}) {
  return renderedOutput(InvestmentInfoHelper.render({ ...INVESTMENT, ...account }));
}

describe('InvestmentInfoHelper', () => {
  it('renders the common fields with the investment labels, without an opening balance', () => {
    const page = output();

    expect(page.containsInOrder('Institution', 'Broker A', 'Currency', 'BRL', 'Start date', '2026-01-01', 'Notes', '110% CDI'))
      .toBeTrue();
    expect(page.contains('Opening balance')).toBeFalse();
  });

  it('renders the investment info block: kind, yield rate, maturity date (past allowed) and liquidity', () => {
    expect(output().containsInOrder(
      'Investment info', 'aria-label="Investment info"', 'Kind', 'Fixed income', 'Yield rate', '12.5% / year',
      'Maturity date', '2020-01-01', 'Liquidity', 'D+30',
    )).toBeTrue();
  });

  it('shows daily liquidity as D+0', () => {
    expect(output({ investment: { ...INVESTMENT.investment, liquidity_days: 0 } }).contains('D+0')).toBeTrue();
  });

  it('shows — for unset values, also without an investment object', () => {
    const page = output({ investment: null, notes: null });

    expect(page.contains('D+')).toBeFalse();
    expect(page.contains('%')).toBeFalse();
    expect(page.containsElement('dd', '—')).toBeTrue();
  });

  it('escapes the institution and notes', () => {
    const page = output({ bank_name: '<marquee>x</marquee>', notes: '<script>x</script>' });

    expect(page.containsTag('marquee')).toBeFalse();
    expect(page.containsTag('script')).toBeFalse();
  });
});
