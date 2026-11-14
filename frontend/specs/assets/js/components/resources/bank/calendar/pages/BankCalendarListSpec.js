import React from 'react';
import BankCalendarList from '../../../../../../../../assets/js/components/resources/bank/calendar/pages/BankCalendarList.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BankCalendarList', () => {
  it('renders the loading state with the month view link', () => {
    const page = renderedOutput(React.createElement(BankCalendarList));

    expect(page.containsElement('h1', 'Calendar')).toBeTrue();
    expect(page.contains('Loading')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/calendar/month')).toBeTrue();
  });
});
