import React from 'react';
import MonthGrid from '../../../../../../../../assets/js/components/resources/bank/calendar/common/MonthGrid.jsx';
import MonthAgenda from '../../../../../../../../assets/js/components/resources/bank/calendar/common/MonthAgenda.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const HANDLERS = { onPay: noop, onSkip: noop, onUndo: noop };
const CONTEXT = { kind: 'personal' };

function occ(name, date, status = 'open') {
  return {
    kind: 'debt',
    source_account: { id: 3, name, type: 'debt' },
    bill: null,
    nominal_date: date,
    effective_date: date,
    expected_amount: '10.00',
    currency: 'BRL',
    status,
  };
}

describe('MonthGrid', () => {
  const byDay = new Map([
    ['2026-11-16', [occ('Late', '2026-11-16', 'overdue')]],
    ['2026-11-20', [occ('Done', '2026-11-20', 'paid')]],
  ]);

  it('is hidden on narrow screens and starts on Monday', () => {
    const out = renderedOutput(React.createElement(MonthGrid, { month: '2026-11', byDay, context: CONTEXT, handlers: HANDLERS }));

    expect(out.contains('d-none d-md-block')).toBeTrue();
    expect(out.containsInOrder('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')).toBeTrue();
  });

  it('shows the entries, overdue highlighted and paid muted', () => {
    const out = renderedOutput(React.createElement(MonthGrid, { month: '2026-11', byDay, context: CONTEXT, handlers: HANDLERS }));

    expect(out.containsInOrder('Late', 'Done')).toBeTrue();
    expect(out.contains('text-danger')).toBeTrue();
    expect(out.contains('text-muted opacity-50')).toBeTrue();
  });
});

describe('MonthAgenda', () => {
  it('lists only the days with entries, in order', () => {
    const byDay = new Map([
      ['2026-11-20', [occ('Second', '2026-11-20')]],
      ['2026-11-03', [occ('First', '2026-11-03')]],
    ]);
    const out = renderedOutput(React.createElement(MonthAgenda, { byDay, context: CONTEXT, handlers: HANDLERS }));

    expect(out.contains('d-md-none')).toBeTrue();
    expect(out.containsInOrder('First', 'Second')).toBeTrue();
    expect(out.containsElement('h3', '2026-11-04')).toBeFalse();
  });

  it('escapes names', () => {
    const byDay = new Map([['2026-11-03', [occ('<script>x</script>', '2026-11-03')]]]);
    const out = renderedOutput(React.createElement(MonthAgenda, { byDay, context: CONTEXT, handlers: HANDLERS }));

    expect(out.contains('&lt;script&gt;')).toBeTrue();
    expect(out.contains('<script>')).toBeFalse();
  });
});
