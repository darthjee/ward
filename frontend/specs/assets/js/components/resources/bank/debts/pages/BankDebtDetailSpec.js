import React from 'react';
import BankDebtDetail from '../../../../../../../../assets/js/components/resources/bank/debts/pages/BankDebtDetail.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BankDebtDetail', () => {
  it('renders its heading', () => {
    expect(renderedOutput(React.createElement(BankDebtDetail)).containsElement('h1', 'Debt')).toBeTrue();
  });
});
