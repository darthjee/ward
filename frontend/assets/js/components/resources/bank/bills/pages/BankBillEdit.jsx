import NotFound from '../../../../common/notFound/NotFound.jsx';
import useBillForm from './hooks/useBillForm.js';
import BankBillFormHelper from './helpers/BankBillFormHelper.jsx';

/**
 * Edit bill page (`<ui>/bank/bills/:billId/edit`): prefilled from the bill (an unknown bill,
 * or one of an archived provider, shows Not-found). Saving sends only the changed fields;
 * **Delete** asks for confirmation. A paid bill answers `409` and the page tells the user to
 * undo the payment first. Saving or deleting goes to the provider's detail page.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankBillEdit() {
  const {
    context, notFound, cancelHref, state, handlers,
  } = useBillForm({ edit: true, idPrefix: 'bank-bill-edit-' });

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankBillFormHelper.render(state, handlers, { heading: 'Edit bill', submitLabel: 'Save', cancelHref });
}
