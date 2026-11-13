import { useEffect, useMemo, useState } from 'react';
import useBankAccountForm from './useBankAccountForm.js';
import BankAccountLoader, { buildBankSettingsLoadEffect } from '../../detail/controllers/BankAccountLoader.js';

/**
 * State and handlers of an account create page (Accounts or Debts).
 *
 * @description The currency defaults to `settings.json`'s `default_currency`; when that fails
 * the form still works, with no default and a warning. Submitting goes through
 * `controller.handleSubmit(fields)`.
 * @param {Function} Controller - The form controller class (an `AccountFormController`).
 * @param {object} initialFields - The empty form fields.
 * @param {string} idPrefix - The input id prefix.
 * @returns {{context: object, notFound: boolean, setFields: Function, state: object,
 *   handlers: object}} The owner context, whether to show Not-found, the form fields setter
 *   (for section-specific handlers), the form helper state and its handlers.
 */
export default function useAccountNewPage(Controller, initialFields, idPrefix) {
  const form = useBankAccountForm(initialFields);
  const { context, setFields, setNotFound } = form;
  const [defaultCurrency, setDefaultCurrency] = useState(null);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const loader = useMemo(() => new BankAccountLoader(), []);
  const controller = useMemo(() => new Controller({
    context,
    setFieldErrors: form.setFieldErrors,
    setSubmitError: form.setSubmitError,
    setPending: form.setPending,
    onNotFound: () => setNotFound(true),
  }), [Controller, context, form.setFieldErrors, form.setSubmitError, form.setPending, setNotFound]);

  useEffect(() => buildBankSettingsLoadEffect(loader, context, {
    onLoaded: (settings) => {
      setDefaultCurrency(settings.default_currency);
      setFields((fields) => (fields.currency ? fields : { ...fields, currency: settings.default_currency }));
    },
    onNotFound: () => setNotFound(true),
    onError: () => setSettingsFailed(true),
  })(), [loader, context, setFields, setNotFound]);

  return {
    context,
    notFound: form.notFound,
    setFields,
    state: {
      fields: form.fields,
      fieldErrors: form.fieldErrors,
      submitError: form.submitError,
      loadError: null,
      pending: form.pending,
      defaultCurrency,
      settingsFailed,
      currencyLocked: false,
      archived: false,
      idPrefix,
    },
    handlers: {
      ...form.fieldHandlers,
      onSubmit: (event) => {
        event.preventDefault();
        return controller.handleSubmit(form.fields);
      },
      onRetry: () => controller.handleSubmit(form.fields),
    },
  };
}
