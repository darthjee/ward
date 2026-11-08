import type { ValueTransformer } from 'typeorm';

/**
 * Maps a MySQL `BIGINT` column to a JS `bigint`. mysql2 returns `BIGINT`
 * values as strings (TypeORM enables `bigNumberStrings`), so they are never
 * squeezed through a float.
 */
export const bigintTransformer: ValueTransformer = {
  /**
   * @param {bigint | null | undefined} value - The entity value.
   * @returns {string | null | undefined} The decimal string written to MySQL.
   */
  to: (value: bigint | null | undefined): string | null | undefined =>
    value === null || value === undefined ? value : value.toString(),
  /**
   * @param {string | number | null} value - The raw column value.
   * @returns {bigint | null} The value as a `bigint`.
   */
  from: (value: string | number | null): bigint | null =>
    value === null || value === undefined ? null : BigInt(value),
};
