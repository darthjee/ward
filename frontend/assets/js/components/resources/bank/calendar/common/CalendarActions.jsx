import BankErrorAlert from '../../common/BankErrorAlert.jsx';
import ConfirmModal from '../../common/ConfirmModal.jsx';
import UndoPaymentConfirm, { undoWarnsCharge } from '../../common/bills/UndoPaymentConfirm.jsx';
import PayDialog from './PayDialog.jsx';

/**
 * Render the open dialog of the Calendar actions.
 *
 * @param {{state: object, handlers: object}} props - The actions state and handlers.
 * @returns {React.ReactElement|null} The Pay dialog, the Skip or Undo confirmation, or `null`.
 */
function ActiveDialog({ state, handlers }) {
  const { dialog, pending } = state;
  const common = { show: true, pending, onConfirm: handlers.onConfirm, onCancel: handlers.onCancel };

  if (!dialog) {
    return null;
  }

  if (dialog.type === 'pay') {
    return (
      <PayDialog
        {...common}
        occurrence={dialog.occurrence}
        accounts={state.accounts}
        state={state}
        onChange={handlers.onFieldChange}
      />
    );
  }

  if (dialog.type === 'skip') {
    return (
      <ConfirmModal {...common} title="Skip occurrence" confirmLabel="Skip">
        Skip this occurrence? No payment will be recorded.
      </ConfirmModal>
    );
  }

  const occ = dialog.occurrence;
  const showChargeWarning = undoWarnsCharge({
    status: occ.status, sourceType: occ.source_account.type, isOneOff: occ.kind === 'bill',
  });

  return <UndoPaymentConfirm {...common} showChargeWarning={showChargeWarning} />;
}

/**
 * The Calendar's action layer: the error alert (with Retry) and the open Pay / Skip / Undo
 * dialog.
 *
 * @param {{state: object, handlers: object}} props - The state and handlers of
 *   `useCalendarActions`.
 * @returns {React.ReactElement} The alert and the dialog.
 */
export default function CalendarActions({ state, handlers }) {
  const showAlert = !state.dialog || state.dialog.type !== 'pay';

  return (
    <>
      {showAlert && <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />}
      <ActiveDialog state={state} handlers={handlers} />
    </>
  );
}
