import { useMemo, useState } from 'react';
import { emptyLedgerValues, valuesFromTransaction } from '../controllers/ledgerFormFields.js';

/**
 * Build the state of a new, empty inline form.
 *
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {object} The form state.
 */
export function initialLedgerForm(today) {
  const values = emptyLedgerValues(today);

  return {
    editing: null,
    values,
    baseline: values,
    notesOpen: false,
    fieldErrors: {},
    error: null,
    pending: false,
  };
}

/**
 * Build the state transitions of the inline form.
 *
 * @param {Function} setForm - React state setter for the form state.
 * @description `startNew(preset, today)` opens a new transaction prefilled with `preset`
 * (e.g. a debt shortcut's direction / description / amount); the preset becomes the baseline,
 * so the form is clean right after it.
 * @returns {{update: Function, reset: Function, startEdit: Function, startNew: Function,
 *   changeValue: Function, toggleNotes: Function}} The actions.
 */
export function ledgerFormActions(setForm) {
  return {
    update: (patch) => setForm((form) => ({ ...form, ...patch })),
    reset: () => setForm(initialLedgerForm()),
    startEdit: (transaction) => {
      const values = valuesFromTransaction(transaction);

      setForm({
        ...initialLedgerForm(),
        editing: transaction,
        values,
        baseline: values,
        notesOpen: Boolean(transaction.notes),
      });
    },
    startNew: (preset = {}, today = undefined) => {
      const values = { ...emptyLedgerValues(today), ...preset };

      setForm({ ...initialLedgerForm(today), values, baseline: values });
    },
    changeValue: (name, value) => setForm((form) => ({
      ...form, values: { ...form.values, [name]: value },
    })),
    toggleNotes: () => setForm((form) => ({ ...form, notesOpen: !form.notesOpen })),
  };
}

/**
 * State of the ledger's single inline form row (create, or edit one transaction).
 *
 * @returns {{form: object, actions: object}} The form state and its actions.
 */
export default function useLedgerForm() {
  const [form, setForm] = useState(() => initialLedgerForm());
  const actions = useMemo(() => ledgerFormActions(setForm), []);

  return { form, actions };
}
