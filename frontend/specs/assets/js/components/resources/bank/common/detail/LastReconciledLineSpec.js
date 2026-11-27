import React from 'react';
import LastReconciledLine from '../../../../../../../../assets/js/components/resources/bank/common/detail/LastReconciledLine.jsx';
import { formatDate } from '../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { formatMoney } from '../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const LAST = { statement_date: '2026-03-31', statement_balance: '120.00', reconciled_at: '2026-04-01T10:00:00.000Z' };

function render(account) {
  return renderedOutput(React.createElement(LastReconciledLine, { account: { currency: 'BRL', type: 'account', ...account } }));
}

describe('LastReconciledLine', () => {
  it('renders nothing when the account was never reconciled', () => {
    expect(render({ last_reconciliation: null }).isEmpty()).toBeTrue();
  });

  it('shows the formatted date and balance', () => {
    expect(render({ last_reconciliation: LAST }).containsInOrder(
      'Last reconciled:', formatDate('2026-03-31'), formatMoney('120.00', 'BRL'),
    )).toBeTrue();
  });

  ['account', 'investment', 'provider'].forEach((type) => {
    it(`shows the raw balance on a ${type}`, () => {
      expect(render({ type, last_reconciliation: LAST }).contains(formatMoney('120.00', 'BRL'))).toBeTrue();
    });
  });

  it('shows the negated balance on a debt', () => {
    expect(render({ type: 'debt', last_reconciliation: LAST }).contains(formatMoney('-120.00', 'BRL'))).toBeTrue();
    expect(render({ type: 'debt', last_reconciliation: { ...LAST, statement_balance: '-120.00' } }).contains(formatMoney('120.00', 'BRL')))
      .toBeTrue();
  });
});
