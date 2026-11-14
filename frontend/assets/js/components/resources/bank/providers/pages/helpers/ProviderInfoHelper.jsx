import DetailEntry from '../../../common/detail/DetailEntry.jsx';
import ScheduleInfoHelper from '../../../common/detail/helpers/ScheduleInfoHelper.jsx';
import { formatDate, monthName } from '../../../common/dates.js';
import {
  PROVIDER_FIELD_LABELS, forAccountantLabel, formatExpected, frequencyLabel,
} from '../../common/providerLabels.js';

/**
 * Render an entry only when its value is set (the due day / month).
 *
 * @param {string} label - The term.
 * @param {string} value - The description.
 * @returns {React.ReactElement|null} The entry, or `null` when unset.
 */
function renderOptionalEntry(label, value) {
  return value ? <DetailEntry label={label} value={value} /> : null;
}

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
 * Render the provider info block: tax id, expected amount with its frequency, frequency, due
 * day and due month (each only when set), the for-accountant flag and the schedule values.
 *
 * @param {object} account - The provider account.
 * @returns {React.ReactElement} The definition list.
 */
function renderProviderFields(account) {
  const details = account.provider_expense ?? {};

  return (
    <dl className="row" aria-label="Provider info">
      <DetailEntry label="Provider tax id" value={details.provider_tax_id} />
      <DetailEntry
        label="Expected amount"
        value={formatExpected(details.expected_amount, details.charge_frequency, account.currency)}
      />
      <DetailEntry label="Frequency" value={frequencyLabel(details.charge_frequency)} />
      {renderOptionalEntry('Due day', details.due_day ? String(details.due_day) : '')}
      {renderOptionalEntry('Due month', monthName(details.due_month))}
      <DetailEntry label="For accountant" value={forAccountantLabel(details.for_accountant)} />
      {ScheduleInfoHelper.render(account.provider_expense)}
    </dl>
  );
}

/**
 * Rendering helper for the provider details shown in the provider detail header.
 */
const ProviderInfoHelper = {
  /**
   * Render the provider's details: its common fields, then the provider info block. Unset
   * values show `—`, except the due day / month, shown only when set.
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
