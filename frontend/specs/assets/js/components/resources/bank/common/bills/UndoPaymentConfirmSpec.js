import ConfirmModal from '../../../../../../../../assets/js/components/resources/bank/common/ConfirmModal.jsx';
import UndoPaymentConfirm, {
  UNDO_BODY,
  UNDO_CHARGE_WARNING,
  undoWarnsCharge,
} from '../../../../../../../../assets/js/components/resources/bank/common/bills/UndoPaymentConfirm.jsx';

describe('UndoPaymentConfirm', () => {
  const onConfirm = () => undefined;
  const onCancel = () => undefined;

  function build(props = {}) {
    return UndoPaymentConfirm({
      show: true, onConfirm, onCancel, ...props,
    });
  }

  it('wraps the shared ConfirmModal with an Undo label', () => {
    const element = build({ pending: true });

    expect(element.type).toBe(ConfirmModal);
    expect(element.props).toEqual(jasmine.objectContaining({
      show: true, title: 'Undo payment', confirmLabel: 'Undo', pending: true, onConfirm, onCancel,
    }));
  });

  it('says the transactions are deleted, without the charge warning by default', () => {
    expect(build().props.children).toBe(UNDO_BODY);
    expect(build().props.pending).toBeFalse();
    expect(UNDO_BODY).toContain('transactions');
  });

  it('adds the sent-charge warning when asked', () => {
    expect(build({ showChargeWarning: true }).props.children).toBe(`${UNDO_BODY} ${UNDO_CHARGE_WARNING}`);
    expect(UNDO_CHARGE_WARNING).toContain('accountant');
  });

  describe('undoWarnsCharge', () => {
    it('warns for a paid provider row', () => {
      expect(undoWarnsCharge({ status: 'paid', sourceType: 'provider_expense', isOneOff: false })).toBeTrue();
    });

    it('warns for a paid one-off row', () => {
      expect(undoWarnsCharge({ status: 'paid', sourceType: 'provider_expense', isOneOff: true })).toBeTrue();
      expect(undoWarnsCharge({ status: 'paid', isOneOff: true })).toBeTrue();
    });

    it('never warns for a debt row', () => {
      expect(undoWarnsCharge({ status: 'paid', sourceType: 'debt', isOneOff: false })).toBeFalse();
    });

    it('never warns for a skipped row', () => {
      expect(undoWarnsCharge({ status: 'skipped', sourceType: 'provider_expense', isOneOff: false })).toBeFalse();
      expect(undoWarnsCharge({ status: 'skipped', sourceType: 'provider_expense', isOneOff: true })).toBeFalse();
    });
  });
});
