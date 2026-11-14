import BankProviderDetailHelper from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelper.jsx';
import { initialLedgerForm } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useLedgerForm.js';
import { formatDate, localToday } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import BillHistoryHelper from '../../../../../../../../../assets/js/components/resources/bank/common/bills/helpers/BillHistoryHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const SENT_AT = '2026-03-02T15:00:00.000Z';
const PROVIDER = {
  id: 4,
  name: 'Office rent',
  bank_name: 'Landlord Ltd',
  currency: 'BRL',
  balance: '-200.00',
  opening_balance: '0.00',
  opening_date: '2026-01-01',
  notes: null,
  archived_at: null,
  type: 'provider_expense',
  provider_expense: {
    for_accountant: true, provider_tax_id: null, expected_amount: '200.00', charge_frequency: 'monthly', due_day: null, due_month: null,
  },
};
const SENT_CHARGE = {
  id: 2, date: '2026-02-05', amount: '-200.00', description: 'Charge Feb', notes: null, balance: '-200.00', sent_to_accountant_at: SENT_AT,
};
const UNSENT_CHARGE = {
  id: 3, date: '2026-03-05', amount: '-200.00', description: 'Charge Mar', notes: null, balance: '-400.00', sent_to_accountant_at: null,
};
const PAYMENT = {
  id: 1, date: '2026-03-10', amount: '200.00', description: 'Payment Mar', notes: null, balance: '-200.00',
};
const LEDGER = {
  transactions: [PAYMENT, UNSENT_CHARGE, SENT_CHARGE],
  opening: { date: '2026-01-01', amount: '0.00', balance: '0.00' },
  pagination: {
    page: 1, per_page: 50, total_pages: 2, total_count: 3,
  },
};

const noop = () => undefined;
const HANDLERS = new Proxy({}, { get: () => noop });

function state(overrides = {}, account = {}) {
  return {
    context: { kind: 'personal' },
    accountId: '4',
    page: 1,
    data: { account: { ...PROVIDER, ...account }, ledger: LEDGER },
    loadError: null,
    error: null,
    form: initialLedgerForm('2026-05-10'),
    actionPending: null,
    confirmation: null,
    markUnsentPending: false,
    ...overrides,
  };
}

function output(overrides, account) {
  return renderedOutput(BankProviderDetailHelper.render(state(overrides, account), HANDLERS));
}

function findAll(node, predicate, acc = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, acc));
    return acc;
  }

  if (!node || typeof node !== 'object') {
    return acc;
  }

  if (predicate(node)) {
    acc.push(node);
  }

  return findAll(node.props?.children, predicate, acc);
}

