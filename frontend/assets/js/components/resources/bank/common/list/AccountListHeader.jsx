import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { withHashQuery } from '../../../../../utils/routing/hashQuery.js';

/**
 * Header of an accounts list page: the title, the *Show / Hide archived* toggle and the create
 * button, all linked under the section base in the active context.
 *
 * @param {{title: string, base: string, context: object, archived: boolean,
 *   newLabel: string}} props - The page title, the section base path, the active owner
 *   context, whether archived rows are shown and the create button label.
 * @returns {React.ReactElement} The header.
 */
export default function AccountListHeader({
  title, base, context, archived, newLabel,
}) {
  const listHash = contextHash(context, base);
  const toggleHash = withHashQuery(listHash, { archived: archived ? null : 'true' });

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 className="me-auto mb-0">{title}</h1>
      <a className="btn btn-outline-secondary" href={toggleHash}>
        {archived ? 'Hide archived' : 'Show archived'}
      </a>
      <a className="btn btn-primary" href={contextHash(context, `${base}/new`)}>{newLabel}</a>
    </div>
  );
}
