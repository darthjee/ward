import DetailEntry from '../../../common/detail/DetailEntry.jsx';
import { formatDate } from '../../../common/dates.js';
import {
  PROVIDER_FIELD_LABELS, forAccountantLabel,
} from '../../common/providerLabels.js';

/**
 * Render the common fields of a provider: provider, branch, customer / contract number,
 * currency, opening date and notes.
 *
 * @param {object} account - The provider account.
 * @returns {React.ReactElement} The definition list.
 */
function renderAccountFields(account) {
  return (
    <dl className="row">
      <DetailEntry label={PROVIDER_FIELD_LABELS.bankName} value={account.bank_name} />
      <DetailEntry label={PROVIDER_FIELD_LABELS.branch} value={account.branch} />
      <DetailEntry label={PROVIDER_FIELD_LABELS.accountNumber} value={account.account_number} />
      <DetailEntry label="Currency" value={account.currency} />
      <DetailEntry label="Opening date" value={formatDate(account.opening_date)} />
      <DetailEntry label="Notes" value={account.notes} />
    </dl>
  );
}

/**
 * Render the provider info block: tax id and the for-accountant flag (the schedule lives on
 * the provider's bills).
 *
 * @param {object} account - The provider account.
 * @returns {React.ReactElement} The definition list.
 */
function renderProviderFields(account) {
  const details = account.provider_expense ?? {};

  return (
    <dl className="row" aria-label="Provider info">
      <DetailEntry label="Provider tax id" value={details.provider_tax_id} />
      <DetailEntry label="For accountant" value={forAccountantLabel(details.for_accountant)} />
    </dl>
  );
}

/**
 * Rendering helper for the provider details shown in the provider detail header.
 */
const ProviderInfoHelper = {
  /**
   * Render the provider's details: its common fields, then the provider info block. Unset
   * values show `—`.
   *
   * @param {object} account - The provider account (with its `provider_expense` object).
   * @returns {React.ReactElement} The details.
   */
  render(account) {
    return (
      <>
        {renderAccountFields(account)}
        <h2 className="h5">Provider info</h2>
        {renderProviderFields(account)}
      </>
    );
  },
};

export default ProviderInfoHelper;
