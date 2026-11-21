import React from 'react';
import EmptyAccountList from '../../../../../../../../assets/js/components/resources/bank/common/list/EmptyAccountList.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('EmptyAccountList', () => {
  it('renders the message and the create button', () => {
    const page = renderedOutput(React.createElement(EmptyAccountList, {
      message: 'No debts yet', href: '#/bank/debts/new', label: 'Create a debt',
    }));

    expect(page.containsElement('p', 'No debts yet')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/debts/new"', 'Create a debt')).toBeTrue();
  });

  it('keeps the message but omits the create button without an href', () => {
    const page = renderedOutput(React.createElement(EmptyAccountList, {
      message: 'No debts yet', href: null, label: 'Create a debt',
    }));

    expect(page.containsElement('p', 'No debts yet')).toBeTrue();
    expect(page.contains('Create a debt')).toBeFalse();
    expect(page.containsTag('a')).toBeFalse();
  });
});
