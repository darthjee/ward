/** Display locales a user may choose (BCP 47 tags); mirrored by the frontend. */
export const USER_LOCALES = ['en-US', 'en-GB', 'pt-BR', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

/** One of the allowlisted display locales. */
export type UserLocale = typeof USER_LOCALES[number];

/**
 * Tells whether a value is exactly one of the allowlisted locales (case-sensitive).
 * @param value - Any value to test.
 * @returns True when the value is an allowlisted locale.
 */
export function isUserLocale(value: unknown): value is UserLocale {
  return typeof value === 'string' && (USER_LOCALES as readonly string[]).includes(value);
}
