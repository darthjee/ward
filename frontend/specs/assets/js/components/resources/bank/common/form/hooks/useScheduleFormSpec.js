import React from 'react';
import useScheduleForm from '../../../../../../../../../assets/js/components/resources/bank/common/form/hooks/useScheduleForm.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const noop = () => undefined;

function run(options) {
  let result;
  const page = {
    context: { kind: 'personal' },
    setFields: jasmine.createSpy('setFields'),
    state: { fields: { currency: 'BRL' } },
    handlers: { onFieldChange: noop, onCurrencyChange: noop, onSubmit: noop },
  };

  function Probe() {
    result = useScheduleForm(page, options);
    return null;
  }

  renderedOutput(React.createElement(Probe));

  return { page, result };
}

describe('useScheduleForm', () => {
  it('adds the paying accounts (loading) to the state', () => {
    const { result } = run();

    expect(result.state).toEqual({ fields: { currency: 'BRL' }, payingAccounts: null });
  });

  it('swaps the field handler for the autofilling one, keeping the others', () => {
    const { page, result } = run();

    expect(result.handlers.onFieldChange).not.toBe(noop);
    expect(result.handlers.onCurrencyChange).toBe(noop);
    expect(result.handlers.onSubmit).toBe(noop);

    result.handlers.onFieldChange({ target: { name: 'due_day', value: '5' } });

    expect(page.setFields).toHaveBeenCalled();
  });

  it('swaps the currency handler on a create page', () => {
    const { page, result } = run({ create: true });

    expect(result.handlers.onCurrencyChange).not.toBe(noop);

    result.handlers.onCurrencyChange('USD');

    expect(page.setFields).toHaveBeenCalled();
  });
});
