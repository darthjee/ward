import { SECTION_BY_TYPE, TYPE_BY_SECTION } from '../sections.js';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { navigate } from '../currentHash.js';

/**
 * Decide what to do with an account loaded under a section (edge case 7: `GET
 * /accounts/:id.json` returns any type).
 *
 * @description A matching type (or a response without `type`, or a section without a type) is
 * shown; a type owned by another section redirects there (`<other base>/:id<suffix>`, e.g. a
 * debt opened under `/bank/accounts/:id` goes to `/bank/debts/:id`, an investment opened under
 * `/bank/debts/:id` goes to `/bank/investments/:id`); a type without a frontend section (an
 * unknown type) is treated as not found.
 * @param {object} account - The loaded account.
 * @param {{base: string, context: object, suffix: string}} where - The section base the page
 *   lives under, the owner context and the path suffix kept on redirect (e.g. `/edit`).
 * @returns {{kind: string, hash: (string|undefined)}} `{ kind: 'show' }`,
 *   `{ kind: 'redirect', hash }` or `{ kind: 'notFound' }`.
 */
export function accountTypeOutcome(account, { base, context, suffix = '' }) {
  const expected = TYPE_BY_SECTION.get(base);

  if (!expected || !account?.type || account.type === expected) {
    return { kind: 'show' };
  }

  const other = SECTION_BY_TYPE.get(account.type);

  return other
    ? { kind: 'redirect', hash: contextHash(context, `${other}/${account.id}${suffix}`) }
    : { kind: 'notFound' };
}

/**
 * Wrap the load callbacks of an account page so a wrong-type account is never shown: it
 * redirects to its own section, or reports Not-found (see {@link accountTypeOutcome}).
 *
 * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - The page's
 *   load callbacks (`onLoaded` receives `{ account, ledger }`).
 * @param {{base: string, context: object, suffix: string, navigate: Function}} where - The
 *   section base, the owner context, the suffix kept on redirect and a navigation override.
 * @returns {{onLoaded: Function, onNotFound: Function, onError: Function}} The guarded
 *   callbacks.
 */
export function guardAccountType(callbacks, { navigate: navigateTo = navigate, ...where }) {
  return {
    ...callbacks,
    onLoaded: (loaded) => {
      const outcome = accountTypeOutcome(loaded.account, where);

      if (outcome.kind === 'redirect') {
        navigateTo(outcome.hash);
        return;
      }

      if (outcome.kind === 'notFound') {
        callbacks.onNotFound();
        return;
      }

      callbacks.onLoaded(loaded);
    },
  };
}
