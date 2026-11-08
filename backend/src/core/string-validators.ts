import { buildMessage, ValidateBy } from 'class-validator';

/**
 * Validates that a string has at most `max` **code points** (`[...value].length`),
 * so astral characters (e.g. emoji) count once, unlike UTF-16 `length`. Used
 * instead of `@MaxLength`, which validator.js computes after discounting
 * variation selectors. Matches how MySQL counts `utf8mb4` `VARCHAR` lengths.
 * @param {number} max - The maximum number of code points.
 * @returns {PropertyDecorator} The validation decorator.
 */
export function MaxCodePoints(max: number): PropertyDecorator {
  return ValidateBy({
    name: 'maxCodePoints',
    constraints: [max],
    validator: {
      validate: (value: unknown): boolean => typeof value === 'string' && [...value].length <= max,
      defaultMessage: buildMessage(
        (eachPrefix) => `${eachPrefix}$property must be shorter than or equal to $constraint1 characters`,
      ),
    },
  });
}

/**
 * Trims string values (JS `trim()`), leaving any other value untouched so
 * `@IsString()` still rejects it.
 * @param {{ value: unknown }} params - class-transformer's transform parameters.
 * @returns {unknown} The trimmed string, or the original value.
 */
export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
