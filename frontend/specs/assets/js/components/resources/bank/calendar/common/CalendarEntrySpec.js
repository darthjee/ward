import React from 'react';
import CalendarEntry, { occurrenceKey } from '../../../../../../../../assets/js/components/resources/bank/calendar/common/CalendarEntry.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

function occ(overrides = {}) {
  return {
    kind: 'debt',
    source_account: { id: 3, name: 'Loan', type: 'debt' },
    bill: null,
    nominal_date: '2026-11-14',
    effective_date: '2026-11-14',
    expected_amount: '10.00',
    currency: 'BRL',
    status: 'open',
    payment: null,
    default_paying_account: null,
    ...overrides,
  };
}

function render(occurrence, context = PERSONAL) {
  const noop = () => undefined;

  return renderedOutput(React.createElement(CalendarEntry, {
    context, occurrence, onPay: noop, onSkip: noop, onUndo: noop, variant: 'list',
  }));
}

describe('CalendarEntry', () => {
  it('shows the nominal date only when shifted', () => {
    expect(render(occ()).contains('moved to')).toBeFalse();
    expect(render(occ({ effective_date: '2026-11-16' })).contains('moved to')).toBeTrue();
  });

  it('omits the amount when null', () => {
    expect(render(occ({ expected_amount: null })).contains('calendar-entry-amount')).toBeFalse();
    expect(render(occ()).contains('calendar-entry-amount')).toBeTrue();
  });

  describe('links', () => {
    it('links a debt in Personal and in an organization', () => {
      expect(render(occ()).containsAttribute('href', '#/bank/debts/3')).toBeTrue();
      expect(render(occ(), ORG).containsAttribute('href', '#/orgs/5/bank/debts/3')).toBeTrue();
    });

    it('links a provider', () => {
      const p = occ({ kind: 'provider', source_account: { id: 4, name: 'Gym', type: 'provider_expense' } });

      expect(render(p).containsAttribute('href', '#/bank/providers/4')).toBeTrue();
      expect(render(p, ORG).containsAttribute('href', '#/orgs/5/bank/providers/4')).toBeTrue();
    });

    it('links a bill to its edit page and shows its description', () => {
      const b = occ({
        kind: 'bill',
        source_account: { id: 4, name: 'Gym', type: 'provider_expense' },
        bill: { id: 9, description: 'Repair' },
      });

      expect(render(b).containsAttribute('href', '#/bank/bills/9/edit')).toBeTrue();
      expect(render(b, ORG).containsAttribute('href', '#/orgs/5/bank/bills/9/edit')).toBeTrue();
      expect(render(b).contains('Repair')).toBeTrue();
    });
  });

  describe('status', () => {
    it('highlights overdue', () => {
      expect(render(occ({ status: 'overdue' })).contains('text-danger')).toBeTrue();
    });

    it('mutes paid and skipped', () => {
      expect(render(occ({ status: 'paid' })).contains('text-muted')).toBeTrue();
      expect(render(occ({ status: 'skipped' })).contains('text-muted')).toBeTrue();
    });

    it('does not mute open', () => {
      expect(render(occ()).contains('text-muted')).toBeFalse();
    });
  });

  describe('actions', () => {
    it('offers Pay and Skip for open and overdue', () => {
      ['open', 'overdue'].forEach((status) => {
        const out = render(occ({ status }));

        expect(out.containsElement('button', 'Pay')).toBeTrue();
        expect(out.containsElement('button', 'Skip')).toBeTrue();
        expect(out.containsElement('button', 'Undo')).toBeFalse();
      });
    });

    it('offers Undo for paid and skipped', () => {
      ['paid', 'skipped'].forEach((status) => {
        const out = render(occ({ status }));

        expect(out.containsElement('button', 'Undo')).toBeTrue();
        expect(out.containsElement('button', 'Pay')).toBeFalse();
      });
    });
  });

  it('escapes names and descriptions', () => {
    const name = render(occ({ source_account: { id: 3, name: '<script>x</script>', type: 'debt' } }));
    const description = render(occ({ kind: 'bill', bill: { id: 1, description: '<script>x</script>' } }));

    expect(name.contains('&lt;script&gt;')).toBeTrue();
    expect(name.contains('<script>')).toBeFalse();
    expect(description.contains('&lt;script&gt;')).toBeTrue();
  });

  describe('occurrenceKey', () => {
    it('combines kind, account, bill and nominal date', () => {
      expect(occurrenceKey(occ())).toEqual('debt|3||2026-11-14');
      expect(occurrenceKey(occ({ kind: 'bill', bill: { id: 9 } }))).toEqual('bill|3|9|2026-11-14');
    });
  });
});
