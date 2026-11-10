import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountNewPage from '../../common/form/hooks/useAccountNewPage.js';
import BankProviderNewController from './controllers/BankProviderNewController.js';
import { emptyProviderFields } from './controllers/providerFormFields.js';
import BankProviderFormHelper from './helpers/BankProviderFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { PROVIDERS_BASE } from '../../common/sections.js';

/**
 * New provider page (`<ui>/bank/providers/new`): the currency defaults to `settings.json`'s
 * `default_currency`; when that fails the form still works, with no default and a warning.
 * Saving creates a `provider_expense` account and goes to its detail page.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankProviderNew() {
  const {
    context, notFound, state, handlers,
  } = useAccountNewPage(BankProviderNewController, emptyProviderFields(), 'bank-provider-new-');

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankProviderFormHelper.render(state, handlers, {
    heading: 'New provider', submitLabel: 'Create', cancelHref: contextHash(context, PROVIDERS_BASE),
  });
}
