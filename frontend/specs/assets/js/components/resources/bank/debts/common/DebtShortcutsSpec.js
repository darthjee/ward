import React from 'react';
import DebtShortcuts from '../../../../../../../../assets/js/components/resources/bank/debts/common/DebtShortcuts.jsx';
import AccountShortcuts from '../../../../../../../../assets/js/components/resources/bank/common/detail/AccountShortcuts.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const DEBT = { id: 7, archived_at: null, debt: { instalment_amount: '500.00' } };

function buttons(element) {
  return AccountShortcuts(element.props).props.children[0];
}

describe('DebtShortcuts', () => {
  let onStartNew;

  beforeEach(() => {
    onStartNew = jasmine.createSpy('onStartNew');
  });

  it('renders Add payment then Add interest', () => {
    expect(renderedOutput(React.createElement(DebtShortcuts, { account: DEBT, onStartNew }))
      .containsInOrder('Add payment', 'Add interest')).toBeTrue();
  });

  it('opens a payment (In, "Payment") with the instalment amount suggested', () => {
    buttons(DebtShortcuts({ account: DEBT, onStartNew }))[0].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'in', description: 'Payment', amount: '500.00' });
  });

  it('opens a payment with an empty amount without an instalment amount', () => {
    buttons(DebtShortcuts({ account: { ...DEBT, debt: { instalment_amount: null } }, onStartNew }))[0].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'in', description: 'Payment', amount: '' });
  });

  it('opens interest (Out, "Interest") with an empty amount', () => {
    buttons(DebtShortcuts({ account: DEBT, onStartNew }))[1].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'out', description: 'Interest', amount: '' });
  });

  it('is hidden on an archived debt', () => {
    expect(renderedOutput(React.createElement(DebtShortcuts, {
      account: { ...DEBT, archived_at: '2026-02-01T00:00:00.000Z' }, onStartNew,
    })).isEmpty()).toBeTrue();
  });
});
