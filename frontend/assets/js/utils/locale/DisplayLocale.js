import { isDisplayLocale } from './locales.js';

let current;
const subscribers = new Set();

/**
 * In-memory store of the user's display locale. Formatting helpers read it through `get()`
 * and pass it straight to `Intl` (`undefined` means browser default).
 */
const DisplayLocale = {
  /**
   * Read the stored locale.
   *
   * @returns {string|undefined} The locale tag, or `undefined` for browser default.
   */
  get() {
    return current;
  },

  /**
   * Store an allowlisted locale; `null` or an unknown value clears it. Subscribers are
   * notified only when the value changes.
   *
   * @param {string|null} locale - The locale tag, or `null` for browser default.
   * @returns {void} Nothing.
   */
  set(locale) {
    const next = isDisplayLocale(locale) ? locale : undefined;

    if (next === current) {
      return;
    }

    current = next;
    [...subscribers].forEach((subscriber) => subscriber(next));
  },

  /**
   * Subscribe to locale changes.
   *
   * @param {Function} fn - Called with the new locale (or `undefined`).
   * @returns {void} Nothing.
   */
  subscribe(fn) {
    subscribers.add(fn);
  },

  /**
   * Unsubscribe from locale changes.
   *
   * @param {Function} fn - The function previously passed to `subscribe`.
   * @returns {void} Nothing.
   */
  unsubscribe(fn) {
    subscribers.delete(fn);
  },
};

export default DisplayLocale;
