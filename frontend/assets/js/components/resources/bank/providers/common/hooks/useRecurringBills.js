import { useEffect, useState } from 'react';
import ProviderBillsClient from '../../../../../../client/ProviderBillsClient.js';
import { buildLoadEffect, runLoad } from '../../../common/runLoad.js';

const ignore = () => undefined;

/**
 * Load the first page of a provider's recurring bills into `setRecurring`. Exported so specs
 * can run it without a React renderer.
 *
 * @description Skipped on an archived provider (its shortcuts are hidden). Failures are
 * ignored: the page only feeds the **Add charge** suggestion, which stays empty.
 * @param {{context: object, providerId: (number|string), archived: boolean,
 *   setRecurring: Function}} deps - The owner context, the provider id, whether the provider is
 *   archived and the state setter.
 * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
 * @returns {Promise<void>} Resolves once the page is stored (or ignored).
 */
export async function loadRecurringBills({
  context, providerId, archived, setRecurring,
}, isActive = () => true) {
  if (archived) {
    return;
  }

  await runLoad(
    () => ProviderBillsClient.listProviderBills(context, providerId, 1, 'recurring'),
    { onLoaded: setRecurring, onNotFound: ignore, onError: ignore },
    isActive,
  );
}

/**
 * The first page of a provider's `kind=recurring` bills, fetched once per provider (none on an
 * archived one), feeding the **Add charge** suggestion.
 *
 * @param {{context: object, account: object}} options - The owner context and the provider.
 * @returns {{provider_bills: Array<object>, pagination: object}|null} The page, or `null`
 *   while not loaded.
 */
export default function useRecurringBills({ context, account }) {
  const [recurring, setRecurring] = useState(null);
  const providerId = account.id;
  const archived = Boolean(account.archived_at);

  useEffect(
    () => buildLoadEffect((isActive) => loadRecurringBills({
      context, providerId, archived, setRecurring,
    }, isActive))(),
    [context, providerId, archived],
  );

  return recurring;
}
