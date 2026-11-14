import BankCalendarListHelper from '../../../../../../../../../assets/js/components/resources/bank/calendar/pages/helpers/BankCalendarListHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };
const HANDLERS = { onRetry: noop, onDismiss: noop };
const ACTIONS = {
  state: { dialog: null, fields: {}, fieldErrors: {}, pending: false, error: null, accounts: [] },
  handlers: { onPay: noop, onSkip: noop, onUndo: noop, onConfirm: noop, onCancel: noop, onFieldChange: noop, onRetry: noop, onDismiss: noop },
};

function occ(name, date, overrides = {}) {
  return {
    kind: 'debt',
    source_account: { id: 3, name, type: 'debt' },
    bill: null,
    nominal_date: date,
    effective_date: date,
    expected_amount: '10.00',
    currency: 'BRL',
    status: 'open',
    ...overrides,
  };
}

function render(data, context = PERSONAL, error = null) {
  return renderedOutput(BankCalendarListHelper.render({
    context, data, error, actions: ACTIONS,
  }, HANDLERS));
}

const EMPTY = { occurrences: [], totals: [] };

describe('BankCalendarListHelper', () => {
  it('shows Loading until the data arrives', () => {
    expect(render(null).contains('Loading')).toBeTrue();
    expect(render(null, PERSONAL, { kind: 'transient', message: 'Boom' }).contains('Loading')).toBeFalse();
  });

  it('links to the month view in both contexts', () => {
    expect(render(null).containsAttribute('href', '#/bank/calendar/month')).toBeTrue();
    expect(render(null, ORG).containsAttribute('href', '#/orgs/5/bank/calendar/month')).toBeTrue();
  });

  describe('empty state', () => {
    it('shows the message, the Add bill link and the hint', () => {
      const out = render({ overdue: EMPTY, upcoming: EMPTY });

      expect(out.contains('No bills coming up')).toBeTrue();
      expect(out.containsAttribute('href', '#/bank/bills/new')).toBeTrue();
      expect(out.contains('due day appear here')).toBeTrue();
    });

    it('links Add bill under an organization', () => {
      expect(render({ overdue: EMPTY, upcoming: EMPTY }, ORG).containsAttribute('href', '#/orgs/5/bank/bills/new')).toBeTrue();
    });
  });

  describe('overdue', () => {
    it('is hidden when empty', () => {
      const out = render({ overdue: EMPTY, upcoming: { occurrences: [occ('Up', '2026-11-16')], totals: [] } });

      expect(out.containsElement('h2', 'Overdue')).toBeFalse();
      expect(out.containsElement('h2', 'Upcoming')).toBeTrue();
    });

    it('keeps the server order (oldest first) and shows the open totals', () => {
      const out = render({
        overdue: {
          occurrences: [occ('Older', '2026-10-01', { status: 'overdue' }), occ('Newer', '2026-11-01', { status: 'overdue' })],
          totals: [{ currency: 'BRL', open: '20.00' }, { currency: 'USD', open: '5.00' }],
        },
        upcoming: EMPTY,
      });

      expect(out.containsElement('h2', 'Overdue')).toBeTrue();
      expect(out.containsInOrder('Older', 'Newer')).toBeTrue();
      expect(out.contains('BRL')).toBeTrue();
      expect(out.contains('USD')).toBeTrue();
    });
  });

  describe('upcoming', () => {
    it('groups by week, a shifted weekend entry landing in the next week', () => {
      const out = render({
        overdue: EMPTY,
        upcoming: {
          occurrences: [
            occ('Fri', '2026-11-13'),
            occ('Sat', '2026-11-14', { effective_date: '2026-11-16' }),
          ],
          totals: [],
        },
      });

      expect(out.contains('Week of')).toBeTrue();
      expect(out.containsInOrder('Fri', 'Week of', 'Sat')).toBeTrue();
    });

    it('does not list an occurrence already in Overdue twice', () => {
      const dup = occ('Dup', '2026-11-14', { status: 'overdue' });
      const out = render({
        overdue: { occurrences: [dup], totals: [] },
        upcoming: { occurrences: [dup], totals: [] },
      });

      expect(out.containsElement('h2', 'Upcoming')).toBeFalse();
      expect(out.containsElement('h2', 'Overdue')).toBeTrue();
    });

    it('escapes names', () => {
      const out = render({
        overdue: EMPTY, upcoming: { occurrences: [occ('<script>x</script>', '2026-11-16')], totals: [] },
      });

      expect(out.contains('&lt;script&gt;')).toBeTrue();
      expect(out.contains('<script>')).toBeFalse();
    });
  });
});
