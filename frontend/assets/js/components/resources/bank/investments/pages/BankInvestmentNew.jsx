import NotFound from '../../../../common/notFound/NotFound.jsx';
import PermissionDenied from '../../../../common/PermissionDenied.jsx';
import useAccountNewPage from '../../common/form/hooks/useAccountNewPage.js';
import BankInvestmentNewController from './controllers/BankInvestmentNewController.js';
import { emptyInvestmentFields } from './controllers/investmentFormFields.js';
import BankInvestmentFormHelper from './helpers/BankInvestmentFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { INVESTMENTS_BASE } from '../../common/sections.js';

/**
 * New investment page (`<ui>/bank/investments/new`): the currency defaults to `settings.json`'s
 * `default_currency`; when that fails the form still works, with no default and a warning.
 * Saving creates an `investment` account (opening balance `0`) and goes to its detail page.
 *
 * A role that may not manage accounts sees the permission message instead of the form.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankInvestmentNew() {
  const {
    context, notFound, forbidden, state, handlers,
  } = useAccountNewPage(BankInvestmentNewController, emptyInvestmentFields(), 'bank-investment-new-');

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  if (forbidden) {
    return <PermissionDenied />;
  }

  return BankInvestmentFormHelper.render(state, handlers, {
    heading: 'New investment', submitLabel: 'Create', cancelHref: contextHash(context, INVESTMENTS_BASE),
  });
}
