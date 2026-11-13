import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { withHashQuery } from '../../../../../utils/routing/hashQuery.js';
import { BILLS_BASE } from '../../common/sections.js';

/**
 * The **Add bill** link of a provider detail page, opening `<ui>/bills/new?provider=:id` in the
 * active context; hidden on an archived provider (the server rejects bills for it).
 *
 * @param {{account: object, context: object}} props - The provider account and the owner
 *   context.
 * @returns {React.ReactElement|null} The link, or `null` when archived.
 */
export default function AddBillLink({ account, context }) {
  if (account.archived_at) {
    return null;
  }

  const href = withHashQuery(contextHash(context, `${BILLS_BASE}/new`), { provider: account.id });

  return <a className="btn btn-sm btn-outline-primary" href={href}>Add bill</a>;
}
