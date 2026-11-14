/**
 * Allowlisted display locales, in select order. Mirrors the backend's `USER_LOCALES`; both
 * must stay in sync.
 */
export const DISPLAY_LOCALES = [
  { value: null, label: 'Browser default' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'pt-PT', label: 'Português (Portugal)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
];

/**
 * Tell whether a value is one of the allowlisted (non-null) locale tags.
 *
 * @param {*} value - The candidate value.
 * @returns {boolean} `true` when it is an allowlisted locale tag.
 */
export function isDisplayLocale(value) {
  return typeof value === 'string'
    && DISPLAY_LOCALES.some((entry) => entry.value === value);
}
