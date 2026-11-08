import BankDebtDetailHelper from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/helpers/BankDebtDetailHelper.jsx';
import { initialLedgerForm } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useLedgerForm.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const DEBT = {
  id: 7,
  name: 'Car loan',
  bank_name: 'Bank A',
  currency: 'BRL',
  balance: '-9500.00',
  opening_balance: '-10000.00',
  opening_date: '2026-01-01',
  notes: null,
  archived_at: null,
  type: 'debt',
  debt: {
    interest_rate: '1.99', interest_period: 'monthly', instalment_amount: '500.00', instalment_frequency: 'monthly',
  },
};
const LEDGER = {
  transactions: [{
    id: 1, date: '2026-05-01', amount: '500.00', description: 'Payment', notes: null, balance: '-9500.00',
  }],
  opening: { date: '2026-01-01', amount: '-10000.00', balance: '-10000.00' },
  pagination: {
    page: 1, per_page: 50, total_pages: 2, total_count: 1,
  },
};

const noop = () => undefined;
const HANDLERS = new Proxy({}, { get: () => noop });

function output(overrides = {}, account = {}) {
  return renderedOutput(BankDebtDetailHelper.render({
    context: { kind: 'personal' },
    accountId: '7',
    page: 1,
    data: { account: { ...DEBT, ...account }, ledger: LEDGER },
    loadError: null,
    error: null,
    form: initialLedgerForm('2026-05-10'),
    actionPending: null,
    confirmation: null,
    ...overrides,
  }, HANDLERS));
}

describe('BankDebtDetailHelper', () => {
  it('renders the header, the info block, the shortcuts, the plain inline add and the ledger', () => {
    expect(output().containsInOrder(
      'Car loan', 'Creditor', 'Debt info', '1.99% / month', 'Ledger', 'Add payment', 'Add interest', 'New transaction', 'Payment', 'Opening balance',
    )).toBeTrue();
  });

  it('links back to the Debts list, Edit and the ledger pages under the Debts section', () => {
    const page = output();

    expect(page.containsInOrder('href="#/bank/debts"', '← Debts')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/debts/7/edit')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/debts/7?page=2')).toBeTrue();
  });

  it('builds the links from an organization context', () => {
    const page = output({ context: { kind: 'organization', orgId: 5 } });

    expect(page.containsAttribute('href', '#/orgs/5/bank/debts')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/debts/7/edit')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/debts/7?page=2')).toBeTrue();
  });

  it('hides the shortcuts and the inline form on an archived debt', () => {
    const page = output({}, { archived_at: '2026-02-01T00:00:00.000Z' });

    expect(page.contains('Add payment')).toBeFalse();
    expect(page.contains('Add interest')).toBeFalse();
    expect(page.contains('New transaction')).toBeFalse();
    expect(page.contains('>Rename<')).toBeTrue();
  });

  it('renders the loading state', () => {
    expect(output({ data: null }).contains('Loading')).toBeTrue();
  });

  it('escapes the name, creditor, notes and descriptions', () => {
    const page = output({
      data: {
        account: {
          ...DEBT, name: '<img src=x>', bank_name: '<marquee>x</marquee>', notes: '<script>x</script>',
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
