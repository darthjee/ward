import BankCalendarMonthHelper from '../../../../../../../../../assets/js/components/resources/bank/calendar/pages/helpers/BankCalendarMonthHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };
const HANDLERS = { onRetry: noop, onDismiss: noop };
const ACTIONS = {
  state: { dialog: null, fields: {}, fieldErrors: {}, pending: false, error: null, accounts: [] },
  handlers: { onPay: noop, onSkip: noop, onUndo: noop, onConfirm: noop, onCancel: noop, onFieldChange: noop, onRetry: noop, onDismiss: noop },
};
const TODAY = '2026-11-14';

function render({ month = '2026-11', context = PERSONAL, data = null, error = null } = {}) {
  return renderedOutput(BankCalendarMonthHelper.render({
    context, month, today: TODAY, data, error, actions: ACTIONS,
  }, HANDLERS));
}

describe('BankCalendarMonthHelper', () => {
  it('shows Loading, the title and the list view link', () => {
    const out = render();

    expect(out.contains('Loading')).toBeTrue();
    expect(out.containsElement('h2', 'November 2026')).toBeTrue();
    expect(out.containsAttribute('href', '#/bank/calendar')).toBeTrue();
  });

  it('builds previous and next hrefs in both contexts', () => {
    const out = render();
    const org = render({ context: ORG });

    expect(out.containsAttribute('href', '#/bank/calendar/month?m=2026-10')).toBeTrue();
    expect(out.containsAttribute('href', '#/bank/calendar/month?m=2026-12')).toBeTrue();
    expect(org.containsAttribute('href', '#/orgs/5/bank/calendar/month?m=2026-12')).toBeTrue();
  });

  it('crosses year boundaries', () => {
    expect(render({ month: '2026-12' }).containsAttribute('href', '#/bank/calendar/month?m=2027-01')).toBeTrue();
    expect(render({ month: '2026-01' }).containsAttribute('href', '#/bank/calendar/month?m=2025-12')).toBeTrue();
  });

  it('disables Next at the current month + 12', () => {
    const out = render({ month: '2027-11' });

    expect(out.containsAttribute('aria-disabled', 'true')).toBeTrue();
    expect(out.containsAttribute('href', '#/bank/calendar/month?m=2027-12')).toBeFalse();
    expect(out.containsAttribute('href', '#/bank/calendar/month?m=2027-10')).toBeTrue();
  });

  it('shows the totals of each currency, the grid and the agenda', () => {
    const out = render({
      data: {
        month: '2026-11',
        occurrences: [{
          kind: 'debt', source_account: { id: 3, name: 'Loan', type: 'debt' }, bill: null, nominal_date: '2026-11-16',
          effective_date: '2026-11-16', expected_amount: '10.00', currency: 'BRL', status: 'open',
        }],
        totals: [
          { currency: 'BRL', expected: '10.00', paid: '0.00', open: '10.00' },
          { currency: 'USD', expected: '5.00', paid: '5.00', open: '0.00' },
        ],
      },
    });

    expect(out.contains('USD')).toBeTrue();
    expect(out.contains('expected:')).toBeTrue();
    expect(out.contains('d-none d-md-block')).toBeTrue();
    expect(out.contains('d-md-none')).toBeTrue();
  });
});
