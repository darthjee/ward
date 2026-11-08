/**
 * Compute the window of page numbers shown around the current page.
 *
 * @param {number} page - The current page.
 * @param {number} totalPages - The number of pages.
 * @param {number} [radius] - How many pages to show on each side of the current one.
 * @returns {Array<number>} The ascending page numbers, clamped to `1..totalPages`.
 */
export function pageWindow(page, totalPages, radius = 2) {
  if (totalPages < 1) {
    return [];
  }

  const current = Math.min(Math.max(page, 1), totalPages);
  const first = Math.max(1, current - radius);
  const last = Math.min(totalPages, current + radius);

  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
