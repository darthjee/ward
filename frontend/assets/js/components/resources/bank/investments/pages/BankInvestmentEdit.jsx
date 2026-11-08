import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountEditPage from '../../common/form/hooks/useAccountEditPage.js';
import BankInvestmentEditController from './controllers/BankInvestmentEditController.js';
import { investmentFieldsFromAccount } from './controllers/investmentFormFields.js';
import BankInvestmentFormHelper from './helpers/BankInvestmentFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { INVESTMENTS_BASE } from '../../common/sections.js';

/**
 * Edit investment page (`<ui>/bank/investments/:accountId/edit`): prefilled from the investment
 * and ledger page 1, whose `total_count` locks the currency once the investment has
 * transactions. An archived investment can only be renamed. A `409` shows its message and
 * reloads. An account of another type is redirected to its own edit page.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankInvestmentEdit() {
  const {
    context, notFound, accountId, account, state, handlers,
  } = useAccountEditPage(BankInvestmentEditController, {
    base: INVESTMENTS_BASE, fieldsFrom: investmentFieldsFromAccount, idPrefix: 'bank-investment-edit-',
  });

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankInvestmentFormHelper.render(state, handlers, {
    heading: account?.archived_at ? 'Rename investment' : 'Edit investment',
    submitLabel: 'Save',
    cancelHref: contextHash(context, `${INVESTMENTS_BASE}/${accountId}`),
  });
}
