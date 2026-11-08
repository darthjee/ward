import { hashQuery } from '../../../../utils/routing/hashQuery.js';

const PAGE_PATTERN = /^[1-9][0-9]*$/;

/**
 * Read the ledger page from the hash query.
 *
 * @param {string} hash - The raw hash value, e.g. `#/bank/accounts/12?page=3`.
 * @returns {number} The page; 1 when missing or invalid.
 */
export function pageFromHash(hash) {
  const raw = hashQuery(hash).get('page');

  if (!raw || !PAGE_PATTERN.test(raw)) {
    return 1;
  }

  const page = Number(raw);

  return Number.isSafeInteger(page) ? page : 1;
}
