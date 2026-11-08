import React from 'react';
import RatePeriodSelect, {
  PERIOD_OPTIONS,
} from '../../../../../../../../assets/js/components/resources/bank/common/form/RatePeriodSelect.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

function output(fields) {
  return renderedOutput(React.createElement(RatePeriodSelect, {
    rateName: 'yield_rate',
    periodName: 'yield_period',
    label: 'Yield period',
    state: { fields, fieldErrors: {}, idPrefix: 'inv-' },
    onChange: () => undefined,
  }));
}

describe('RatePeriodSelect', () => {
  it('exposes the monthly / yearly options', () => {
    expect(PERIOD_OPTIONS).toEqual([['monthly', 'Monthly'], ['yearly', 'Yearly']]);
  });

  it('renders the period select once a rate is entered', () => {
    const page = output({ yield_rate: '1.2', yield_period: 'yearly' });

    expect(page.containsInOrder('Yield period', 'name="yield_period"', 'Choose…', 'Monthly')).toBeTrue();
    expect(page.contains('<option value="yearly" selected="">Yearly')).toBeTrue();
  });

  it('renders nothing while the rate is blank', () => {
    expect(output({ yield_rate: '  ', yield_period: 'monthly' }).isEmpty()).toBeTrue();
    expect(output({}).isEmpty()).toBeTrue();
  });
});
