import React from 'react';
import AccountFormSelect from '../../../../../../../../assets/js/components/resources/bank/common/form/AccountFormSelect.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const OPTIONS = [['monthly', 'Monthly'], ['yearly', 'Yearly']];

function output(props = {}, state = {}) {
  return renderedOutput(React.createElement(AccountFormSelect, {
    name: 'interest_period',
    label: 'Interest period',
    options: OPTIONS,
    state: {
      fields: { interest_period: 'yearly' }, fieldErrors: {}, idPrefix: 'debt-', ...state,
    },
    onChange: () => undefined,
    ...props,
  }));
}

describe('AccountFormSelect', () => {
  it('renders a labelled select with the options and the field value selected', () => {
    const page = output();

    expect(page.containsInOrder('for="debt-interest_period"', 'Interest period', 'id="debt-interest_period"')).toBeTrue();
    expect(page.containsInOrder('Monthly', '<option value="yearly" selected="">Yearly')).toBeTrue();
    expect(page.contains('<option value="">')).toBeFalse();
  });

  it('adds an empty first option with a placeholder', () => {
    expect(output({ placeholder: 'Choose…' }, { fields: {} }).containsInOrder('<option value="" selected="">Choose…', 'Monthly'))
      .toBeTrue();
  });

  it('shows the inline error', () => {
    const page = output({}, { fieldErrors: { interest_period: 'Choose the interest period' } });

    expect(page.contains('is-invalid')).toBeTrue();
    expect(page.containsElement('div', 'Choose the interest period')).toBeTrue();
  });
});
