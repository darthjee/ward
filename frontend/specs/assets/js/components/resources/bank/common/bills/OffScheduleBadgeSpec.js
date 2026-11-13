import React from 'react';
import OffScheduleBadge from '../../../../../../../../assets/js/components/resources/bank/common/bills/OffScheduleBadge.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('OffScheduleBadge', () => {
  it('marks an off-schedule payment', () => {
    expect(renderedOutput(React.createElement(OffScheduleBadge, { payment: { off_schedule: true } })).contains('Off-schedule'))
      .toBeTrue();
  });

  it('renders nothing for an on-schedule payment', () => {
    expect(renderedOutput(React.createElement(OffScheduleBadge, { payment: { off_schedule: false } })).isEmpty()).toBeTrue();
  });
});
