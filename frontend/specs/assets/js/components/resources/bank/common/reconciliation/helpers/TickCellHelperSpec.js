import TickCellHelper from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/helpers/TickCellHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const RECONCILE = {
  account: { opening_date: '2026-01-01' },
  statement: { id: 4, statement_date: '2026-03-31' },
  ticked: new Map(),
};
const ROW = {
  id: 1, date: '2026-02-01', description: 'Coffee', reconciliation: null,
};

function cell(row, reconcile = RECONCILE) {
  return renderedOutput(TickCellHelper.render(row, reconcile, { onToggle: () => undefined }));
}

describe('TickCellHelper', () => {
  it('renders the Cleared header', () => {
    expect(renderedOutput(TickCellHelper.renderHeader()).containsElement('th', 'Cleared')).toBeTrue();
  });

  it('renders an empty cell', () => {
    expect(renderedOutput(TickCellHelper.renderEmpty()).containsTag('input')).toBeFalse();
  });

  it('renders an unchecked, enabled checkbox for an eligible row', () => {
    const page = cell(ROW);

    expect(page.contains('aria-label="Tick Coffee"')).toBeTrue();
    expect(page.contains('checked=""')).toBeFalse();
    expect(page.contains('disabled=""')).toBeFalse();
  });

  it('checks a row ticked on the statement', () => {
    expect(cell({ ...ROW, reconciliation: { id: 4 } }).contains('checked=""')).toBeTrue();
  });

  it('lets the overlay win over the server value', () => {
    expect(cell(ROW, { ...RECONCILE, ticked: new Map([[1, true]]) }).contains('checked=""')).toBeTrue();
  });

  it('disables a row cleared by an earlier statement', () => {
    expect(cell({ ...ROW, reconciliation: { id: 2 } }).contains('disabled=""')).toBeTrue();
  });

  it('disables a row after the statement date', () => {
    expect(cell({ ...ROW, date: '2026-04-01' }).contains('disabled=""')).toBeTrue();
  });

  it('dims only an ineligible row', () => {
    expect(TickCellHelper.rowClassName(ROW, RECONCILE)).toBeUndefined();
    expect(TickCellHelper.rowClassName({ ...ROW, date: '2025-12-31' }, RECONCILE)).toBe('text-muted opacity-50');
  });
});
