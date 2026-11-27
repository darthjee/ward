import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../BankErrorAlert.jsx';
import AccountFormInput from '../../form/AccountFormInput.jsx';
import { statementBalanceLabel } from '../controllers/statementFields.js';

/** Submit button labels by form kind. */
const SUBMIT_LABELS = new Map([
  ['start', 'Start reconciliation'],
  ['edit', 'Save statement'],
]);

/**
 * Rendering helper of the statement form (start and edit).
 */
const StatementFormHelper = {
  /**
   * Render the statement form: date, balance, the submit button, a Cancel button that only
   * closes the form (no request) and the error alert. The date's `max` is a UX default only.
   *
   * @param {{account: object, today: string, reconcile: {formKind: string, fields: object,
   *   fieldErrors: object, pending: boolean, error: (object|null)}}} state - Form state.
   * @param {{onFieldChange: Function, onSubmitStatement: Function, onCloseForm: Function,
   *   onDismissError: Function}} handlers - Form handlers.
   * @returns {React.ReactElement} The form.
   */
  render(state, handlers) {
    const { reconcile } = state;
    const fieldState = { fields: reconcile.fields, fieldErrors: reconcile.fieldErrors, idPrefix: 'statement-' };

    return (
      <form className="mb-3" aria-label="Statement" noValidate onSubmit={handlers.onSubmitStatement}>
        <BankErrorAlert error={reconcile.error} onDismiss={handlers.onDismissError} />
        <AccountFormInput
          name="statement_date"
          label="Statement date"
          type="date"
          extra={{ max: state.today }}
          state={fieldState}
          onChange={handlers.onFieldChange}
        />
        <AccountFormInput
          name="statement_balance"
          label={statementBalanceLabel(state.account)}
          extra={{ inputMode: 'decimal' }}
          state={fieldState}
          onChange={handlers.onFieldChange}
        />
        <Button type="submit" disabled={reconcile.pending}>{SUBMIT_LABELS.get(reconcile.formKind)}</Button>
        <Button type="button" variant="secondary" className="ms-2" onClick={handlers.onCloseForm}>Cancel</Button>
      </form>
    );
  },
};

export default StatementFormHelper;
