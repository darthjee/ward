import { confirmDiscard, isDirty } from './ledgerFormFields.js';

/**
 * Build the inline-form handlers of the detail page.
 *
 * @param {object} deps - See {@link buildDetailHandlers}.
 * @returns {object} The form handlers.
 */
function formHandlers(deps) {
  const {
    form, actions, ledgerController, currency, page, confirm,
  } = deps;
  const canDiscard = () => confirmDiscard(isDirty(form.values, form.baseline), confirm);

  return {
    onFieldChange: (event) => actions.changeValue(event.target.name, event.target.value),
    onDirectionChange: (direction) => actions.changeValue('direction', direction),
    onToggleNotes: () => actions.toggleNotes(),
    onSubmit: (event) => {
      event.preventDefault();
      return ledgerController.submit(form, { currency, page });
    },
    onCancelEdit: () => {
      if (canDiscard()) {
        actions.reset();
      }
    },
    onStartNew: (preset) => {
      if (canDiscard()) {
        actions.startNew(preset);
      }
    },
    onEdit: (transaction) => {
      if (form.editing?.id !== transaction.id && canDiscard()) {
        actions.startEdit(transaction);
      }
    },
    onNavigate: (_target, event) => {
      if (!canDiscard()) {
        event.preventDefault();
        return;
      }

      actions.reset();
    },
  };
}

/**
 * Build the account-action and alert handlers of the detail page.
 *
 * @param {object} deps - See {@link buildDetailHandlers}.
 * @returns {object} The action handlers.
 */
function actionHandlers(deps) {
  const {
    detailController, confirmation, setConfirmation, error, setError, reload,
  } = deps;

  return {
    onArchive: () => detailController.archive(),
    onUnarchive: () => detailController.unarchive(),
    onDeleteAccount: () => setConfirmation({ kind: 'account' }),
    onDeleteTransaction: (transaction) => setConfirmation({ kind: 'transaction', transaction }),
    onConfirm: () => (confirmation?.kind === 'transaction'
      ? detailController.deleteTransaction(confirmation.transaction)
      : detailController.deleteAccount()),
    onCancelConfirm: () => setConfirmation(null),
    onRetry: () => error?.retry?.(),
    onDismiss: () => setError(null),
    onRetryLoad: () => reload(),
  };
}

/**
 * Build every handler of the account detail page.
 *
 * @description Switching to another row's Edit, cancelling an edit, changing the ledger page
 * or opening a preset (`onStartNew`, the debt shortcuts) while the inline form has unsaved
 * changes asks for confirmation (`confirm`, default `window.confirm`) before discarding them.
 * @param {object} deps - Handler dependencies.
 * @param {object} deps.form - The inline form state.
 * @param {object} deps.actions - The inline form actions (see `ledgerFormActions`).
 * @param {object} deps.ledgerController - The {@link LedgerFormController}.
 * @param {object} deps.detailController - The {@link BankAccountDetailController}.
 * @param {string} deps.currency - The account currency.
 * @param {number} deps.page - The current ledger page.
 * @param {object|null} deps.confirmation - The open delete confirmation.
 * @param {Function} deps.setConfirmation - Opens / closes the delete confirmation.
 * @param {object|null} deps.error - The page alert's error (may carry `retry`).
 * @param {Function} deps.setError - Sets the page alert's error.
 * @param {Function} deps.reload - Reloads the account and the current page.
 * @param {Function} [deps.confirm] - Asks the user before discarding unsaved changes.
 * @returns {object} The handlers passed to the detail helper.
 */
export function buildDetailHandlers(deps) {
  return { ...formHandlers(deps), ...actionHandlers(deps) };
}
