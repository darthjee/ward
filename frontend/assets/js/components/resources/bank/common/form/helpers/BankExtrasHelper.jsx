import AccountFormInput from '../AccountFormInput.jsx';

/** Default labels of the bank extras. */
export const DEFAULT_BANK_EXTRAS_LABELS = { branch: 'Branch', accountNumber: 'Account number' };

/**
 * Rendering helper for the bank extras of an account form: branch and account number, with
 * labels a section may rename (e.g. Providers' "Customer / contract number").
 */
const BankExtrasHelper = {
  /**
   * Render the branch and account-number fields.
   *
   * @param {object} state - Form state (see `AccountFormHelper.render`).
   * @param {{onFieldChange: Function}} handlers - Field handlers.
   * @param {{labels: {branch: string, accountNumber: string}}} [options] - Field labels; each
   *   missing label falls back to "Branch" / "Account number".
   * @returns {React.ReactElement} The fields.
   */
  render(state, handlers, { labels = {} } = {}) {
    const { branch, accountNumber } = { ...DEFAULT_BANK_EXTRAS_LABELS, ...labels };

    return (
      <>
        <AccountFormInput name="branch" label={branch} state={state} onChange={handlers.onFieldChange} />
        <AccountFormInput name="account_number" label={accountNumber} state={state} onChange={handlers.onFieldChange} />
      </>
    );
  },
};

export default BankExtrasHelper;
