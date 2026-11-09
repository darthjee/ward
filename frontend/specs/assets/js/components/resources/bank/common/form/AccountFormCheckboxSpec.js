import React from 'react';
import AccountFormCheckbox from '../../../../../../../../assets/js/components/resources/bank/common/form/AccountFormCheckbox.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

function element(props = {}, state = {}) {
  return React.createElement(AccountFormCheckbox, {
    name: 'for_accountant',
    label: 'Business expense',
    state: {
      fields: { for_accountant: true }, fieldErrors: {}, idPrefix: 'prov-', ...state,
    },
    onChange: () => undefined,
    ...props,
  });
}

function input(props, state) {
  return AccountFormCheckbox(element(props, state).props).props.children[0];
}

describe('AccountFormCheckbox', () => {
  it('renders a labelled, checked form-check', () => {
    const page = renderedOutput(element());

    expect(page.containsInOrder('form-check', 'id="prov-for_accountant"', 'checked=""', 'for="prov-for_accountant"', 'Business expense'))
      .toBeTrue();
  });

  it('is unchecked when the field is false', () => {
    expect(renderedOutput(element({}, { fields: { for_accountant: false } })).contains('checked=""')).toBeFalse();
  });

  it('emits a boolean value on change', () => {
    const onChange = jasmine.createSpy('onChange');

    input({ onChange }).props.onChange({ target: { checked: false } });

    expect(onChange).toHaveBeenCalledWith({ target: { name: 'for_accountant', value: false } });
  });

  it('shows the inline error', () => {
    const page = renderedOutput(element({}, { fieldErrors: { for_accountant: 'Invalid' } }));

    expect(page.contains('is-invalid')).toBeTrue();
    expect(page.containsElement('div', 'Invalid')).toBeTrue();
  });
});
