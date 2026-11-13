import ConfirmModal from '../ConfirmModal.jsx';

/** Body of the Undo confirmation. */
export const UNDO_BODY = 'Undo this payment? The transactions it created will be deleted.';

/** Warning added for paid provider and one-off rows (#56: undo deletes a sent charge too). */
export const UNDO_CHARGE_WARNING = 'This includes a charge already sent to the accountant.';

/**
 * Whether undoing a bill payment must warn that a charge sent to the accountant is deleted.
 *
 * @description The payment does not say whether its charge was sent, so the warning is always
 * shown for a paid provider row and a paid one-off row; never for a debt row or a skipped row
 * (which created no transactions).
 * @param {{status: string, sourceType: string, isOneOff: boolean}} row - The row's status
 *   (`paid` / `skipped`), its source account type (`debt` / `provider_expense`) and whether it
 *   is a one-off bill.
 * @returns {boolean} True when the warning is shown.
 */
export function undoWarnsCharge({ status, sourceType, isOneOff }) {
  return status === 'paid' && (Boolean(isOneOff) || sourceType === 'provider_expense');
}

/**
 * Shared confirmation of an **Undo** (bill history, calendar): it says the payment's
 * transactions are deleted and, when asked, that a charge already sent to the accountant is
 * deleted too.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.show - Whether the dialog is open.
 * @param {boolean} [props.showChargeWarning] - Whether to add the sent-charge warning.
 * @param {boolean} [props.pending] - Whether the undo is in flight.
 * @param {Function} props.onConfirm - Called on confirm.
 * @param {Function} props.onCancel - Called on cancel / close.
 * @returns {React.ReactElement} The modal.
 */
export default function UndoPaymentConfirm({
  show, showChargeWarning = false, pending = false, onConfirm, onCancel,
}) {
  return (
    <ConfirmModal
      show={show}
      title="Undo payment"
      confirmLabel="Undo"
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {showChargeWarning ? `${UNDO_BODY} ${UNDO_CHARGE_WARNING}` : UNDO_BODY}
    </ConfirmModal>
  );
}
