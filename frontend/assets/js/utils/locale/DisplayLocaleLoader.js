import AccountsClient from '../../client/AccountsClient.js';
import AuthEvents from '../../client/AuthEvents.js';
import DisplayLocale from './DisplayLocale.js';

let started = false;
let generation = 0;

/**
 * Load the account locale after a login, ignoring a response that arrives after a newer
 * auth change.
 *
 * @param {number} ticket - The generation at request time.
 * @returns {Promise<void>} Resolves when handled; never rejects.
 */
async function load(ticket) {
  try {
    const account = await AccountsClient.getAccount();

    if (ticket === generation) {
      DisplayLocale.set(account?.locale ?? null);
    }
  } catch {
    // keep the browser default; no error surfaced
  }
}

/**
 * Handle an auth change event.
 *
 * @param {CustomEvent} event - The `auth:changed` event.
 * @returns {void} Nothing.
 */
function onAuthChanged(event) {
  generation += 1;

  if (event.detail?.loggedIn) {
    load(generation);
  } else {
    DisplayLocale.set(null);
  }
}

/**
 * Keeps {@link DisplayLocale} in sync with the logged-in user's account locale.
 */
const DisplayLocaleLoader = {
  /**
   * Start listening to auth changes (idempotent).
   *
   * @returns {void} Nothing.
   */
  start() {
    if (started) {
      return;
    }

    started = true;
    AuthEvents.subscribe(onAuthChanged);
  },

  /**
   * Stop listening to auth changes.
   *
   * @returns {void} Nothing.
   */
  stop() {
    started = false;
    generation += 1;
    AuthEvents.unsubscribe(onAuthChanged);
  },
};

export default DisplayLocaleLoader;
