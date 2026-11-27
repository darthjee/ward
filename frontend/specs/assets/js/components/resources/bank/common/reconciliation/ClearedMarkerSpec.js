import React from 'react';
import ClearedMarker, { clearedTitle } from '../../../../../../../../assets/js/components/resources/bank/common/reconciliation/ClearedMarker.jsx';
import { formatDate } from '../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

function render(reconciliation) {
  return renderedOutput(React.createElement(ClearedMarker, { transaction: { id: 1, reconciliation } }));
}

describe('ClearedMarker', () => {
  it('marks a row cleared by a finished statement, with its date in the title', () => {
    const marker = render({ id: 3, status: 'finished', statement_date: '2026-03-31' });

    expect(marker.contains('✓ cleared')).toBeTrue();
    expect(marker.containsAttribute('title', clearedTitle(formatDate('2026-03-31')))).toBeTrue();
  });

  it('renders nothing for a row on an open statement', () => {
    expect(render({ id: 3, status: 'open', statement_date: '2026-03-31' }).isEmpty()).toBeTrue();
  });

  it('renders nothing for an uncleared row', () => {
    expect(render(null).isEmpty()).toBeTrue();
  });
});
