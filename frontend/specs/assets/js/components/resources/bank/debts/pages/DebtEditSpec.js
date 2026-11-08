import React from 'react';
import DebtEdit from '../../../../../../../../assets/js/components/resources/bank/debts/pages/DebtEdit.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('DebtEdit', () => {
  it('renders its heading', () => {
    expect(renderedOutput(React.createElement(DebtEdit)).containsElement('h1', 'Edit debt')).toBeTrue();
  });
});
