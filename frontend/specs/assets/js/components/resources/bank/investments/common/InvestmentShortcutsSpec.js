import React from 'react';
import InvestmentShortcuts from '../../../../../../../../assets/js/components/resources/bank/investments/common/InvestmentShortcuts.jsx';
import AccountShortcuts from '../../../../../../../../assets/js/components/resources/bank/common/detail/AccountShortcuts.jsx';
import { initialUpdateValue } from '../../../../../../../../assets/js/components/resources/bank/investments/common/controllers/UpdateValueController.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const INVESTMENT = {
  id: 3, archived_at: null, currency: 'USD', balance: '10.00',
};
const noop = () => undefined;
const HANDLERS = { onUpdateValueChange: noop, onUpdateValueSubmit: noop, onUpdateValueDismiss: noop };

describe('InvestmentShortcuts', () => {
  let onStartNew;

  beforeEach(() => {
    onStartNew = jasmine.createSpy('onStartNew');
  });

  function props(account = INVESTMENT) {
    return {
      account, onStartNew, updateValue: initialUpdateValue('2026-05-10'), handlers: HANDLERS,
    };
  }

  function buttons() {
    return AccountShortcuts(InvestmentShortcuts(props()).props).props.children[0];
  }

  it('renders Add application, Add withdrawal, then the Update value form', () => {
    expect(renderedOutput(React.createElement(InvestmentShortcuts, props()))
      .containsInOrder('Add application', 'Add withdrawal', 'Current value (USD)', 'Update value')).toBeTrue();
  });

  it('opens an application (In, "Application") with an empty amount', () => {
    buttons()[0].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'in', description: 'Application', amount: '' });
  });

  it('opens a withdrawal (Out, "Withdrawal") with an empty amount', () => {
    buttons()[1].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'out', description: 'Withdrawal', amount: '' });
  });

  it('hides every shortcut, including Update value, on an archived investment', () => {
    expect(renderedOutput(React.createElement(InvestmentShortcuts, props({
      ...INVESTMENT, archived_at: '2026-02-01T00:00:00.000Z',
    }))).isEmpty()).toBeTrue();
  });
});
