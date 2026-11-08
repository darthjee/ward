import { classifyError } from './bankErrors.js';

/**
 * Run a bank load request and report its outcome.
 *
 * @description A `404` reports Not-found; any other failure reports the classified error (see
 * `classifyError`). An `undefined` result (session expired) reports nothing. Answers arriving
 * after `isActive()` turned false are ignored.
 * @param {Function} request - Resolves the loaded value.
 * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
 *   callbacks (`onError` receives the classified error).
 * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
 * @returns {Promise<void>} Resolves once the outcome is reported.
 */
export async function runLoad(request, { onLoaded, onNotFound, onError }, isActive = () => true) {
  try {
    const value = await request();

    if (value && isActive()) {
      onLoaded(value);
    }
  } catch (error) {
    if (!isActive()) {
      return;
    }

    const classified = classifyError(error);

    if (classified.kind === 'notFound') {
      onNotFound();
      return;
    }

    onError(classified);
  }
}

/**
 * Build a React effect running a load, whose cleanup drops late answers.
 *
 * @param {Function} load - Called with the liveness check `isActive`.
 * @returns {Function} Effect callback, returning the cleanup.
 */
export function buildLoadEffect(load) {
  return () => {
    let active = true;

    load(() => active);

    return () => {
      active = false;
    };
  };
}
