import NotFound from '../../../../common/notFound/NotFound.jsx';
import useBillForm from './hooks/useBillForm.js';
import BankBillFormHelper from './helpers/BankBillFormHelper.jsx';

/**
 * New bill page (`<ui>/bank/bills/new[?provider=:id]`): a one-off bill of a provider, paid
 * from a regular account in the provider's currency. `?provider=:id` pre-selects the provider.
 * Saving goes to the provider's detail page.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankBillNew() {
  const {
    context, notFound, cancelHref, state, handlers,
  } = useBillForm({ edit: false, idPrefix: 'bank-bill-new-' });

  if (notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return BankBillFormHelper.render(state, handlers, { heading: 'New bill', submitLabel: 'Create', cancelHref });
}
