import React from 'react';
import DebtNew from '../../../../../../../../assets/js/components/resources/bank/debts/pages/DebtNew.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('DebtNew', () => {
  it('renders its heading', () => {
    expect(renderedOutput(React.createElement(DebtNew)).containsElement('h1', 'New debt')).toBeTrue();
  });
});
