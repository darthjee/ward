import ConfirmModal from '../../../../../../../../assets/js/components/resources/bank/common/ConfirmModal.jsx';
import UndoReconciliationConfirm, {
  UNDO_RECONCILIATION_BODY,
} from '../../../../../../../../assets/js/components/resources/bank/common/reconciliation/UndoReconciliationConfirm.jsx';

describe('UndoReconciliationConfirm', () => {
  const onConfirm = () => undefined;
  const onCancel = () => undefined;

  it('wraps the shared ConfirmModal with an Undo label', () => {
    const element = UndoReconciliationConfirm({
      show: true, pending: true, onConfirm, onCancel,
    });

    expect(element.type).toBe(ConfirmModal);
    expect(element.props).toEqual(jasmine.objectContaining({
      show: true, title: 'Undo reconciliation', confirmLabel: 'Undo', pending: true, onConfirm, onCancel,
    }));
    expect(element.props.children).toBe(UNDO_RECONCILIATION_BODY);
  });

  it('is not pending by default', () => {
    expect(UndoReconciliationConfirm({ show: false, onConfirm, onCancel }).props.pending).toBeFalse();
  });
});
