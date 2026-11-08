import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { withHashQuery } from '../../../../../utils/routing/hashQuery.js';

/**
 * Build the hash of a ledger page of an account detail page.
 *
 * @description The section base (`'/bank/accounts'` or `'/bank/debts'`) decides which submenu
 * the detail page lives under; the owner context adds the `/orgs/:orgId` prefix.
 * @param {object} context - The owner context.
 * @param {string} base - The section base path, e.g. `'/bank/accounts'`.
 * @param {number|string} accountId - The account id.
 * @param {number} page - The page.
 * @returns {string} The detail hash, with `?page=N`.
 */
export function ledgerPageHref(context, base, accountId, page) {
  return withHashQuery(contextHash(context, `${base}/${accountId}`), { page });
}
