import NotFound from '../../../../common/notFound/NotFound.jsx';
import PermissionDenied from '../../../../common/PermissionDenied.jsx';
import useAccountEditPage from '../../common/form/hooks/useAccountEditPage.js';
import BankProviderEditController from './controllers/BankProviderEditController.js';
import { providerFieldsFromAccount } from './controllers/providerFormFields.js';
import BankProviderFormHelper from './helpers/BankProviderFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { PROVIDERS_BASE } from '../../common/sections.js';

/**
 * Edit provider page (`<ui>/bank/providers/:accountId/edit`): prefilled from the provider and
 * ledger page 1, whose `total_count` locks the currency once the provider has transactions. An
 * archived provider can only be renamed. A `409` shows its message and reloads.
 *
 * A role that may not manage accounts sees the permission message instead of the form.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankProviderEdit() {
  const page = useAccountEditPage(BankProviderEditController, {
    base: PROVIDERS_BASE, fieldsFrom: providerFieldsFromAccount, idPrefix: 'bank-provider-edit-',
  });
  const {
    context, notFound, forbidden, accountId, account, state, handlers,
  } = page;

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  if (forbidden) {
    return <PermissionDenied />;
  }

  return BankProviderFormHelper.render(state, handlers, {
    heading: account?.archived_at ? 'Rename provider' : 'Edit provider',
    submitLabel: 'Save',
    cancelHref: contextHash(context, `${PROVIDERS_BASE}/${accountId}`),
  });
}
