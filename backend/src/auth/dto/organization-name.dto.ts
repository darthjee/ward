import { Transform } from 'class-transformer';
import { buildMessage, IsNotEmpty, IsString, Matches, ValidateBy } from 'class-validator';

/** Longest accepted organization name, in code points (matches `varchar(255)`). */
export const ORGANIZATION_NAME_MAX_LENGTH = 255;

// Any Unicode "Control" (Cc) character: C0 controls (incl. `\u0000`, tab, newline), DEL and C1.
const NO_CONTROL_CHARACTERS = /^[^\p{Cc}]*$/u;

/**
 * Validates that a string has at most `max` **code points** (`[...value].length`),
 * so astral characters (e.g. emoji) count once, unlike UTF-16 `length`. Used
 * instead of `@MaxLength`, which validator.js computes after discounting
 * variation selectors.
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

/**
 * Request body for `POST /orgs.json` and `PATCH /orgs/:orgId.json`: only `name`,
 * required in both. The name is trimmed, then must be non-empty, at most
 * {@link ORGANIZATION_NAME_MAX_LENGTH} code points and free of control
 * characters. Taken through `@StrictBody()`, so any other field (e.g. `role`,
 * `organizationId`) answers 400.
 */
export class OrganizationNameDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(ORGANIZATION_NAME_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, { message: 'name must not contain control characters' })
    name!: string;
}
