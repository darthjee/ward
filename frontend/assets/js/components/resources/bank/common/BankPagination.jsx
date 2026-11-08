import Pagination from 'react-bootstrap/cjs/Pagination.js';
import { pageWindow } from './pageWindow.js';

/**
 * Build the props of one pagination link.
 *
 * @param {number} target - The page the link goes to.
 * @param {{hrefFor: Function, onNavigate: (Function|undefined)}} links - Link builders.
 * @returns {{href: string, onClick: (Function|undefined)}} The link props.
 */
function linkProps(target, { hrefFor, onNavigate }) {
  return {
    href: hrefFor(target),
    onClick: onNavigate ? (event) => onNavigate(target, event) : undefined,
  };
}

/**
 * Pagination controls for the bank lists: First / Prev / a window of page numbers / Next /
 * Last.
 *
 * @description Hidden when there is a single page (or none). Each item is a real link (built by
 * `hrefFor`, so reload / open in new tab work); `onNavigate(page, event)` lets the page
 * intercept a click (e.g. to confirm discarding an unsaved form).
 * @param {object} props - Component props.
 * @param {number} props.page - The current page.
 * @param {number} props.totalPages - The number of pages.
 * @param {Function} props.hrefFor - Maps a page number to its hash.
 * @param {Function} [props.onNavigate] - Called with `(page, event)` on click.
 * @returns {React.ReactElement|null} The controls, or `null` for a single page.
 */
export default function BankPagination({
  page, totalPages, hrefFor, onNavigate,
}) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  const links = { hrefFor, onNavigate };
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <Pagination className="justify-content-center">
      <Pagination.First disabled={atStart} {...linkProps(1, links)} />
      <Pagination.Prev disabled={atStart} {...linkProps(Math.max(page - 1, 1), links)} />
      {pageWindow(page, totalPages).map((number) => (
        <Pagination.Item key={number} active={number === page} {...linkProps(number, links)}>
          {number}
        </Pagination.Item>
      ))}
      <Pagination.Next disabled={atEnd} {...linkProps(Math.min(page + 1, totalPages), links)} />
      <Pagination.Last disabled={atEnd} {...linkProps(totalPages, links)} />
    </Pagination>
  );
}
