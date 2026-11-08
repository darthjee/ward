import { useState } from 'react';
import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';

/**
 * Build the field-change handlers of an account form.
 *
 * @param {Function} setFields - React state setter for the form fields.
 * @param {Function} setSubmitError - React state setter for the classified error.
 * @returns {{onFieldChange: Function, onCurrencyChange: Function, onDismiss: Function}} The
 *   handlers: `onFieldChange` reads the input's `name` and `value`.
 */
export function buildFieldHandlers(setFields, setSubmitError) {
  return {
    onFieldChange: (event) => {
      const { name, value } = event.target;

      setFields((fields) => ({ ...fields, [name]: value }));
    },
    onCurrencyChange: (currency) => setFields((fields) => ({ ...fields, currency })),
    onDismiss: () => setSubmitError(null),
  };
}

/**
 * Shared state of the account forms (create and edit).
 *
 * @description The owner context is captured on mount: the page is remounted on a context change
 * (see `AppHelper`), and keeping the first object avoids reloading on every hash change.
 * @param {object|null} initialFields - The initial form fields (`null` until loaded).
 * @returns {object} The context, the form state, its setters and the field handlers.
 */
export default function useBankAccountForm(initialFields) {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const [fields, setFields] = useState(initialFields);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);
  const [notFound, setNotFound] = useState(false);

  return {
    context,
    fields,
    setFields,
    fieldErrors,
    setFieldErrors,
    submitError,
    setSubmitError,
    pending,
    setPending,
    notFound,
    setNotFound,
    fieldHandlers: buildFieldHandlers(setFields, setSubmitError),
  };
}
