import { BadRequestException } from '@nestjs/common';
import { buildPagination, LEDGER_PER_PAGE, parsePage } from '../pagination.js';

describe('pagination', () => {
  describe('parsePage', () => {
    it('defaults to 1 when absent', () => {
      expect(parsePage(undefined)).toBe(1);
    });

    it.each([
      ['1', 1],
      ['3', 3],
      ['120', 120],
    ])('parses %p', (raw, expected) => {
      expect(parsePage(raw)).toBe(expected);
    });

    it.each(['0', '-1', 'abc', '1.5', '', '01', ' 1', '1e3', '99999999999999999999', ['1', '2'], 2, null])(
      'rejects %p with a 400',
      (raw) => {
        expect(() => parsePage(raw)).toThrow(BadRequestException);
      },
    );
  });

  describe('buildPagination', () => {
    it('uses 50 rows per ledger page', () => {
      expect(LEDGER_PER_PAGE).toBe(50);
    });

    it('builds the snake_case metadata', () => {
      expect(buildPagination(2, 50, 120)).toEqual({ page: 2, per_page: 50, total_pages: 3, total_count: 120 });
    });

    it('has exactly one page when empty', () => {
      expect(buildPagination(1, 50, 0)).toEqual({ page: 1, per_page: 50, total_pages: 1, total_count: 0 });
    });

    it('fills the last page exactly', () => {
      expect(buildPagination(1, 50, 100).total_pages).toBe(2);
      expect(buildPagination(1, 50, 101).total_pages).toBe(3);
    });

    it('keeps a page past the last one', () => {
      expect(buildPagination(9, 50, 10)).toEqual({ page: 9, per_page: 50, total_pages: 1, total_count: 10 });
    });
  });
});
