import { DESCRIPTION_MAX_LENGTH } from './dto/field-validators.js';

/**
 * The description of the transactions a payment records:
 * `"<bill description | account name> — <nominal due date>"`. A long label is
 * cut (by code points, like `@MaxCodePoints`) so the whole text fits the
 * 255-character column and the date suffix is always kept.
 * @param {string} label - The bill description, or the source account's name.
 * @param {string} nominal - The occurrence's nominal due date.
 * @returns {string} The description, at most 255 code points.
 */
export function paymentDescription(label: string, nominal: string): string {
  const suffix = ` — ${nominal}`;
  const room = DESCRIPTION_MAX_LENGTH - [...suffix].length;

  return `${[...label].slice(0, room).join('')}${suffix}`;
}
