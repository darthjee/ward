/**
 * One definition-list entry of an account header (`<dt>` / `<dd>`), shown as `—` when blank.
 *
 * @description The value is rendered as text (React escaping) and keeps its line breaks.
 * @param {{label: string, value: React.ReactNode}} props - The term and its description.
 * @returns {React.ReactElement} The entry.
 */
export default function DetailEntry({ label, value }) {
  return (
    <div className="col-sm-6 col-lg-4 mb-2">
      <dt className="small text-muted">{label}</dt>
      <dd className="mb-0 text-break" style={{ whiteSpace: 'pre-wrap' }}>{value || '—'}</dd>
    </div>
  );
}