describe('BankProviderDetailHelper', () => {
  it('renders the Bill history after the ledger', () => {
    expect(output().containsInOrder('Ledger', 'Bill history', 'Loading')).toBeTrue();
  });

  it('hands the account and its source type to the Bill history', () => {
    spyOn(BillHistoryHelper, 'render').and.returnValue(null);
    output();

    expect(BillHistoryHelper.render).toHaveBeenCalledWith(
      jasmine.objectContaining({ sourceType: 'provider_expense', account: jasmine.objectContaining({ id: jasmine.anything() }) }),
      jasmine.any(Object),
    );
  });

  it('renders the header, the info block, the shortcuts, the plain inline add and the ledger', () => {
    expect(output().containsInOrder(
      'Office rent', 'Provider', 'Provider info', 'Ledger', 'Add charge', 'Add payment', 'New transaction', 'Payment Mar', 'Opening balance',
    )).toBeTrue();
  });

  it('links back to the Providers list, Edit and the ledger pages under the Providers section', () => {
    const page = output();

    expect(page.containsInOrder('href="#/bank/providers"', '← Providers')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/providers/4/edit')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/providers/4?page=2')).toBeTrue();
  });

  it('builds the links under an organization', () => {
    const page = output({ context: { kind: 'organization', orgId: 5 } });

    expect(page.containsAttribute('href', '#/orgs/5/bank/providers')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/providers/4/edit')).toBeTrue();
  });

  it('shows the sent date and Mark as unsent on sent charges only', () => {
    const page = output();
    const sent = `Sent ${formatDate(localToday(new Date(SENT_AT)))}`;

    expect(page.containsInOrder('Charge Feb', sent, 'Mark as unsent')).toBeTrue();
    expect(page.containsInOrder('Payment Mar', 'Charge Mar', 'Charge Feb', sent)).toBeTrue();
    expect(page.containsInOrder('Mark as unsent', 'Mark as unsent')).toBeFalse();
  });

  it('links Add bill to the new bill page with the provider pre-selected', () => {
    expect(output().containsInOrder('Ledger', 'Add charge', 'Add payment', 'href="#/bank/bills/new?provider=4"', 'Add bill'))
      .toBeTrue();
    expect(output({ context: { kind: 'organization', orgId: 5 } }).containsAttribute('href', '#/orgs/5/bank/bills/new?provider=4'))
      .toBeTrue();
  });

  it('keeps Mark as unsent on an archived provider, without shortcuts, inline form, Edit or Delete', () => {
    const page = output({}, { archived_at: '2026-04-01T00:00:00.000Z' });

    expect(page.contains('Add bill')).toBeFalse();
    expect(page.containsInOrder('Charge Feb', 'Mark as unsent')).toBeTrue();
    expect(page.contains('Add charge')).toBeFalse();
    expect(page.contains('New transaction')).toBeFalse();
    expect(page.contains('>Edit<')).toBeFalse();
  });

  it('wires Mark as unsent with the row and disables it while pending', () => {
    const handlers = { onMarkUnsent: jasmine.createSpy('onMarkUnsent') };
    const proxied = new Proxy(handlers, { get: (target, name) => (name === 'onMarkUnsent' ? target.onMarkUnsent : noop) });
    const element = BankProviderDetailHelper.render(state(), proxied);
    const [mark] = findAll(element, (node) => node.props?.transaction === SENT_CHARGE && node.props?.onMarkUnsent);

    mark.props.onMarkUnsent(SENT_CHARGE);

    expect(handlers.onMarkUnsent).toHaveBeenCalledWith(SENT_CHARGE);
    expect(mark.props.pending).toBeFalse();

    const [pendingMark] = findAll(
      BankProviderDetailHelper.render(state({ markUnsentPending: true }), proxied),
      (node) => node.props?.transaction === SENT_CHARGE && node.props?.onMarkUnsent,
    );

    expect(pendingMark.props.pending).toBeTrue();
  });

  it('warns before saving an edit of a sent charge', () => {
    const element = BankProviderDetailHelper.render(state({ confirmation: { kind: 'sentEdit' } }), HANDLERS);
    const [modal] = findAll(element, (node) => node.props?.onConfirm && node.props?.title);

    expect(modal.props.show).toBeTrue();
    expect(modal.props.confirmLabel).toBe('Save');
    expect(modal.props.children).toContain('This charge was already sent to the accountant');
  });

  it('adds the warning to the delete of a sent charge only', () => {
    const modalFor = (transaction) => findAll(
      BankProviderDetailHelper.render(state({ confirmation: { kind: 'transaction', transaction } }), HANDLERS),
      (node) => node.props?.onConfirm && node.props?.title,
    )[0];

    expect(modalFor(SENT_CHARGE).props.children).toContain('already sent to the accountant');
    expect(modalFor(UNSENT_CHARGE).props.children).not.toContain('already sent to the accountant');
  });

  it('escapes the descriptions', () => {
    const page = output({ data: { account: PROVIDER, ledger: { ...LEDGER, transactions: [{ ...SENT_CHARGE, description: '<img src=x>' }] } } });

    expect(page.containsTag('img')).toBeFalse();
  });
});
