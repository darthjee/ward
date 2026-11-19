import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import BillHistory from '../../../common/bills/BillHistory.jsx';
import BillKindBadge from '../../../common/bills/BillKindBadge.jsx';
import { formatExpected } from '../../../providers/common/providerLabels.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { PROVIDERS_BASE } from '../../../common/sections.js';

/**
 * Render the header: the bill description and provider, the kind badge and, for a recurring
 * bill, its expected amount with frequency.
 *
 * @param {object} bill - The provider bill.
 * @param {object} provider - The provider account.
 * @returns {React.ReactElement} The header.
 */
function renderHeader(bill, provider) {
  return (
    <div className="mb-3">
      <h1 className="h3 d-inline me-2">{`${bill.description} — ${provider.name}`}</h1>
      <BillKindBadge kind={bill.kind} />
      {bill.kind === 'recurring' && (
        <p className="text-muted mb-0">{formatExpected(bill.expected_amount, bill.charge_frequency, provider.currency)}</p>
      )}
    </div>
  );
}

/**
 * Rendering helper of the bill history page (`<ui>/bills/:billId/history`).
 */
const BankBillHistoryHelper = {
  /**
   * Render the page: the back link to the provider, the header (once loaded) and the bill's
   * payment history.
   *
   * @param {{context: object, bill: (object|null), provider: (object|null),
   *   loadError: (object|null)}} state - Page state.
   * @param {{onRetryLoad: Function}} handlers - Page handlers.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    const { bill, provider } = state;
    const loaded = Boolean(bill && provider);

    return (
      <div className="container mt-4">
        {provider && (
          <p className="mb-2">
            <a href={contextHash(state.context, `${PROVIDERS_BASE}/${provider.id}`)}>{`← ${provider.name}`}</a>
          </p>
        )}
        <BankErrorAlert error={state.loadError} onRetry={handlers.onRetryLoad} />
        {!loaded && !state.loadError && <p className="text-muted">Loading…</p>}
        {loaded && renderHeader(bill, provider)}
        {loaded && <BillHistory context={state.context} account={provider} billId={bill.id} sourceType="provider_expense" />}
      </div>
    );
  },
};

export default BankBillHistoryHelper;
