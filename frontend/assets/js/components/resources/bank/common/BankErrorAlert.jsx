import Button from 'react-bootstrap/cjs/Button.js';

/**
 * Render the transient (network / 5xx) alert, dismissible and with a Retry button.
 *
 * @param {{message: string}} error - The classified error.
 * @param {Function} [onRetry] - Retries the failed request.
 * @param {Function} [onDismiss] - Dismisses the alert.
 * @returns {React.ReactElement} The alert.
 */
function renderTransient(error, onRetry, onDismiss) {
  return (
    <div className="alert alert-danger alert-dismissible d-flex align-items-center gap-2" role="alert">
      <span className="me-auto">{error.message}</span>
      {onRetry && <Button variant="outline-danger" size="sm" onClick={onRetry}>Retry</Button>}
      {onDismiss && <button type="button" className="btn-close" aria-label="Close" onClick={onDismiss} />}
    </div>
  );
}

/**
 * Render the messages of a classified error, as one line or a list.
 *
 * @param {Array<string>} messages - The messages.
 * @returns {React.ReactElement} The messages.
 */
function renderMessages(messages) {
  if (messages.length === 1) {
    return <span>{messages[0]}</span>;
  }

  return (
    <ul className="mb-0">
      {messages.map((message) => <li key={message}>{message}</li>)}
    </ul>
  );
}

/**
 * Inline error alert for the bank pages.
 *
 * @description Renders nothing without an error or for a `notFound` (the page renders
 * `NotFound` instead). A `transient` error is dismissible and offers **Retry**; a `conflict`
 * shows its message; a `validation` error lists its details.
 * @param {object} props - Component props.
 * @param {object|null} props.error - A classified error (see `classifyError`).
 * @param {Function} [props.onRetry] - Retries the failed request (transient errors).
 * @param {Function} [props.onDismiss] - Dismisses the alert (transient errors).
 * @returns {React.ReactElement|null} The alert, or `null`.
 */
export default function BankErrorAlert({ error, onRetry, onDismiss }) {
  if (!error || error.kind === 'notFound') {
    return null;
  }

  if (error.kind === 'transient') {
    return renderTransient(error, onRetry, onDismiss);
  }

  return <div className="alert alert-danger" role="alert">{renderMessages(error.messages)}</div>;
}
