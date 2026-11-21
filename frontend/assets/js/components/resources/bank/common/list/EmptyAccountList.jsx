/**
 * Empty state of an accounts list: a message and, when a create page hash is given, a create
 * button.
 *
 * @param {{message: string, href: (string|null), label: string}} props - The message, the
 *   create page hash (`null` when the caller's role may not create accounts: the button is
 *   omitted) and the button label.
 * @returns {React.ReactElement} The empty state.
 */
export default function EmptyAccountList({ message, href, label }) {
  return (
    <div className="text-center text-muted my-5">
      <p>{message}</p>
      {href && <a className="btn btn-primary" href={href}>{label}</a>}
    </div>
  );
}
