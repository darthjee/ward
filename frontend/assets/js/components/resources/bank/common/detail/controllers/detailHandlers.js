import { confirmDiscard, isDirty } from './ledgerFormFields.js';

/**
 * Build the inline-form handlers of the detail page.
 *
 * @param {object} deps - See {@link buildDetailHandlers}.
 * @returns {object} The form handlers.
 */
function formHandlers(deps) {
  const {
    form, actions, ledgerController, currency, page, confirm, setConfirmation,
  } = deps;
  const canDiscard = () => confirmDiscard(isDirty(form.values, form.baseline), confirm);

  return {
    onFieldChange: (event) => actions.changeValue(event.target.name, event.target.value),
    onDirectionChange: (direction) => actions.changeValue('direction', direction),
    onToggleNotes: () => actions.toggleNotes(),
    onSubmit: (event) => {
      event.preventDefault();

      if (form.editing?.sent_to_accountant_at) {
        setConfirmation({ kind: 'sentEdit' });
        return undefined;
      }

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
 * Save the inline form once the sent-charge warning is confirmed, then close the modal.
 *
 * @param {object} deps - See {@link buildDetailHandlers}.
 * @returns {Promise<void>} Resolves once saved and closed.
 */
async function saveSentEdit(deps) {
  const {
    ledgerController, form, currency, page,
  } = deps;

  await ledgerController.submit(form, { currency, page });
  deps.setConfirmation(null);
}

// What each confirmation kind runs once confirmed.
const CONFIRM_ACTIONS = new Map([
  ['account', (deps) => deps.detailController.deleteAccount()],
  ['transaction', (deps) => deps.detailController.deleteTransaction(deps.confirmation.transaction)],
  ['sentEdit', saveSentEdit],
]);

/**
 * Run the open confirmation's action.
 *
 * @param {object} deps - See {@link buildDetailHandlers}.
 * @returns {Promise<void>|undefined} The action's result.
 */
function runConfirmed(deps) {
  const action = CONFIRM_ACTIONS.get(deps.confirmation?.kind) ?? CONFIRM_ACTIONS.get('account');

  return action(deps);
}

/**
 * Build the account-action and alert handlers of the detail page.
 *
 * @param {object} deps - See {@link buildDetailHandlers}.
 * @returns {object} The action handlers.
 */
function actionHandlers(deps) {
  const {
    detailController, setConfirmation, error, setError, reload,
  } = deps;

  return {
    onArchive: () => detailController.archive(),
    onUnarchive: () => detailController.unarchive(),
    onDeleteAccount: () => setConfirmation({ kind: 'account' }),
    onDeleteTransaction: (transaction) => setConfirmation({ kind: 'transaction', transaction }),
    onConfirm: () => runConfirmed(deps),
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
 * Saving an edit of a charge already sent to the accountant (`sent_to_accountant_at`) first
 * opens the `sentEdit` confirmation; confirming it submits the form and closes the modal.
 * @param {object} deps - Handler dependencies.
 * @param {object} deps.form - The inline form state.
 * @param {object} deps.actions - The inline form actions (see `ledgerFormActions`).
 * @param {object} deps.ledgerController - The {@link LedgerFormController}.
 * @param {object} deps.detailController - The {@link BankAccountDetailController}.
 * @param {string} deps.currency - The account currency.
 * @param {number} deps.page - The current ledger page.
 * @param {object|null} deps.confirmation - The open confirmation (`{ kind, transaction }`).
 * @param {Function} deps.setConfirmation - Opens / closes the confirmation.
 * @param {object|null} deps.error - The page alert's error (may carry `retry`).
 * @param {Function} deps.setError - Sets the page alert's error.
 * @param {Function} deps.reload - Reloads the account and the current page.
 * @param {Function} [deps.confirm] - Asks the user before discarding unsaved changes.
 * @returns {object} The handlers passed to the detail helper.
 */
export function buildDetailHandlers(deps) {
  return { ...formHandlers(deps), ...actionHandlers(deps) };
}
