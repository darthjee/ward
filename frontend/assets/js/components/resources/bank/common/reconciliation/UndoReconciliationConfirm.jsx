import ConfirmModal from '../ConfirmModal.jsx';

/** Body of the Undo confirmation. */
export const UNDO_RECONCILIATION_BODY = 'Undo this reconciliation? The statement is reopened and its rows are unlocked.';

/**
 * Confirmation of an **Undo** of the latest finished statement.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.show - Whether the dialog is open.
 * @param {boolean} [props.pending] - Whether the undo is in flight.
 * @param {Function} props.onConfirm - Called on confirm.
 * @param {Function} props.onCancel - Called on cancel / close.
 * @returns {React.ReactElement} The modal.
 */
export default function UndoReconciliationConfirm({
  show, pending = false, onConfirm, onCancel,
}) {
  return (
    <ConfirmModal
      show={show}
      title="Undo reconciliation"
      confirmLabel="Undo"
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {UNDO_RECONCILIATION_BODY}
    </ConfirmModal>
  );
}
