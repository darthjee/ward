import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountEditPage from '../../common/form/hooks/useAccountEditPage.js';
import BankDebtEditController from './controllers/BankDebtEditController.js';
import { debtFieldsFromAccount } from './controllers/debtFormFields.js';
import BankDebtFormHelper from './helpers/BankDebtFormHelper.jsx';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { DEBTS_BASE } from '../../common/sections.js';

/**
 * Edit debt page (`<ui>/bank/debts/:accountId/edit`): prefilled from the debt (Amount owed shown
 * positive) and ledger page 1, whose `total_count` locks the currency once the debt has
 * transactions. An archived debt can only be renamed. A `409` shows its message and reloads.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankDebtEdit() {
  const {
    context, notFound, accountId, account, state, handlers,
  } = useAccountEditPage(BankDebtEditController, {
    base: DEBTS_BASE, fieldsFrom: debtFieldsFromAccount, idPrefix: 'bank-debt-edit-',
  });

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankDebtFormHelper.render(state, handlers, {
    heading: account?.archived_at ? 'Rename debt' : 'Edit debt',
    submitLabel: 'Save',
    cancelHref: contextHash(context, `${DEBTS_BASE}/${accountId}`),
  });
}
