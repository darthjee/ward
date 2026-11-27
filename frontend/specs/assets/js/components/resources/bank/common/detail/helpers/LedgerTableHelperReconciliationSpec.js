import LedgerTableHelper from '../../../../../../../../../assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx';
import { clearedTitle } from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/ClearedMarker.jsx';
import { formatDate } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const CLEARED = {
  id: 1, date: '2026-03-10', amount: '100.00', description: 'Salary', notes: null, balance: '100.00', payment_generated: false,
  reconciliation: { id: 3, status: 'finished', statement_date: '2026-03-31' },
};
const OPEN = {
  id: 2, date: '2026-04-10', amount: '-5.00', description: 'Coffee', notes: null, balance: '95.00', payment_generated: false,
  reconciliation: { id: 4, status: 'open', statement_date: '2026-04-30' },
};
const LOOSE = {
  id: 3, date: '2026-03-15', amount: '-9.00', description: 'Snack', notes: null, balance: '91.00', payment_generated: false, reconciliation: null,
};
const OPENING = { date: '2026-01-01', amount: '0.00', balance: '0.00' };

describe('LedgerTableHelper reconciliation markers', () => {
  const handlers = { onEdit: jasmine.createSpy('onEdit'), onDeleteTransaction: jasmine.createSpy('onDeleteTransaction') };

  function output(transactions, { opening = null, lastReconciledDate = '2026-03-31', ...overrides } = {}) {
    const state = {
      ledger: { transactions, opening, last_reconciled_date: lastReconciledDate },
      currency: 'BRL',
      editingId: null,
      readOnly: false,
      busy: false,
      canDelete: true,
      canEditPaymentTransactions: true,
      page: 1,
      firstPageHref: '#/x',
      ...overrides,
    };

    return renderedOutput(LedgerTableHelper.render(state, handlers));
  }

  it('shows the cleared marker on a cleared row', () => {
    const page = output([CLEARED]);

    expect(page.contains('✓ cleared')).toBeTrue();
    expect(page.containsAttribute('title', clearedTitle(formatDate('2026-03-31')))).toBeTrue();
  });

  it('shows the warning badge on an uncleared row on or before the last statement', () => {
    expect(output([LOOSE]).contains('Not on reconciled statement of')).toBeTrue();
  });

  it('shows no marker nor badge on a row of an open statement', () => {
    const page = output([OPEN]);

    expect(page.contains('✓ cleared')).toBeFalse();
    expect(page.contains('Not on reconciled statement')).toBeFalse();
  });

  it('shows no badge without a last reconciled date', () => {
    expect(output([LOOSE], { lastReconciledDate: null }).contains('Not on reconciled statement')).toBeFalse();
  });

  it('never marks the opening row', () => {
    const page = output([], { opening: OPENING });

    expect(page.contains('Opening balance')).toBeTrue();
    expect(page.contains('✓ cleared')).toBeFalse();
    expect(page.contains('Not on reconciled statement')).toBeFalse();
  });

  it('hides Delete on a cleared row but keeps Edit', () => {
    const page = output([CLEARED]);

    expect(page.contains('Delete')).toBeFalse();
    expect(page.contains('Edit')).toBeTrue();
  });

  it('keeps Delete on an uncleared row and on a row of an open statement', () => {
    expect(output([LOOSE]).contains('Delete')).toBeTrue();
    expect(output([OPEN]).contains('Delete')).toBeTrue();
  });

  it('keeps the marker when the section adds its own per-row content', () => {
    const page = output([CLEARED], { renderRowExtra: () => 'EXTRA' });

    expect(page.containsInOrder('Salary', '✓ cleared', 'EXTRA')).toBeTrue();
  });

  it('shows the marker on an archived account', () => {
    expect(output([CLEARED], { readOnly: true }).contains('✓ cleared')).toBeTrue();
  });
});
