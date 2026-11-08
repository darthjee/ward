import { useEffect, useMemo, useState } from 'react';
import useBankAccountForm from './useBankAccountForm.js';
import BankAccountLoader, { buildBankAccountLoadEffect } from '../../detail/controllers/BankAccountLoader.js';
import { fieldsFromAccount } from '../controllers/accountFormFields.js';
import Router from '../../../../../../utils/routing/Router.js';
import { currentHash } from '../../currentHash.js';
import { guardAccountType } from '../../detail/accountTypeGuard.js';

/**
 * Merge a (re)loaded account into the form: the first load fills every field; a reload (after
 * a `409`) keeps the user's values but resets a now-locked currency.
 *
 * @param {object|null} fields - The current fields.
 * @param {object} account - The loaded account.
 * @param {boolean} locked - Whether the currency is locked.
 * @param {Function} [fieldsFrom] - Builds the form fields of an account.
 * @returns {object} The next fields.
 */
export function mergeLoadedAccount(fields, account, locked, fieldsFrom = fieldsFromAccount) {
  if (!fields) {
    return fieldsFrom(account);
  }

  return locked ? { ...fields, currency: account.currency } : fields;
}

/**
 * State and handlers of an account edit page (`<ui><base>/:accountId/edit`, Accounts or Debts).
 *
 * @description Prefilled from the account and ledger page 1, whose `total_count` locks the
 * currency once the account has transactions. An archived account can only be renamed. A `409`
 * shows its message and reloads, so the form re-renders locked / name-only. Submitting goes
 * through `controller.handleSubmit(accountId, fields, account)`. An account of another type is
 * redirected to its own section's edit page (see `guardAccountType`).
 * @param {Function} Controller - The form controller class (an `AccountFormController`).
 * @param {{base: string, fieldsFrom: Function, idPrefix: string}} options - The section base
 *   path, the account → form fields builder and the input id prefix.
 * @returns {{context: object, notFound: boolean, accountId: string, account: (object|null),
 *   state: object, handlers: object}} The owner context, whether to show Not-found, the account
 *   id and loaded account, the form helper state and its handlers.
 */
export default function useAccountEditPage(Controller, { base, fieldsFrom, idPrefix }) {
  const form = useBankAccountForm(null);
  const { context, setFields, setNotFound } = form;
  const [accountId] = useState(() => Router.extractContextParams(`${base}/:accountId/edit`, currentHash()).accountId);
  const [account, setAccount] = useState(null);
  const [locked, setLocked] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const loader = useMemo(() => new BankAccountLoader(), []);
  const controller = useMemo(() => new Controller({
    context,
    setFieldErrors: form.setFieldErrors,
    setSubmitError: form.setSubmitError,
    setPending: form.setPending,
    onNotFound: () => setNotFound(true),
    onConflict: () => setAttempt((value) => value + 1),
  }), [Controller, context, form.setFieldErrors, form.setSubmitError, form.setPending, setNotFound]);

  useEffect(() => buildBankAccountLoadEffect(loader, context, accountId, 1, guardAccountType({
    onLoaded: ({ account: loaded, ledger }) => {
      const hasTransactions = ledger.pagination.total_count > 0;

      setAccount(loaded);
      setLocked(hasTransactions);
      setLoadError(null);
      setFields((fields) => mergeLoadedAccount(fields, loaded, hasTransactions, fieldsFrom));
    },
    onNotFound: () => setNotFound(true),
    onError: setLoadError,
  }, { base, context, suffix: '/edit' }))(), [loader, context, accountId, attempt, setFields, setNotFound, fieldsFrom, base]);

  const submit = () => controller.handleSubmit(accountId, form.fields, account);

  return {
    context,
    notFound: form.notFound,
    accountId,
    account,
    state: {
      fields: account ? form.fields : null,
      fieldErrors: form.fieldErrors,
      submitError: form.submitError,
      loadError,
      pending: form.pending,
      defaultCurrency: account?.currency ?? null,
      settingsFailed: false,
      currencyLocked: locked,
      archived: Boolean(account?.archived_at),
      idPrefix,
    },
    handlers: {
      ...form.fieldHandlers,
      onSubmit: (event) => {
        event.preventDefault();
        return account ? submit() : undefined;
      },
      onRetry: submit,
      onRetryLoad: () => setAttempt((value) => value + 1),
    },
  };
}
