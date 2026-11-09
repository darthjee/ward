import NotFound from '../../../../common/notFound/NotFound.jsx';
import useAccountantHandoff from './hooks/useAccountantHandoff.js';
import AccountantHandoffHelper from './helpers/AccountantHandoffHelper.jsx';

/**
 * Accountant hand-off page (`<ui>/bank/providers/accountant`): a date range (the last full
 * month by default) and an "Unsent only" toggle (on), the preview of the business-expense
 * charges with per-currency totals, **Download CSV** (built client-side from the loaded rows)
 * and **Mark as sent** (after a confirmation). A `404` (non-member organization) shows the
 * Not-found view.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankProviderAccountant() {
  const { context, state, handlers } = useAccountantHandoff();

  if (state.notFound) {
    return <NotFound orgId={context.orgId ?? null} />;
  }

  return AccountantHandoffHelper.render({ ...state, context }, handlers);
}
