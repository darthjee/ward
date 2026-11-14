import React from 'react';
import BankCalendarMonth from '../../../../../../../../assets/js/components/resources/bank/calendar/pages/BankCalendarMonth.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BankCalendarMonth', () => {
  it('renders the loading state with the list view link', () => {
    const page = renderedOutput(React.createElement(BankCalendarMonth));

    expect(page.containsElement('h1', 'Calendar')).toBeTrue();
    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/calendar')).toBeTrue();
  });
});
