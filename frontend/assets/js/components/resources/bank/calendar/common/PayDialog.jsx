import Modal from 'react-bootstrap/cjs/Modal.js';
import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../common/BankErrorAlert.jsx';
import PayForm from './PayForm.jsx';

/**
 * The Pay dialog of a Calendar entry.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.show - Whether the dialog is open.
 * @param {object|null} props.occurrence - The occurrence being paid.
 * @param {Array<object>|null} props.accounts - The loaded paying accounts.
 * @param {{fields: object, fieldErrors: object, error: (object|null)}} props.state - The form
 *   state.
 * @param {boolean} props.pending - Whether the payment is in flight.
 * @param {Function} props.onChange - Field change handler.
 * @param {Function} props.onConfirm - Called on confirm.
 * @param {Function} props.onCancel - Called on cancel / close.
 * @returns {React.ReactElement|null} The modal, or `null` without an occurrence.
 */
export default function PayDialog({
  show, occurrence, accounts, state, pending, onChange, onConfirm, onCancel,
}) {
  if (!occurrence) {
    return null;
  }

  return (
    <Modal show={show} onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>Pay</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <BankErrorAlert error={state.error} />
        <PayForm occurrence={occurrence} accounts={accounts} state={state} onChange={onChange} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm} disabled={pending}>Pay</Button>
      </Modal.Footer>
    </Modal>
  );
}
