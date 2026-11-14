import { useEffect, useState } from 'react';
import DisplayLocale from './DisplayLocale.js';

/**
 * Hook returning the current display locale and re-rendering the caller when it changes.
 *
 * @returns {string|undefined} The current display locale (`undefined` = browser default).
 */
export default function useDisplayLocale() {
  const [locale, setLocale] = useState(DisplayLocale.get());

  useEffect(() => {
    setLocale(DisplayLocale.get());
    DisplayLocale.subscribe(setLocale);

    return () => DisplayLocale.unsubscribe(setLocale);
  }, []);

  return locale;
}
