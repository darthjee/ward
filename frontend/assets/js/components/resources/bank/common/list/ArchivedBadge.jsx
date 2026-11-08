/**
 * The "Archived" badge of a list row, rendered only for an archived account.
 *
 * @param {{account: object}} props - The account.
 * @returns {React.ReactElement|null} The badge, or `null` for an active account.
 */
export default function ArchivedBadge({ account }) {
  if (!account.archived_at) {
    return null;
  }

  return <span className="badge text-bg-secondary ms-2">Archived</span>;
}
