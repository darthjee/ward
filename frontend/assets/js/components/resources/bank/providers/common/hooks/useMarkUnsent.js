import { useMemo, useState } from 'react';
import MarkUnsentController from '../controllers/MarkUnsentController.js';

/**
 * State and handler of the ledger's **Mark as unsent** links on a provider detail page,
 * layered on `useAccountDetail` (its context, reload and page alert).
 *
 * @param {{context: object, reload: Function, setError: Function}} deps - The owner context,
 *   the account + ledger reload and the page alert's error setter.
 * @returns {{state: {markUnsentPending: boolean}, handlers: {onMarkUnsent: Function}}} The
 *   in-flight flag and the handler (called with the ledger row).
 */
export default function useMarkUnsent({ context, reload, setError }) {
  const [pending, setPending] = useState(false);
  const controller = useMemo(() => new MarkUnsentController({
    context, setPending, setError, reload,
  }), [context, setError, reload]);

  return {
    state: { markUnsentPending: pending },
    handlers: { onMarkUnsent: (transaction) => controller.markUnsent(transaction) },
  };
}
