import { useCallback, useState } from 'react';
import UpdateValueController, { initialUpdateValue } from '../controllers/UpdateValueController.js';
import { confirmDiscard, isDirty } from '../../../common/detail/controllers/ledgerFormFields.js';

/**
 * State and handlers of an investment's **Update value** form.
 *
 * @description Submitting goes through {@link UpdateValueController} with the latest loaded
 * account (its balance and currency). Before posting, unsaved changes in the inline ledger form
 * are confirmed (and then reset), since the page reloads.
 * @param {{context: object, accountId: (number|string), account: (object|null),
 *   reload: Function, ledgerForm: {form: object, actions: object}}} deps - The owner context,
 *   the account id, the loaded account, the page reload and the inline form state / actions.
 * @returns {{state: object, handlers: {onUpdateValueChange: Function,
 *   onUpdateValueSubmit: Function, onUpdateValueDismiss: Function}}} The form state
 *   (`values`, `errors`, `pending`, `notice`, `error`) and its handlers.
 */
export default function useUpdateValueForm({
  context, accountId, account, reload, ledgerForm,
}) {
  const [state, setState] = useState(() => initialUpdateValue());
  const update = useCallback((patch) => setState((current) => ({ ...current, ...patch })), []);
  const { form, actions } = ledgerForm;
  const controller = new UpdateValueController({
    context,
    accountId,
    update,
    reload,
    canDiscard: () => confirmDiscard(isDirty(form.values, form.baseline)),
    resetLedgerForm: () => actions.reset(),
  });

  return {
    state,
    handlers: {
      onUpdateValueChange: (event) => {
        const { name, value } = event.target;

        setState((current) => ({ ...current, values: { ...current.values, [name]: value }, notice: null }));
      },
      onUpdateValueSubmit: (event) => {
        event.preventDefault();
        return account ? controller.submit(state.values, account) : undefined;
      },
      onUpdateValueDismiss: () => update({ error: null }),
    },
  };
}
