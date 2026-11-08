import BankInvestmentDetailHelper from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentDetailHelper.jsx';
import { initialLedgerForm } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useLedgerForm.js';
import { initialUpdateValue } from '../../../../../../../../../assets/js/components/resources/bank/investments/common/controllers/UpdateValueController.js';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const INVESTMENT = {
  id: 3,
  name: 'CDB',
  bank_name: 'Broker A',
  currency: 'BRL',
  balance: '1050.00',
  opening_balance: '0.00',
  opening_date: '2026-01-01',
  notes: null,
  archived_at: null,
  type: 'investment',
  investment: {
    kind: 'fixed_income', yield_rate: '1.1', yield_period: 'monthly', maturity_date: '2028-01-01', liquidity_days: 0,
  },
};
const LEDGER = {
  transactions: [
    {
      id: 2, date: '2026-05-01', amount: '50.00', description: 'Yield', notes: null, balance: '1050.00',
    },
    {
      id: 1, date: '2026-01-01', amount: '1000.00', description: 'Application', notes: null, balance: '1000.00',
    },
  ],
  opening: { date: '2026-01-01', amount: '0.00', balance: '0.00' },
  pagination: {
    page: 1, per_page: 50, total_pages: 2, total_count: 2,
  },
};

const noop = () => undefined;
const HANDLERS = new Proxy({}, { get: () => noop });

function output(overrides = {}, account = {}) {
  return renderedOutput(BankInvestmentDetailHelper.render({
    context: { kind: 'personal' },
    accountId: '3',
    page: 1,
    data: { account: { ...INVESTMENT, ...account }, ledger: LEDGER },
    loadError: null,
    error: null,
    form: initialLedgerForm('2026-05-10'),
    actionPending: null,
    confirmation: null,
    updateValue: initialUpdateValue('2026-05-10'),
    ...overrides,
  }, HANDLERS));
}

describe('BankInvestmentDetailHelper', () => {
  it('renders the header, the info block, the shortcuts, the plain inline add and the ledger', () => {
    expect(output().containsInOrder(
      'CDB', 'Institution', 'Investment info', '1.1% / month', 'D+0', 'Ledger',
      'Add application', 'Add withdrawal', 'Current value (BRL)', 'Update value', 'New transaction',
      'Yield', 'Application', 'Opening balance',
    )).toBeTrue();
  });

  it('shows the running balance as for regular accounts', () => {
    expect(output().containsInOrder('Yield', formatMoney('50.00', 'BRL'), formatMoney('1050.00', 'BRL'))).toBeTrue();
  });

  it('renders the Update value notice from the page state', () => {
    expect(output({ updateValue: { ...initialUpdateValue('2026-05-10'), notice: 'Value unchanged' } }).contains('Value unchanged'))
      .toBeTrue();
  });

  it('falls back to an idle Update value form without its state', () => {
    expect(output({ updateValue: undefined }).contains('Update value')).toBeTrue();
  });

  it('links back to the Investments list, Edit and the ledger pages under the Investments section', () => {
    const page = output();

    expect(page.containsInOrder('href="#/bank/investments"', '← Investments')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/investments/3/edit')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/investments/3?page=2')).toBeTrue();
  });

  it('builds the links from an organization context', () => {
    const page = output({ context: { kind: 'organization', orgId: 5 } });

    expect(page.containsAttribute('href', '#/orgs/5/bank/investments')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/investments/3/edit')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/investments/3?page=2')).toBeTrue();
  });

  it('hides every shortcut, Update value and the inline form on an archived investment', () => {
    const page = output({}, { archived_at: '2026-02-01T00:00:00.000Z' });

    expect(page.contains('Add application')).toBeFalse();
    expect(page.contains('Add withdrawal')).toBeFalse();
    expect(page.contains('Update value')).toBeFalse();
    expect(page.contains('New transaction')).toBeFalse();
    expect(page.contains('>Rename<')).toBeTrue();
  });

  it('renders the loading state', () => {
    expect(output({ data: null }).contains('Loading')).toBeTrue();
  });

  it('escapes the name, institution, notes and descriptions', () => {
    const page = output({
      data: {
        account: {
          ...INVESTMENT, name: '<img src=x>', bank_name: '<marquee>x</marquee>', notes: '<script>x</script>',
        },
        ledger: { ...LEDGER, transactions: [{ ...LEDGER.transactions[0], description: '<iframe>' }] },
      },
    });

    expect(page.containsTag('img')).toBeFalse();
    expect(page.containsTag('marquee')).toBeFalse();
    expect(page.containsTag('script')).toBeFalse();
    expect(page.containsTag('iframe')).toBeFalse();
  });
});
