import React from 'react';
import CalendarTotals from '../../../../../../../../assets/js/components/resources/bank/calendar/common/CalendarTotals.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('CalendarTotals', () => {
  const totals = [
    { currency: 'BRL', expected: '100.00', paid: '40.00', open: '60.00' },
    { currency: 'USD', expected: '10.00', paid: '0.00', open: '10.00' },
  ];

  it('renders nothing for no totals', () => {
    expect(renderedOutput(React.createElement(CalendarTotals, { totals: [], columns: ['open'] })).isEmpty()).toBeTrue();
  });

  it('renders one line per currency with the requested columns', () => {
    const out = renderedOutput(React.createElement(CalendarTotals, { totals, columns: ['expected', 'paid', 'open'] }));

    expect(out.contains('BRL')).toBeTrue();
    expect(out.contains('USD')).toBeTrue();
    expect(out.contains('expected:')).toBeTrue();
    expect(out.contains('paid:')).toBeTrue();
    expect(out.contains('open:')).toBeTrue();
  });

  it('shows only the open column for the list view', () => {
    const out = renderedOutput(React.createElement(CalendarTotals, { totals, columns: ['open'] }));

    expect(out.contains('open:')).toBeTrue();
    expect(out.contains('expected:')).toBeFalse();
  });
});
