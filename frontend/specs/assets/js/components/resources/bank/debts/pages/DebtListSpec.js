import React from 'react';
import DebtList from '../../../../../../../../assets/js/components/resources/bank/debts/pages/DebtList.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('DebtList', () => {
  it('renders its heading', () => {
    expect(renderedOutput(React.createElement(DebtList)).containsElement('h1', 'Debts')).toBeTrue();
  });
});
