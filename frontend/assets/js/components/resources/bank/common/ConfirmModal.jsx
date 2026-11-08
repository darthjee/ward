import Modal from 'react-bootstrap/cjs/Modal.js';
import Button from 'react-bootstrap/cjs/Button.js';

/**
 * Confirmation dialog (e.g. for Delete), whose confirm button is disabled while the request is
 * in flight so a double click never sends twice.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.show - Whether the dialog is open.
 * @param {string} props.title - The dialog title.
 * @param {React.ReactNode} props.children - The dialog body.
 * @param {string} [props.confirmLabel] - The confirm button text.
 * @param {boolean} [props.pending] - Whether the confirmed request is in flight.
 * @param {Function} props.onConfirm - Called on confirm.
 * @param {Function} props.onCancel - Called on cancel / close.
 * @returns {React.ReactElement} The modal.
 */
export default function ConfirmModal({
  show, title, children, confirmLabel = 'Delete', pending = false, onConfirm, onCancel,
}) {
  return (
    <Modal show={show} onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>{confirmLabel}</Button>
      </Modal.Footer>
    </Modal>
  );
}
