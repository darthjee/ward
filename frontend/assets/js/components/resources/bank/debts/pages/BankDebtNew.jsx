import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountNewPage from '../../common/form/hooks/useAccountNewPage.js';
import BankDebtNewController from './controllers/BankDebtNewController.js';
import { emptyDebtFields } from './controllers/debtFormFields.js';
import BankDebtFormHelper from './helpers/BankDebtFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { DEBTS_BASE } from '../../common/sections.js';

/**
 * New debt page (`<ui>/bank/debts/new`): the currency defaults to `settings.json`'s
 * `default_currency`; when that fails the form still works, with no default and a warning.
 * Saving creates a `debt` account and goes to its detail page.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankDebtNew() {
  const {
    context, notFound, state, handlers,
  } = useAccountNewPage(BankDebtNewController, emptyDebtFields(), 'bank-debt-new-');

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankDebtFormHelper.render(state, handlers, {
    heading: 'New debt', submitLabel: 'Create', cancelHref: contextHash(context, DEBTS_BASE),
  });
}
