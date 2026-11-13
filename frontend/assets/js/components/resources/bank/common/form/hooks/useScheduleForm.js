import usePayingAccounts from './usePayingAccounts.js';
import { buildScheduleHandlers } from '../controllers/scheduleFields.js';

/**
 * Plug the schedule inputs into a debt / provider form page.
 *
 * @description Loads the paying accounts into `state.payingAccounts` and swaps in the
 * schedule-aware handlers: every field change goes through the Bills from autofill and, on the
 * create pages (`create: true`), a currency change clears a default paying account in another
 * currency.
 * @param {{context: object, setFields: Function, state: object, handlers: object}} page - The
 *   page hook's result (see `useAccountNewPage` / `useAccountEditPage`).
 * @param {{create: boolean}} [options] - Whether this is a create page.
 * @returns {{state: object, handlers: object}} The form state and handlers to render.
 */
export default function useScheduleForm({
  context, setFields, state, handlers,
}, { create = false } = {}) {
  const payingAccounts = usePayingAccounts(context);
  const schedule = buildScheduleHandlers(setFields, payingAccounts);
  const currency = create ? { onCurrencyChange: schedule.onCurrencyChange } : {};

  return {
    state: { ...state, payingAccounts },
    handlers: { ...handlers, onFieldChange: schedule.onFieldChange, ...currency },
  };
}
