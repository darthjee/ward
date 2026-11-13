import { useEffect, useMemo, useState } from 'react';
import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';
import BillFormController from '../controllers/BillFormController.js';
import { buildBillFormLoadEffect, mergeLoadedBill } from '../controllers/billFormLoad.js';
import { emptyBillFields, findProvider, withBillFieldChange } from '../controllers/billFormFields.js';
import Router from '../../../../../../utils/routing/Router.js';
import { hashQuery } from '../../../../../../utils/routing/hashQuery.js';
import { currentHash } from '../../../common/currentHash.js';
import { BILLS_BASE } from '../../../common/sections.js';

/**
 * Build the handlers of a bill page. Exported so specs can run them without a React renderer.
 *
 * @param {object} deps - Handler dependencies.
 * @param {BillFormController} deps.controller - The controller.
 * @param {object|null} deps.fields - The form fields.
 * @param {Function} deps.setFields - Sets the form fields.
 * @param {{providers: Array<object>, accounts: Array<object>}} deps.lists - Loaded lists.
 * @param {object|null} deps.bill - The loaded bill (edit page), or `null` (new page).
 * @param {boolean} deps.edit - Whether this is the edit page.
 * @param {string} deps.currency - The selected provider's currency.
 * @param {object|null} deps.submitError - The form alert's error (may carry `retry`).
 * @param {Function} deps.setSubmitError - Sets the form alert's error.
 * @param {Function} deps.setConfirming - Opens / closes the Delete confirmation.
 * @param {Function} deps.reload - Reloads the page data.
 * @returns {object} The handlers.
 */
export function buildBillFormHandlers({
  controller, fields, setFields, lists, bill, edit, currency, submitError, setSubmitError, setConfirming, reload,
}) {
  const submit = () => {
    if (edit) {
      return bill ? controller.update(bill, fields, currency) : undefined;
    }

    return controller.create(fields, currency);
  };

  return {
    onFieldChange: (event) => {
      const { name, value } = event.target;

      setFields((current) => withBillFieldChange(current, name, value, lists));
    },
    onSubmit: (event) => {
      event.preventDefault();
      return submit();
    },
    onRetry: () => submitError?.retry?.(),
    onDismiss: () => setSubmitError(null),
    onRetryLoad: reload,
    onDelete: () => setConfirming(true),
    onCancelDelete: () => setConfirming(false),
    onConfirmDelete: () => (bill ? controller.destroy(bill) : undefined),
  };
}

/**
 * Read the bill page's route: the bill id on the edit page, the `?provider=:id` pre-selection
 * on the new page. Exported for specs.
 *
 * @param {boolean} edit - Whether this is the edit page.
 * @param {string} [hash] - The window location hash.
 * @returns {{billId: (string|null), fields: (object|null)}} The bill id and the initial form
 *   fields (`null` on the edit page, until the bill is loaded).
 */
export function readBillRoute(edit, hash = currentHash()) {
  if (edit) {
    return { billId: Router.extractContextParams(`${BILLS_BASE}/:billId/edit`, hash).billId, fields: null };
  }

  return { billId: null, fields: emptyBillFields(hashQuery(hash).get('provider') ?? '') };
}

/**
 * Derive the values a bill page shows from its state: the selected provider's currency,
 * whether the form can render and where Cancel goes.
 *
 * @param {{edit: boolean, bill: (object|null), fields: (object|null), lists: object,
 *   controller: BillFormController}} page - The page state.
 * @returns {{currency: string, loaded: boolean, cancelHref: string}} The derived values.
 */
function deriveBillView({
  edit, bill, fields, lists, controller,
}) {
  const providerId = edit ? bill?.provider_account?.id : fields?.provider_account_id;

  return {
    currency: findProvider(lists.providers, fields?.provider_account_id)?.currency ?? '',
    loaded: Boolean(lists.providers) && Boolean(fields),
    cancelHref: controller.returnHash(providerId),
  };
}

/**
 * State and handlers of the one-off bill pages (`<ui>/bills/new[?provider=:id]` and
 * `<ui>/bills/:billId/edit`).
 *
 * @description Loads the non-archived providers and regular accounts (and the bill, on edit).
 * `?provider=:id` pre-selects the provider on the new page. The paying-account options follow
 * the selected provider's currency; changing the provider clears a paying account in another
 * currency. The owner context is captured on mount (the page is remounted on a context change).
 * @param {{edit: boolean, idPrefix: string}} options - Whether this is the edit page and the
 *   input id prefix.
 * @returns {{context: object, notFound: boolean, cancelHref: string, state: object,
 *   handlers: object}} The owner context, whether to show Not-found, the Cancel link, the
 *   helper state and its handlers.
 */
export default function useBillForm({ edit = false, idPrefix }) {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const [route] = useState(() => readBillRoute(edit));
  const { billId } = route;
  const [fields, setFields] = useState(route.fields);
  const [lists, setLists] = useState({ providers: null, accounts: null });
  const [bill, setBill] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const controller = useMemo(() => new BillFormController({
    context, setFieldErrors, setSubmitError, setPending, setConfirming, onNotFound: () => setNotFound(true),
  }), [context]);

  useEffect(() => buildBillFormLoadEffect(context, billId, {
    onLoaded: (loaded) => {
      setLists({ providers: loaded.providers, accounts: loaded.accounts });
      setBill(loaded.bill);
      setLoadError(null);
      setFields((current) => mergeLoadedBill(current, loaded));
    },
    onNotFound: () => setNotFound(true),
    onError: setLoadError,
  })(), [context, billId, attempt]);

  const { currency, loaded, cancelHref } = deriveBillView({
    edit, bill, fields, lists, controller,
  });

  return {
    context,
    notFound,
    cancelHref,
    state: {
      fields: loaded ? fields : null,
      fieldErrors,
      submitError,
      loadError,
      pending,
      providers: lists.providers,
      accounts: lists.accounts,
      currency,
      confirming,
      canDelete: edit,
      idPrefix,
    },
    handlers: buildBillFormHandlers({
      controller,
      fields,
      setFields,
      lists,
      bill,
      edit,
      currency,
      submitError,
      setSubmitError,
      setConfirming,
      reload: () => setAttempt((value) => value + 1),
    }),
  };
}
