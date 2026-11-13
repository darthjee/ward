import ApiError from '../../../../client/ApiError.js';

/**
 * Build the validation messages of a 400.
 *
 * @param {ApiError} error - The error.
 * @returns {Array<string>} `details` when present, otherwise the message alone (`BAD_REQUEST`
 *   carries no `details`).
 */
function validationMessages(error) {
  return Array.isArray(error.details) && error.details.length > 0 ? error.details : [error.message];
}

/**
 * Classify an error raised by a bank request.
 *
 * @description Branches on `status` / `code`, never on the message text:
 * `notFound` (404), `conflict` (409, with its `code`), `validation` (400, with its messages;
 * 422, with its message alone) and `transient` (network failure, 5xx, or anything that is not
 * an {@link ApiError}).
 * @param {*} error - The caught error.
 * @returns {{kind: string, code: (string|undefined), message: string, messages: Array<string>}}
 *   The classification.
 */
export function classifyError(error) {
  if (!(error instanceof ApiError) || error.status >= 500) {
    return {
      kind: 'transient', code: undefined, message: 'Something went wrong. Please try again.', messages: [],
    };
  }

  const base = { code: error.code, message: error.message, messages: [error.message] };

  if (error.status === 404) {
    return { ...base, kind: 'notFound' };
  }

  if (error.status === 409) {
    return { ...base, kind: 'conflict' };
  }

  if (error.status === 400) {
    return { ...base, kind: 'validation', messages: validationMessages(error) };
  }

  if (error.status === 422) {
    return { ...base, kind: 'validation' };
  }

  return { ...base, kind: 'transient' };
}
