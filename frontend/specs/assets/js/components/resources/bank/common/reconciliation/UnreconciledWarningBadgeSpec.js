import React from 'react';
import UnreconciledWarningBadge, { unreconciledWarning } from '../../../../../../../../assets/js/components/resources/bank/common/reconciliation/UnreconciledWarningBadge.jsx';
import { formatDate } from '../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const LAST = '2026-03-31';

function render(date, reconciliation = null, lastReconciledDate = LAST) {
  return renderedOutput(React.createElement(UnreconciledWarningBadge, {
    transaction: { id: 1, date, reconciliation }, lastReconciledDate,
  }));
}

describe('UnreconciledWarningBadge', () => {
  it('warns on a row dated before the last statement', () => {
    expect(render('2026-03-10').contains(unreconciledWarning(formatDate(LAST)))).toBeTrue();
  });

  it('warns on a row dated exactly on the last statement', () => {
    expect(render(LAST).contains('badge text-bg-warning')).toBeTrue();
  });

  it('renders nothing for a later row', () => {
    expect(render('2026-04-01').isEmpty()).toBeTrue();
  });

  it('renders nothing when there is no last reconciled date', () => {
    expect(render('2026-03-10', null, null).isEmpty()).toBeTrue();
    expect(render('2026-03-10', null, '').isEmpty()).toBeTrue();
  });

  it('renders nothing for a cleared row', () => {
    expect(render('2026-03-10', { id: 2, status: 'finished', statement_date: LAST }).isEmpty()).toBeTrue();
  });

  it('renders nothing for a row on an open statement', () => {
    expect(render('2026-03-10', { id: 5, status: 'open', statement_date: '2026-04-30' }).isEmpty()).toBeTrue();
  });
});
