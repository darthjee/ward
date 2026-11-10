import AccountantHandoffHelper from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/AccountantHandoffHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { localToday } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { classifyError } from '../../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };
const SENT_AT = '2026-03-01T12:00:00.000Z';
const CHARGES = [
  {
    id: 7, date: '2026-02-05', description: 'Internet', amount: '-129.90', sent_to_accountant_at: null,
    account: { id: 4, name: 'Office ISP', bank_name: 'Fiber Co', provider_tax_id: null, currency: 'BRL' },
  },
  {
    id: 8, date: '2026-02-06', description: 'Phone', amount: '-70.10', sent_to_accountant_at: SENT_AT,
    account: { id: 6, name: 'Phone line', bank_name: 'Tel Co', provider_tax_id: null, currency: 'BRL' },
  },
  {
    id: 9, date: '2026-02-10', description: 'Hosting', amount: '-20.00', sent_to_accountant_at: null,
    account: { id: 5, name: 'Host', bank_name: null, provider_tax_id: '1', currency: 'USD' },
  },
];

const noop = () => undefined;
const HANDLERS = new Proxy({}, { get: () => noop });

function state(overrides = {}) {
  return {
    context: PERSONAL,
    from: '2026-02-01',
    to: '2026-02-28',
    unsentOnly: true,
    rangeError: null,
    charges: CHARGES,
    loadedRange: { from: '2026-02-01', to: '2026-02-28' },
    loading: false,
    error: null,
    confirming: false,
    marking: false,
    success: null,
    ...overrides,
  };
}

function output(overrides) {
  return renderedOutput(AccountantHandoffHelper.render(state(overrides), HANDLERS));
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

function button(label, overrides) {
  return findAll(AccountantHandoffHelper.render(state(overrides), HANDLERS), (node) => node.props?.children === label)[0];
}

function confirmModal(overrides) {
  return findAll(AccountantHandoffHelper.render(state(overrides), HANDLERS), (node) => node.props?.onConfirm)[0];
}

describe('AccountantHandoffHelper', () => {
  it('renders the back link, the heading, the range and the Unsent only toggle', () => {
    const page = output();

    expect(page.containsInOrder('href="#/bank/providers"', '← Providers', 'Accountant hand-off')).toBeTrue();
    expect(page.containsInOrder('From', 'value="2026-02-01"', 'To', 'value="2026-02-28"', 'checked=""', 'Unsent only')).toBeTrue();
  });

  it('builds the links under an organization', () => {
    const page = output({ context: ORG });

    expect(page.containsAttribute('href', '#/orgs/5/bank/providers')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/providers/4')).toBeTrue();
  });

  it('renders the preview rows with their provider link, amount and sent date', () => {
    const page = output();

    expect(page.containsInOrder('Date', 'Provider', 'Description', 'Amount', 'Currency', 'Sent')).toBeTrue();
    expect(page.containsInOrder(
      '2026-02-05', 'href="#/bank/providers/4"', 'Office ISP', 'Fiber Co', 'Internet', formatMoney('-129.90', 'BRL'), 'BRL', '—',
    )).toBeTrue();
    expect(page.containsInOrder('Phone', localToday(new Date(SENT_AT)), 'Hosting', formatMoney('-20.00', 'USD'), 'USD')).toBeTrue();
  });

  it('shows one total line per currency, never a grand total', () => {
    const page = output();

    expect(page.containsInOrder(`Total BRL: ${formatMoney('-200.00', 'BRL')}`, `Total USD: ${formatMoney('-20.00', 'USD')}`)).toBeTrue();
    expect(page.contains('Total:')).toBeFalse();
  });

  it('shows an empty-state message without rows, with Download allowed and Mark as sent disabled', () => {
    const page = output({ charges: [] });

    expect(page.contains('No charges in this range.')).toBeTrue();
    expect(page.containsTag('table')).toBeFalse();
    expect(button('Download CSV', { charges: [] }).props.disabled).toBeFalse();
    expect(button('Mark as sent', { charges: [] }).props.disabled).toBeTrue();
  });

  it('enables both actions on a loaded preview with rows', () => {
    expect(button('Download CSV').props.disabled).toBeFalse();
    expect(button('Mark as sent').props.disabled).toBeFalse();
  });

  it('disables both actions while a load is in flight', () => {
    expect(button('Download CSV', { loading: true }).props.disabled).toBeTrue();
    expect(button('Mark as sent', { loading: true }).props.disabled).toBeTrue();
    expect(output({ charges: null, loading: true }).contains('Loading')).toBeTrue();
  });

  it('disables Mark as sent while marking', () => {
    expect(button('Mark as sent', { marking: true }).props.disabled).toBeTrue();
  });

  it('shows the inline range error and no preview on an invalid range', () => {
    const page = output({
      from: '2026-03-01', rangeError: 'The start date must not be after the end date.', charges: null,
    });

    expect(page.contains('The start date must not be after the end date.')).toBeTrue();
    expect(page.contains('is-invalid')).toBeTrue();
    expect(page.contains('Loading')).toBeFalse();
    expect(button('Download CSV', { charges: null }).props.disabled).toBeTrue();
  });

  it('shows the API 400 through the error alert', () => {
    const error = classifyError(new ApiError(400, 'The range must not exceed 366 days', 'VALIDATION_FAILED'));

    expect(output({ error, charges: null }).contains('The range must not exceed 366 days')).toBeTrue();
  });

  it('shows the success alert after Mark as sent', () => {
    expect(output({ success: '3 charges marked as sent' }).contains('3 charges marked as sent')).toBeTrue();
    expect(output().contains('marked as sent')).toBeFalse();
  });

  it('confirms Mark as sent with the loaded count', () => {
    const modal = confirmModal({ confirming: true, marking: true });

    expect(modal.props.show).toBeTrue();
    expect(modal.props.pending).toBeTrue();
    expect(modal.props.confirmLabel).toBe('Mark as sent');
    expect(modal.props.children).toBe('Mark 3 charges as sent?');
    expect(confirmModal({ charges: null }).props.children).toBe('Mark 0 charges as sent?');
  });

  it('escapes names and descriptions', () => {
    const page = output({
      charges: [{ ...CHARGES[0], description: '<img src=x>', account: { ...CHARGES[0].account, name: '<script>x</script>' } }],
    });

    expect(page.containsTag('img')).toBeFalse();
    expect(page.containsTag('script')).toBeFalse();
  });
});
