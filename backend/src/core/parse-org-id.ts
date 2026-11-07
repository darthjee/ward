import { NotFoundException } from '@nestjs/common';

// Largest value of MySQL's signed `int` primary key.
export const MAX_ORG_ID = 2147483647;

const ORG_ID_PATTERN = /^[1-9][0-9]*$/;

/**
 * Builds the uniform owner-scoped 404. The owner-context guard, `parseOrgId()`
 * and the organization service all throw it, so an unknown, malformed or
 * non-member `:orgId` produce byte-identical bodies (apart from `timestamp`).
 * @returns {NotFoundException} The uniform not-found exception.
 */
export function ownerNotFound(): NotFoundException {
  return new NotFoundException();
}

/**
 * Parses a raw `:orgId` route parameter strictly: only strings matching
 * `^[1-9][0-9]*$` with a value up to {@link MAX_ORG_ID} are accepted. Anything
 * else (`abc`, `007`, `-1`, `1.5`, `1e3`, out of range, non-strings) answers the
 * uniform 404 — never a 400, so malformed ids are indistinguishable from unknown ones.
 * @param {unknown} raw - The raw route parameter.
 * @returns {number} The organization id.
 */
export function parseOrgId(raw: unknown): number {
  if (typeof raw !== 'string' || !ORG_ID_PATTERN.test(raw)) {
    throw ownerNotFound();
  }

  const id = Number(raw);

  if (id > MAX_ORG_ID) {
    throw ownerNotFound();
  }

  return id;
}
