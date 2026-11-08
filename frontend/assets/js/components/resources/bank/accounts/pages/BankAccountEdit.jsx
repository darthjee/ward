import { useEffect, useMemo, useState } from 'react';
import NotFound from '../../../../common/notFound/NotFound.jsx';
import useBankAccountForm from './hooks/useBankAccountForm.js';
import BankAccountLoader, { buildBankAccountLoadEffect } from '../../common/detail/controllers/BankAccountLoader.js';
import BankAccountEditController from './controllers/BankAccountEditController.js';
import { fieldsFromAccount } from './controllers/accountFormFields.js';
import BankAccountFormHelper from './helpers/BankAccountFormHelper.jsx';
import Router from '../../../../../utils/routing/Router.js';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { currentHash } from '../../common/currentHash.js';

/**
 * Merge a (re)loaded account into the form: the first load fills every field; a reload (after
 * a `409`) keeps the user's values but resets a now-locked currency.
 *
 * @param {object|null} fields - The current fields.
 * @param {object} account - The loaded account.
 * @param {boolean} locked - Whether the currency is locked.
 * @returns {object} The next fields.
 */
export function mergeLoadedAccount(fields, account, locked) {
  if (!fields) {
    return fieldsFromAccount(account);
  }

  return locked ? { ...fields, currency: account.currency } : fields;
}

/**
 * Edit account page (`<ui>/bank/accounts/:accountId/edit`): prefilled from the account (full
 * account number) and ledger page 1, whose `total_count` locks the currency once the account has
 * transactions. An archived account can only be renamed. A `409 CURRENCY_LOCKED` /
 * `ACCOUNT_ARCHIVED` shows its message and reloads, so the form re-renders locked / name-only.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankAccountEdit() {
  const form = useBankAccountForm(null);
  const { context, setFields, setNotFound } = form;
  const [accountId] = useState(() => Router.extractContextParams('/bank/accounts/:accountId/edit', currentHash()).accountId);
  const [account, setAccount] = useState(null);
  const [locked, setLocked] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const loader = useMemo(() => new BankAccountLoader(), []);
  const controller = useMemo(() => new BankAccountEditController({
    context,
    setFieldErrors: form.setFieldErrors,
    setSubmitError: form.setSubmitError,
    setPending: form.setPending,
    onNotFound: () => setNotFound(true),
    onConflict: () => setAttempt((value) => value + 1),
  }), [context, form.setFieldErrors, form.setSubmitError, form.setPending, setNotFound]);

  useEffect(() => buildBankAccountLoadEffect(loader, context, accountId, 1, {
    onLoaded: ({ account: loaded, ledger }) => {
      const hasTransactions = ledger.pagination.total_count > 0;

      setAccount(loaded);
      setLocked(hasTransactions);
      setLoadError(null);
      setFields((fields) => mergeLoadedAccount(fields, loaded, hasTransactions));
    },
    onNotFound: () => setNotFound(true),
    onError: setLoadError,
  })(), [loader, context, accountId, attempt, setFields, setNotFound]);

  if (form.notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  const submit = () => controller.handleSubmit(accountId, form.fields, account);
  const handlers = {
    ...form.fieldHandlers,
    onSubmit: (event) => {
      event.preventDefault();
      return account ? submit() : undefined;
    },
    onRetry: submit,
    onRetryLoad: () => setAttempt((value) => value + 1),
  };

  return BankAccountFormHelper.render({
    fields: account ? form.fields : null,
    fieldErrors: form.fieldErrors,
    submitError: form.submitError,
    loadError,
    pending: form.pending,
    defaultCurrency: account?.currency ?? null,
    settingsFailed: false,
    currencyLocked: locked,
    archived: Boolean(account?.archived_at),
    idPrefix: 'bank-account-edit-',
  }, handlers, {
    heading: account?.archived_at ? 'Rename account' : 'Edit account',
    submitLabel: 'Save',
    cancelHref: contextHash(context, `/bank/accounts/${accountId}`),
  });
}
