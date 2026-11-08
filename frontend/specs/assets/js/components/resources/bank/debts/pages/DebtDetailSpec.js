import React from 'react';
import DebtDetail from '../../../../../../../../assets/js/components/resources/bank/debts/pages/DebtDetail.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('DebtDetail', () => {
  it('renders its heading', () => {
    expect(renderedOutput(React.createElement(DebtDetail)).containsElement('h1', 'Debt')).toBeTrue();
  });
});
