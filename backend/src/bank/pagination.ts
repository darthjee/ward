import { BadRequestException } from '@nestjs/common';

/** Rows per ledger page. */
export const LEDGER_PER_PAGE = 50;

const PAGE_PATTERN = /^[1-9][0-9]*$/;

/**
 * The pagination metadata of a paged response (snake_case, as every API
 * response).
 */
export interface Pagination {
  page: number;
  per_page: number;
  total_pages: number;
  total_count: number;
}

/**
 * Parses the `page` query parameter.
 * @param {unknown} raw - The raw query value.
 * @returns {number} `1` when absent, otherwise the requested page.
 * @throws {BadRequestException} When `raw` is not a positive integer string
 *   (e.g. `0`, `-1`, `abc`, `1.5`, a repeated parameter) or is unsafely large.
 */
export function parsePage(raw: unknown): number {
  if (raw === undefined) {
    return 1;
  }

  if (typeof raw !== 'string' || !PAGE_PATTERN.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new BadRequestException('page must be a positive integer');
  }

  return Number(raw);
}

/**
 * Builds the pagination metadata. An empty collection still has exactly one
 * page (for the ledger, the one holding the opening row).
 * @param {number} page - The requested page (may be past the last page).
 * @param {number} perPage - Rows per page.
 * @param {number} totalCount - Total rows.
 * @returns {Pagination} The metadata block.
 */
export function buildPagination(page: number, perPage: number, totalCount: number): Pagination {
  return {
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil(totalCount / perPage)),
    total_count: totalCount,
  };
}
