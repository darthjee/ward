import { useEffect, useMemo, useState } from 'react';
import useBankAccountForm from './useBankAccountForm.js';
import useManageAccountsGate from './useManageAccountsGate.js';
import BankAccountLoader, { buildBankAccountLoadEffect } from '../../detail/controllers/BankAccountLoader.js';
import { fieldsFromAccount } from '../controllers/accountFormFields.js';
import Router from '../../../../../../utils/routing/Router.js';
import { currentHash } from '../../currentHash.js';
import { guardAccountType } from '../../detail/accountTypeGuard.js';

const NO_LOCKS = { currencyLocked: false, openingLocked: false, currencyLockReason: null };

/**
 * Derive the locks of the edit form from the loaded account and its ledger.
 *
 * @description The opening date and balance lock once the account has a statement (finished or
 * open). The currency locks with the first transaction, or once a statement exists, even with
 * no transactions, because the server answers `409 CURRENCY_LOCKED` as soon as one exists.
 * @param {{last_reconciliation: (object|null), open_reconciliation_id: (number|null)}} account -
 *   The account detail.
 * @param {{pagination: {total_count: number}}} ledger - Ledger page 1.
 * @returns {{currencyLocked: boolean, openingLocked: boolean,
 *   currencyLockReason: (string|null)}} The locks (`currencyLockReason`: `'reconciled'`,
 *   `'transactions'` or `null`).
 */
export function editLocks(account, ledger) {
  const reconciled = Boolean(account.last_reconciliation || account.open_reconciliation_id);
  const hasTransactions = ledger.pagination.total_count > 0;
  let currencyLockReason = null;

  if (reconciled) {
    currencyLockReason = 'reconciled';
  } else if (hasTransactions) {
    currencyLockReason = 'transactions';
  }

  return { currencyLocked: hasTransactions || reconciled, openingLocked: reconciled, currencyLockReason };
}

/**
 * Merge a (re)loaded account into the form: the first load fills every field; a reload (after
 * a `409`) keeps the user's values but resets a now-locked currency and now-locked opening
 * fields.
 *
 * @param {object|null} fields - The current fields.
 * @param {object} account - The loaded account.
 * @param {boolean} locked - Whether the currency is locked.
 * @param {Function} [fieldsFrom] - Builds the form fields of an account.
 * @param {boolean} [openingLocked] - Whether the opening date and balance are locked.
 * @returns {object} The next fields.
 */
export function mergeLoadedAccount(fields, account, locked, fieldsFrom = fieldsFromAccount, openingLocked = false) {
  if (!fields) {
    return fieldsFrom(account);
  }

  if (!locked && !openingLocked) {
    return fields;
  }

  const fresh = openingLocked ? fieldsFrom(account) : {};
  const opening = Object.fromEntries(
    ['opening_date', 'opening_balance'].filter((name) => name in fresh).map((name) => [name, fresh[name]]),
  );

  return { ...fields, ...(locked ? { currency: account.currency } : {}), ...opening };
}

/**
 * State and handlers of an account edit page (`<ui><base>/:accountId/edit`, Accounts, Debts,
 * Investments or Providers).
 *
 * @description Prefilled from the account and ledger page 1, whose `total_count` locks the
 * currency once the account has transactions. An archived account can only be renamed. A `409`
 * shows its message and reloads, so the form re-renders locked / name-only. Submitting goes
 * through `controller.handleSubmit(accountId, fields, account)`. An account of another type is
 * redirected to its own section's edit page (see `guardAccountType`). A role that may not
 * manage accounts gets `forbidden` and the account is never requested; while the role is not
 * yet known the form stays in its loading state (`fields: null`).
 * @param {Function} Controller - The form controller class (an `AccountFormController`).
 * @param {{base: string, fieldsFrom: Function, idPrefix: string}} options - The section base
 *   path, the account → form fields builder and the input id prefix.
 * @returns {{context: object, notFound: boolean, forbidden: boolean, accountId: string,
 *   account: (object|null), setFields: Function, state: object, handlers: object}} The owner
 *   context, whether to show Not-found, whether to show the permission message, the account id and loaded account, the form fields setter (for
 *   section-specific handlers), the form helper state and its handlers.
 */
export default function useAccountEditPage(Controller, { base, fieldsFrom, idPrefix }) {
  const form = useBankAccountForm(null);
  const { context, setFields, setNotFound } = form;
  const { forbidden, allowed } = useManageAccountsGate();
  const [accountId] = useState(() => Router.extractContextParams(`${base}/:accountId/edit`, currentHash()).accountId);
  const [account, setAccount] = useState(null);
  const [locks, setLocks] = useState(NO_LOCKS);
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

  useEffect(() => (forbidden ? undefined : buildBankAccountLoadEffect(loader, context, accountId, 1, guardAccountType({
    onLoaded: ({ account: loaded, ledger }) => {
      const next = editLocks(loaded, ledger);

      setAccount(loaded);
      setLocks(next);
      setLoadError(null);
      setFields((fields) => mergeLoadedAccount(fields, loaded, next.currencyLocked, fieldsFrom, next.openingLocked));
    },
    onNotFound: () => setNotFound(true),
    onError: setLoadError,
  }, { base, context, suffix: '/edit' }))()), [loader, context, accountId, attempt, setFields, setNotFound, fieldsFrom, base, forbidden]);

  const submit = () => controller.handleSubmit(accountId, form.fields, account);

  return {
    context,
    notFound: form.notFound,
    forbidden,
    accountId,
    account,
    setFields,
    state: {
      fields: account && allowed ? form.fields : null,
      fieldErrors: form.fieldErrors,
      submitError: form.submitError,
      loadError,
      pending: form.pending,
      defaultCurrency: account?.currency ?? null,
      settingsFailed: false,
      currencyLocked: locks.currencyLocked,
      currencyLockReason: locks.currencyLockReason,
      openingLocked: locks.openingLocked,
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
