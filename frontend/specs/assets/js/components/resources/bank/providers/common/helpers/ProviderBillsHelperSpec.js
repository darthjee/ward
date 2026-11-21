import ProviderBillsHelper from '../../../../../../../../../assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelper.jsx';
import ConfirmModal from '../../../../../../../../../assets/js/components/resources/bank/common/ConfirmModal.jsx';
import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const RECURRING = {
  id: 4, kind: 'recurring', description: 'Rent', expected_amount: '200.00', charge_frequency: 'monthly', due_day: 5, due_month: null, due_date: null,
};
const YEARLY = { ...RECURRING, id: 6, description: 'Tax', charge_frequency: 'yearly', due_month: 3 };
const NO_AMOUNT = { ...RECURRING, id: 8, description: 'Free', expected_amount: null, due_day: null };
const ONE_OFF = {
  id: 5, kind: 'one_off', description: 'Repair', expected_amount: '30.00', charge_frequency: null, due_day: null, due_month: null, due_date: '2026-03-10',
};
const ACCOUNT = { id: 7, currency: 'BRL', archived_at: null };
const noop = () => undefined;
const HANDLERS = {
  onNavigate: noop, onDelete: noop, onConfirmDelete: noop, onCancelDelete: noop, onRetry: noop, onDismiss: noop,
};

function state(overrides = {}) {
  return {
    account: ACCOUNT,
    context: { kind: 'personal' },
    page: 1,
    data: { provider_bills: [RECURRING, ONE_OFF], pagination: { page: 1, total_pages: 1 } },
    error: null,
    pending: false,
    confirmation: null,
    selfHref: '#/bank/providers/7',
    canDelete: true,
    ...overrides,
  };
}

function output(overrides) {
  return renderedOutput(ProviderBillsHelper.render(state(overrides), HANDLERS));
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

describe('ProviderBillsHelper', () => {
  it('renders a recurring row with kind, expected amount and due day', () => {
    expect(output().containsInOrder('Rent', 'Recurring', 'Day 5')).toBeTrue();
  });

  it('renders a one-off row with its due date', () => {
    expect(output().containsInOrder('Repair', 'One-off', formatDate('2026-03-10'))).toBeTrue();
  });

  it('shows the due month of a yearly bill', () => {
    expect(output({ data: { provider_bills: [YEARLY], pagination: {} } }).contains(' of ')).toBeTrue();
  });

  it('shows dashes for a missing amount and due day', () => {
    expect(output({ data: { provider_bills: [NO_AMOUNT], pagination: {} } }).containsInOrder('Free', '—', '—')).toBeTrue();
  });

  it('shows a dash for a one-off without due date', () => {
    expect(output({ data: { provider_bills: [{ ...ONE_OFF, due_date: null }], pagination: {} } }).contains('—')).toBeTrue();
  });

  it('shows Add bill, History, Edit and Delete on an active provider', () => {
    const page = output();

    expect(page.contains('Add bill')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/bills/4/history')).toBeTrue();
    expect(page.contains('/bills/4/edit')).toBeTrue();
    expect(page.contains('Delete')).toBeTrue();
  });

  it('hides Delete but keeps Add bill, History and Edit without the delete permission', () => {
    const page = output({ canDelete: false });

    expect(page.contains('Delete')).toBeFalse();
    expect(page.contains('Add bill')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/bills/4/history')).toBeTrue();
    expect(page.contains('/bills/4/edit')).toBeTrue();
  });

  it('renders the Actions header on an active provider', () => {
    expect(output().containsAttribute('aria-label', 'Actions')).toBeTrue();
  });

  it('links each row to its history, in both contexts', () => {
    expect(output().containsAttribute('href', '#/bank/bills/4/history')).toBeTrue();
    expect(output().containsAttribute('href', '#/bank/bills/5/history')).toBeTrue();
    expect(output({ context: { kind: 'organization', orgId: 5 } }).containsAttribute('href', '#/orgs/5/bank/bills/4/history')).toBeTrue();
  });

  describe('on an archived provider', () => {
    const ARCHIVED = { ...ACCOUNT, archived_at: '2026-05-01T00:00:00Z' };

    it('hides Add, Edit and Delete', () => {
      const page = output({ account: ARCHIVED });

      expect(page.contains('Add bill')).toBeFalse();
      expect(page.contains('/edit')).toBeFalse();
      expect(page.contains('>Delete<')).toBeFalse();
      expect(page.contains('Rent')).toBeTrue();
    });

    it('keeps the History link of every row, one-offs included', () => {
      const page = output({ account: ARCHIVED });

      expect(page.containsAttribute('href', '#/bank/bills/4/history')).toBeTrue();
      expect(page.containsAttribute('href', '#/bank/bills/5/history')).toBeTrue();
    });

    it('keeps the History link in the organization context', () => {
      const page = output({ account: ARCHIVED, context: { kind: 'organization', orgId: 5 } });

      expect(page.containsAttribute('href', '#/orgs/5/bank/bills/5/history')).toBeTrue();
    });

    it('renders the Actions header', () => {
      expect(output({ account: ARCHIVED }).containsAttribute('aria-label', 'Actions')).toBeTrue();
    });
  });

  it('shows an empty state', () => {
    expect(output({ data: { provider_bills: [], pagination: {} } }).contains('No bills yet.')).toBeTrue();
  });

  it('renders no body while loading', () => {
    expect(output({ data: null }).contains('<table')).toBeFalse();
  });

  it('calls onDelete with the bill', () => {
    const onDelete = jasmine.createSpy('onDelete');
    const tree = ProviderBillsHelper.render(state(), { ...HANDLERS, onDelete });
    const button = findAll(tree, (node) => node.type === 'button' && node.props.children === 'Delete')[0];

    button.props.onClick();

    expect(onDelete).toHaveBeenCalledWith(RECURRING);
  });

  it('opens the Delete confirmation', () => {
    const tree = ProviderBillsHelper.render(state({ confirmation: RECURRING }), HANDLERS);
    const modal = findAll(tree, (node) => node.type === ConfirmModal)[0];

    expect(modal.props.show).toBeTrue();
  });
});
