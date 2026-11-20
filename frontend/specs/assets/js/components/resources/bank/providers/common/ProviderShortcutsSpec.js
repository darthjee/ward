import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProviderShortcuts from '../../../../../../../../assets/js/components/resources/bank/providers/common/ProviderShortcuts.jsx';
import AccountShortcuts from '../../../../../../../../assets/js/components/resources/bank/common/detail/AccountShortcuts.jsx';
import ProviderBillsClient from '../../../../../../../../assets/js/client/ProviderBillsClient.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const CONTEXT = { kind: 'personal' };
const PROVIDER = { id: 4, archived_at: null, provider_expense: { for_accountant: true, provider_tax_id: null } };

function renderElement(props) {
  let element;

  function Probe() {
    element = ProviderShortcuts(props);
    return null;
  }

  renderToStaticMarkup(React.createElement(Probe));
  return element;
}

function buttons(element) {
  return AccountShortcuts(element.props).props.children[0];
}

describe('ProviderShortcuts', () => {
  let onStartNew;

  beforeEach(() => {
    onStartNew = jasmine.createSpy('onStartNew');
    spyOn(ProviderBillsClient, 'listProviderBills').and.resolveTo({ provider_bills: [], pagination: { total_count: 0 } });
  });

  it('renders its children after the shortcuts', () => {
    expect(renderedOutput(React.createElement(ProviderShortcuts, { context: CONTEXT, account: PROVIDER, onStartNew }, React.createElement('a', null, 'Extra')))
      .containsInOrder('Add charge', 'Add payment', 'Extra')).toBeTrue();
  });

  it('renders Add charge then Add payment', () => {
    expect(renderedOutput(React.createElement(ProviderShortcuts, { context: CONTEXT, account: PROVIDER, onStartNew }))
      .containsInOrder('Add charge', 'Add payment')).toBeTrue();
  });

  it('opens a charge (Out) with an empty amount until the recurring bills are loaded', () => {
    buttons(renderElement({ context: CONTEXT, account: PROVIDER, onStartNew }))[0].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'out', description: 'Charge', amount: '' });
  });

  it('no longer reads an expected amount from the provider details', () => {
    const account = { ...PROVIDER, provider_expense: { expected_amount: '200.00' } };

    buttons(renderElement({ context: CONTEXT, account, onStartNew }))[0].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'out', description: 'Charge', amount: '' });
  });

  it('opens a payment (In) with an empty amount', () => {
    buttons(renderElement({ context: CONTEXT, account: PROVIDER, onStartNew }))[1].props.onClick();

    expect(onStartNew).toHaveBeenCalledWith({ direction: 'in', description: 'Payment', amount: '' });
  });

  it('is hidden on an archived provider', () => {
    expect(renderedOutput(React.createElement(ProviderShortcuts, {
      context: CONTEXT, account: { ...PROVIDER, archived_at: '2026-02-01T00:00:00.000Z' }, onStartNew,
    })).isEmpty()).toBeTrue();
  });
});
