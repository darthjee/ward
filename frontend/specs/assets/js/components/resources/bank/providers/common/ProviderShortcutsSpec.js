import React from 'react';
import ProviderShortcuts from '../../../../../../../../assets/js/components/resources/bank/providers/common/ProviderShortcuts.jsx';
import AccountShortcuts from '../../../../../../../../assets/js/components/resources/bank/common/detail/AccountShortcuts.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const PROVIDER = { id: 4, archived_at: null, provider_expense: { expected_amount: '200.00' } };

function buttons(element) {
  return AccountShortcuts(element.props).props.children[0];
}

describe('ProviderShortcuts', () => {
  let onStartNew;

  beforeEach(() => {
    onStartNew = jasmine.createSpy('onStartNew');
  });

  it('renders Add charge then Add payment', () => {
    expect(renderedOutput(React.createElement(ProviderShortcuts, { account: PROVIDER, onStartNew }))
      .containsInOrder('Add charge', 'Add payment')).toBeTrue();
  });

  it('opens a charge (Out) with the expected amount suggested', () => {
    buttons(ProviderShortcuts({ account: PROVIDER, onStartNew }))[0].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'out', description: 'Charge', amount: '200.00' });
  });

  it('opens a charge with an empty amount without an expected amount', () => {
    buttons(ProviderShortcuts({ account: { ...PROVIDER, provider_expense: null }, onStartNew }))[0].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'out', description: 'Charge', amount: '' });
  });

  it('opens a payment (In) with an empty amount', () => {
    buttons(ProviderShortcuts({ account: PROVIDER, onStartNew }))[1].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'in', description: 'Payment', amount: '' });
  });

  it('is hidden on an archived provider', () => {
    expect(renderedOutput(React.createElement(ProviderShortcuts, {
      account: { ...PROVIDER, archived_at: '2026-02-01T00:00:00.000Z' }, onStartNew,
    })).isEmpty()).toBeTrue();
  });
});
