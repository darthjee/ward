import Table from 'react-bootstrap/cjs/Table.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import BankPagination from '../../../common/BankPagination.jsx';
import ConfirmModal from '../../../common/ConfirmModal.jsx';
import BillKindBadge from '../../../common/bills/BillKindBadge.jsx';
import AddBillLink from '../AddBillLink.jsx';
import { formatExpected, EMPTY_MARK } from '../providerLabels.js';
import { formatDate, monthName } from '../../../common/dates.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { BILLS_BASE } from '../../../common/sections.js';

/**
 * Format the due information of a bill.
 *
 * @param {object} bill - The provider bill.
 * @returns {string} The due date of a one-off, or the due day (and month, when yearly).
 */
function dueLabel(bill) {
  if (bill.kind !== 'recurring') {
    return bill.due_date ? formatDate(bill.due_date) : EMPTY_MARK;
  }

  if (!bill.due_day) {
    return EMPTY_MARK;
  }

  const month = bill.due_month ? ` of ${monthName(bill.due_month)}` : '';

  return `Day ${bill.due_day}${month}`;
}

/**
 * Render a row's Edit and Delete actions, hidden while the provider is archived.
 *
 * @param {object} bill - The bill.
 * @param {object} state - Helper state.
 * @param {{onDelete: Function}} handlers - Row handlers.
 * @returns {React.ReactElement|null} The Edit link and Delete button, or `null` on an archived
 *   provider.
 */
function renderEditDelete(bill, state, handlers) {
  if (state.account.archived_at) {
    return null;
  }

  const editHref = contextHash(state.context, `${BILLS_BASE}/${bill.id}/edit`);

  return (
    <>
      <a className="btn btn-sm btn-link" href={editHref}>Edit</a>
      <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => handlers.onDelete(bill)} disabled={state.pending}>
        Delete
      </button>
    </>
  );
}

/**
 * Render a row's actions: History is always shown (archived providers included, so the bill's
 * payments stay reachable read-only); Edit and Delete are hidden while the provider is archived.
 *
 * @param {object} bill - The bill.
 * @param {object} state - Helper state.
 * @param {{onDelete: Function}} handlers - Row handlers.
 * @returns {React.ReactElement} The actions cell.
 */
function renderActions(bill, state, handlers) {
  const historyHref = contextHash(state.context, `${BILLS_BASE}/${bill.id}/history`);

  return (
    <td className="text-end text-nowrap">
      <a className="btn btn-sm btn-link" href={historyHref}>History</a>
      {renderEditDelete(bill, state, handlers)}
    </td>
  );
}

/**
 * Render one bill row.
 *
 * @param {object} bill - The bill.
 * @param {object} state - Helper state.
 * @param {object} handlers - Row handlers.
 * @returns {React.ReactElement} The row.
 */
function renderRow(bill, state, handlers) {
  return (
    <tr key={bill.id}>
      <td className="text-break">{bill.description}</td>
      <td><BillKindBadge kind={bill.kind} /></td>
      <td className="text-nowrap">{formatExpected(bill.expected_amount, bill.charge_frequency, state.account.currency)}</td>
      <td className="text-nowrap">{dueLabel(bill)}</td>
      {renderActions(bill, state, handlers)}
    </tr>
  );
}

/**
 * Render the bills table, an empty state, or nothing while loading.
 *
 * @param {object} state - Helper state.
 * @param {object} handlers - Row handlers.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody(state, handlers) {
  if (!state.data) {
    return null;
  }

  if (state.data.provider_bills.length === 0) {
    return <p className="text-muted">No bills yet.</p>;
  }

  return (
    <Table size="sm" responsive aria-label="Bills">
      <thead>
        <tr>
          <th>Description</th>
          <th>Kind</th>
          <th>Expected</th>
          <th>Due</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>{state.data.provider_bills.map((bill) => renderRow(bill, state, handlers))}</tbody>
    </Table>
  );
}

/**
 * Rendering helper of the **Bills** block of a provider detail.
 */
const ProviderBillsHelper = {
  /**
   * Render the Bills block: heading with Add bill, alert, rows, pagination and the Delete
   * confirmation.
   *
   * @param {{account: object, context: object, page: number, data: (object|null),
   *   error: (object|null), pending: boolean, confirmation: (object|null),
   *   selfHref: string}} state - Helper state.
   * @param {object} handlers - Handlers.
   * @returns {React.ReactElement} The section.
   */
  render(state, handlers) {
    return (
      <section className="mt-4" aria-label="Bills">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="h4">Bills</h2>
          <AddBillLink account={state.account} context={state.context} />
        </div>
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        {renderBody(state, handlers)}
        <BankPagination
          page={state.page}
          totalPages={state.data?.pagination.total_pages}
          hrefFor={() => state.selfHref}
          onNavigate={handlers.onNavigate}
        />
        <ConfirmModal
          show={Boolean(state.confirmation)}
          title="Delete bill"
          pending={state.pending}
          onConfirm={handlers.onConfirmDelete}
          onCancel={handlers.onCancelDelete}
        >
          Delete this bill?
        </ConfirmModal>
      </section>
    );
  },
};

export default ProviderBillsHelper;
