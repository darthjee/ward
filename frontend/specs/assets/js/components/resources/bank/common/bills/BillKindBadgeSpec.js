import React from 'react';
import BillKindBadge from '../../../../../../../../assets/js/components/resources/bank/common/bills/BillKindBadge.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('BillKindBadge', () => {
  it('labels a recurring bill', () => {
    expect(renderedOutput(React.createElement(BillKindBadge, { kind: 'recurring' })).contains('Recurring')).toBeTrue();
  });

  it('labels a one-off bill', () => {
    expect(renderedOutput(React.createElement(BillKindBadge, { kind: 'one_off' })).contains('One-off')).toBeTrue();
  });

  it('falls back to the raw kind', () => {
    expect(renderedOutput(React.createElement(BillKindBadge, { kind: 'x' })).contains('>x<')).toBeTrue();
  });
});
