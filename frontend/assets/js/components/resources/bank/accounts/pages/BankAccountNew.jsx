import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountNewPage from '../../common/form/hooks/useAccountNewPage.js';
import BankAccountNewController from './controllers/BankAccountNewController.js';
import { emptyAccountFields } from '../../common/form/controllers/accountFormFields.js';
import BankAccountFormHelper from './helpers/BankAccountFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { ACCOUNTS_BASE } from '../../common/sections.js';

/**
 * New account page (`<ui>/bank/accounts/new`): the currency defaults to `settings.json`'s
 * `default_currency`; when that fails the form still works, with no default and a warning.
 * Saving goes to the new account's detail page.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankAccountNew() {
  const {
    context, notFound, state, handlers,
  } = useAccountNewPage(BankAccountNewController, emptyAccountFields(), 'bank-account-new-');

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankAccountFormHelper.render(state, handlers, {
    heading: 'New account', submitLabel: 'Create', cancelHref: contextHash(context, ACCOUNTS_BASE),
  });
}
