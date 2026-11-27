import { isEligible, isTicked } from '../controllers/eligibility.js';

/**
 * Rendering helper of the **Cleared** (tick) column of the ledger table in reconcile mode.
 */
const TickCellHelper = {
  /**
   * Render the header cell of the column.
   *
   * @returns {React.ReactElement} The header cell.
   */
  renderHeader() {
    return <th>Cleared</th>;
  },

  /**
   * Render an empty cell (the opening row has no checkbox).
   *
   * @returns {React.ReactElement} The empty cell.
   */
  renderEmpty() {
    return <td />;
  },

  /**
   * The CSS class dimming an ineligible row.
   *
   * @param {object} row - The ledger row.
   * @param {{account: object, statement: object}} reconcile - The reconcile ledger state.
   * @returns {string|undefined} The class, or `undefined` for an eligible row.
   */
  rowClassName(row, reconcile) {
    return isEligible(row, reconcile) ? undefined : 'text-muted opacity-50';
  },

  /**
   * Render a row's checkbox cell: checked from the statement and the optimistic overlay,
   * enabled only on an eligible row.
   *
   * @param {object} row - The ledger row.
   * @param {{account: object, statement: object, ticked: Map<number, boolean>}} reconcile - The
   *   reconcile ledger state.
   * @param {{onToggle: Function}} handlers - The reconcile handlers.
   * @returns {React.ReactElement} The cell.
   */
  render(row, reconcile, handlers) {
    return (
      <td className="text-center">
        <input
          type="checkbox"
          className="form-check-input"
          aria-label={`Tick ${row.description}`}
          checked={isTicked(row, reconcile)}
          disabled={!isEligible(row, reconcile)}
          onChange={() => handlers.onToggle(row)}
        />
      </td>
    );
  },
};

export default TickCellHelper;
