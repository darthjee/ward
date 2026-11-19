/** Display label of each provider-bill kind. */
const KIND_LABELS = new Map([
  ['recurring', 'Recurring'],
  ['one_off', 'One-off'],
]);

/**
 * The kind badge (Recurring / One-off) of a provider bill.
 *
 * @param {{kind: string}} props - The bill's `kind`.
 * @returns {React.ReactElement} The badge.
 */
export default function BillKindBadge({ kind }) {
  const variant = kind === 'recurring' ? 'text-bg-info' : 'text-bg-secondary';

  return <span className={`badge ${variant}`}>{KIND_LABELS.get(kind) ?? kind}</span>;
}
