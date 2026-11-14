import React from 'react';
import PayForm from '../../../../../../../../assets/js/components/resources/bank/calendar/common/PayForm.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const ACCOUNTS = [
  { id: 4, name: 'Main', currency: 'BRL', type: 'regular' },
  { id: 5, name: 'Dollars', currency: 'USD', type: 'regular' },
];

function render(kind, state = { fields: { amount: '10.00', record_charge: true }, fieldErrors: {} }) {
  return renderedOutput(React.createElement(PayForm, {
    occurrence: { kind, currency: 'BRL' }, accounts: ACCOUNTS, state, onChange: () => undefined,
  }));
}

describe('PayForm', () => {
  it('shows the charge checkbox for provider and bill, checked', () => {
    expect(render('provider').contains('Record charge')).toBeTrue();
    expect(render('bill').contains('Record charge')).toBeTrue();
    expect(render('bill').containsAttribute('checked', '')).toBeTrue();
  });

  it('hides the charge checkbox for a debt', () => {
    expect(render('debt').contains('Record charge')).toBeFalse();
  });

  it('offers only the accounts in the currency', () => {
    const out = render('debt');

    expect(out.contains('Main')).toBeTrue();
    expect(out.contains('Dollars')).toBeFalse();
  });

  it('shows the prefilled amount and a field error', () => {
    const out = render('debt', { fields: { amount: '10.00' }, fieldErrors: { paid_on: 'Date cannot be in the future' } });

    expect(out.containsAttribute('value', '10.00')).toBeTrue();
    expect(out.contains('Date cannot be in the future')).toBeTrue();
  });
});
