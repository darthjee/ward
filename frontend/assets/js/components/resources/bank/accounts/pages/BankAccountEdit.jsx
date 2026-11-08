import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountEditPage, { mergeLoadedAccount } from '../../common/form/hooks/useAccountEditPage.js';
import BankAccountEditController from './controllers/BankAccountEditController.js';
import { fieldsFromAccount } from '../../common/form/controllers/accountFormFields.js';
import BankAccountFormHelper from './helpers/BankAccountFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { ACCOUNTS_BASE } from '../../common/sections.js';

export { mergeLoadedAccount };

/**
 * Edit account page (`<ui>/bank/accounts/:accountId/edit`): prefilled from the account (full
 * account number) and ledger page 1, whose `total_count` locks the currency once the account has
 * transactions. An archived account can only be renamed. A `409 CURRENCY_LOCKED` /
 * `ACCOUNT_ARCHIVED` shows its message and reloads, so the form re-renders locked / name-only.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankAccountEdit() {
  const {
    context, notFound, accountId, account, state, handlers,
  } = useAccountEditPage(BankAccountEditController, {
    base: ACCOUNTS_BASE, fieldsFrom: fieldsFromAccount, idPrefix: 'bank-account-edit-',
  });

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankAccountFormHelper.render(state, handlers, {
    heading: account?.archived_at ? 'Rename account' : 'Edit account',
    submitLabel: 'Save',
    cancelHref: contextHash(context, `${ACCOUNTS_BASE}/${accountId}`),
  });
}
