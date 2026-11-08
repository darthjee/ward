import React from 'react';
import UpdateValueForm from '../../../../../../../../assets/js/components/resources/bank/investments/common/UpdateValueForm.jsx';
import { initialUpdateValue } from '../../../../../../../../assets/js/components/resources/bank/investments/common/controllers/UpdateValueController.js';
import { classifyError } from '../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const HANDLERS = { onUpdateValueChange: noop, onUpdateValueSubmit: noop, onUpdateValueDismiss: noop };

function output(state = {}) {
  return renderedOutput(React.createElement(UpdateValueForm, {
    state: { ...initialUpdateValue('2026-05-10'), ...state }, currency: 'BRL', handlers: HANDLERS,
  }));
}

describe('UpdateValueForm', () => {
  it('renders the current value in the account currency, the date defaulting to today and the button', () => {
    const page = output();

    expect(page.containsInOrder('Current value (BRL)', 'name="value"', 'Date', 'type="date"', 'value="2026-05-10"', 'Update value'))
      .toBeTrue();
    expect(page.contains('Value unchanged')).toBeFalse();
  });

  it('shows the typed value', () => {
    expect(output({ values: { value: '1050.10', date: '2026-05-01' } }).contains('value="1050.10"')).toBeTrue();
  });

  it('shows the "Value unchanged" notice', () => {
    expect(output({ notice: 'Value unchanged' }).containsInOrder('role="status"', 'Value unchanged')).toBeTrue();
  });

  it('shows the field errors', () => {
    const page = output({ errors: { value: 'Enter a positive amount.', date: 'Date is required' } });

    expect(page.contains('is-invalid')).toBeTrue();
    expect(page.containsElement('div', 'Enter a positive amount.')).toBeTrue();
    expect(page.containsElement('div', 'Date is required')).toBeTrue();
  });

  it('disables the button while posting', () => {
    expect(output({ pending: true }).contains('disabled=""')).toBeTrue();
  });

  it('shows an API error with Retry', () => {
    const error = { ...classifyError(new Error('network')), retry: noop };

    expect(output({ error }).contains('Retry')).toBeTrue();
  });
});
