import { useEffect, useMemo, useState } from 'react';
import NotFound from '../../../../common/notFound/NotFound.jsx';
import useBankAccountForm from './hooks/useBankAccountForm.js';
import BankAccountLoader, { buildBankSettingsLoadEffect } from '../../common/detail/controllers/BankAccountLoader.js';
import BankAccountNewController from './controllers/BankAccountNewController.js';
import { emptyAccountFields } from './controllers/accountFormFields.js';
import BankAccountFormHelper from './helpers/BankAccountFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';

/**
 * New account page (`<ui>/bank/accounts/new`): the currency defaults to `settings.json`'s
 * `default_currency`; when that fails the form still works, with no default and a warning.
 * Saving goes to the new account's detail page.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankAccountNew() {
  const form = useBankAccountForm(emptyAccountFields());
  const { context, setFields, setNotFound } = form;
  const [defaultCurrency, setDefaultCurrency] = useState(null);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const loader = useMemo(() => new BankAccountLoader(), []);
  const controller = useMemo(() => new BankAccountNewController({
    context,
    setFieldErrors: form.setFieldErrors,
    setSubmitError: form.setSubmitError,
    setPending: form.setPending,
    onNotFound: () => setNotFound(true),
  }), [context, form.setFieldErrors, form.setSubmitError, form.setPending, setNotFound]);

  useEffect(() => buildBankSettingsLoadEffect(loader, context, {
    onLoaded: (settings) => {
      setDefaultCurrency(settings.default_currency);
      setFields((fields) => (fields.currency ? fields : { ...fields, currency: settings.default_currency }));
    },
    onNotFound: () => setNotFound(true),
    onError: () => setSettingsFailed(true),
  })(), [loader, context, setFields, setNotFound]);

  if (form.notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  const handlers = {
    ...form.fieldHandlers,
    onSubmit: (event) => {
      event.preventDefault();
      return controller.handleSubmit(form.fields);
    },
    onRetry: () => controller.handleSubmit(form.fields),
  };

  return BankAccountFormHelper.render({
    fields: form.fields,
    fieldErrors: form.fieldErrors,
    submitError: form.submitError,
    loadError: null,
    pending: form.pending,
    defaultCurrency,
    settingsFailed,
    currencyLocked: false,
    archived: false,
    idPrefix: 'bank-account-new-',
  }, handlers, {
    heading: 'New account', submitLabel: 'Create', cancelHref: contextHash(context, '/bank/accounts'),
  });
}
