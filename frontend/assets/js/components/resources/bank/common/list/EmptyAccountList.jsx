/**
 * Empty state of an accounts list: a message and a create button.
 *
 * @param {{message: string, href: string, label: string}} props - The message, the create
 *   page hash and the button label.
 * @returns {React.ReactElement} The empty state.
 */
export default function EmptyAccountList({ message, href, label }) {
  return (
    <div className="text-center text-muted my-5">
      <p>{message}</p>
      <a className="btn btn-primary" href={href}>{label}</a>
    </div>
  );
}
