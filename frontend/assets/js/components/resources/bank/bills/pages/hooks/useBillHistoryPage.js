import { useEffect, useState } from 'react';
import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';
import { buildBillHistoryPageLoadEffect } from '../controllers/billHistoryPageLoad.js';
import Router from '../../../../../../utils/routing/Router.js';
import { currentHash } from '../../../common/currentHash.js';
import { BILLS_BASE } from '../../../common/sections.js';

/**
 * Read the bill id of the bill history route. Exported for specs.
 *
 * @param {string} [hash] - The window location hash.
 * @returns {string} The bill id.
 */
export function readBillHistoryId(hash = currentHash()) {
  return Router.extractContextParams(`${BILLS_BASE}/:billId/history`, hash).billId;
}

/**
 * State of the bill history page (`<ui>/bills/:billId/history`).
 *
 * @description Loads the bill and its provider. The owner context is captured on mount (the page
 * is remounted on a context change).
 * @returns {{context: object, notFound: boolean, state: {bill: (object|null),
 *   provider: (object|null), loadError: (object|null)}, onRetryLoad: Function}} The owner
 *   context, whether to show Not-found, the helper state and the load retry.
 */
export default function useBillHistoryPage() {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const [billId] = useState(() => readBillHistoryId());
  const [data, setData] = useState({ bill: null, provider: null });
  const [loadError, setLoadError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => buildBillHistoryPageLoadEffect(context, billId, {
    onLoaded: (loaded) => {
      setData(loaded);
      setLoadError(null);
    },
    onNotFound: () => setNotFound(true),
    onError: setLoadError,
  })(), [context, billId, attempt]);

  return {
    context,
    notFound,
    state: { ...data, loadError },
    onRetryLoad: () => setAttempt((value) => value + 1),
  };
}
