import React from 'react';
import BankDebtNew from '../../../../../../../../assets/js/components/resources/bank/debts/pages/BankDebtNew.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BankDebtNew', () => {
  it('renders its heading', () => {
    expect(renderedOutput(React.createElement(BankDebtNew)).containsElement('h1', 'New debt')).toBeTrue();
  });
});
