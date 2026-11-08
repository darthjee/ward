import React from 'react';
import AccountFormInput, { readField } from '../../../../../../../../assets/js/components/resources/bank/common/form/AccountFormInput.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const noop = () => undefined;

function output(props = {}, state = {}) {
  return renderedOutput(React.createElement(AccountFormInput, {
    name: 'bank_name',
    label: 'Creditor',
    state: {
      fields: { bank_name: 'Bank A' }, fieldErrors: {}, idPrefix: 'debt-', ...state,
    },
    onChange: noop,
    ...props,
  }));
}

describe('AccountFormInput', () => {
  it('renders a labelled input with the field value', () => {
    const page = output();

    expect(page.containsInOrder('for="debt-bank_name"', 'Creditor', 'id="debt-bank_name"')).toBeTrue();
    expect(page.containsAttribute('value', 'Bank A')).toBeTrue();
    expect(page.containsAttribute('type', 'text')).toBeTrue();
  });

  it('renders a textarea', () => {
    expect(output({ name: 'notes', type: 'textarea' }).containsTag('textarea')).toBeTrue();
  });

  it('passes extra attributes', () => {
    expect(output({ extra: { inputMode: 'decimal' } }).containsAttribute('inputMode', 'decimal')).toBeTrue();
  });

  it('shows the inline error', () => {
    const page = output({}, { fieldErrors: { bank_name: 'Too long' } });

    expect(page.contains('is-invalid')).toBeTrue();
    expect(page.containsElement('div', 'Too long')).toBeTrue();
  });

  it('renders an empty value for a missing field', () => {
    expect(output({ name: 'branch' }).containsAttribute('value', '')).toBeTrue();
  });

  it('reads own properties only', () => {
    expect(readField(null, 'x')).toBeUndefined();
    expect(readField({ x: 1 }, 'x')).toBe(1);
    expect(readField({}, 'toString')).toBeUndefined();
  });
});
