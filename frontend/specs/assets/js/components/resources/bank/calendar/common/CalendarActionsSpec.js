import ConfirmModal from '../../../../../../../../assets/js/components/resources/bank/common/ConfirmModal.jsx';
import UndoPaymentConfirm from '../../../../../../../../assets/js/components/resources/bank/common/bills/UndoPaymentConfirm.jsx';
import BankErrorAlert from '../../../../../../../../assets/js/components/resources/bank/common/BankErrorAlert.jsx';
import CalendarActions from '../../../../../../../../assets/js/components/resources/bank/calendar/common/CalendarActions.jsx';
import PayDialog from '../../../../../../../../assets/js/components/resources/bank/calendar/common/PayDialog.jsx';

const noop = () => undefined;
const HANDLERS = {
  onConfirm: noop, onCancel: noop, onFieldChange: noop, onRetry: noop, onDismiss: noop,
};
const OCC = {
  kind: 'provider', currency: 'BRL', status: 'paid', source_account: { id: 1, name: 'Gym', type: 'provider_expense' },
};

function build(state) {
  const element = CalendarActions({
    state: { dialog: null, fields: {}, fieldErrors: {}, pending: false, error: null, accounts: [], ...state },
    handlers: HANDLERS,
  });
  const [alert, dialog] = element.props.children;

  return { alert, dialog: dialog.type(dialog.props) };
}

describe('CalendarActions', () => {
  it('renders nothing but the empty alert slot without a dialog', () => {
    const { alert, dialog } = build({});

    expect(alert.type).toBe(BankErrorAlert);
    expect(dialog).toBeNull();
  });

  it('shows the alert with its error', () => {
    const error = { kind: 'conflict', messages: ['Already paid'] };

    expect(build({ error }).alert.props.error).toBe(error);
  });

  it('renders the Pay dialog (the error then lives inside it)', () => {
    const { alert, dialog } = build({ dialog: { type: 'pay', occurrence: OCC } });

    expect(alert).toBeFalse();
    expect(dialog.type).toBe(PayDialog);
  });

  it('renders the Skip confirmation', () => {
    const { dialog } = build({ dialog: { type: 'skip', occurrence: OCC } });

    expect(dialog.type).toBe(ConfirmModal);
    expect(dialog.props.confirmLabel).toEqual('Skip');
  });

  it('renders the Undo confirmation with the charge warning for a paid provider', () => {
    const { dialog } = build({ dialog: { type: 'undo', occurrence: OCC } });

    expect(dialog.type).toBe(UndoPaymentConfirm);
    expect(dialog.props.showChargeWarning).toBeTrue();
  });

  it('omits the warning for a debt', () => {
    const debt = { ...OCC, kind: 'debt', source_account: { id: 1, name: 'L', type: 'debt' } };

    expect(build({ dialog: { type: 'undo', occurrence: debt } }).dialog.props.showChargeWarning).toBeFalse();
  });
});
