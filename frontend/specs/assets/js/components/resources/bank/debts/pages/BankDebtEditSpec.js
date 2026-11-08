import React from 'react';
import BankDebtEdit from '../../../../../../../../assets/js/components/resources/bank/debts/pages/BankDebtEdit.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BankDebtEdit', () => {
  it('renders its heading', () => {
    expect(renderedOutput(React.createElement(BankDebtEdit)).containsElement('h1', 'Edit debt')).toBeTrue();
  });
});
