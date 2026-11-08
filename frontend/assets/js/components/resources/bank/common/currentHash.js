/**
 * Read the current hash, SSR-safe.
 *
 * @returns {string} `window.location.hash`, or `''` outside the browser.
 */
export function currentHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * Navigate to a hash, SSR-safe.
 *
 * @param {string} hash - The hash to navigate to.
 * @returns {void} Nothing.
 */
export function navigate(hash) {
  if (typeof window !== 'undefined') {
    window.location.hash = hash;
  }
}
