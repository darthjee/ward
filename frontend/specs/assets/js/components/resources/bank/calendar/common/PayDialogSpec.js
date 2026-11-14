import Modal from 'react-bootstrap/cjs/Modal.js';
import PayDialog from '../../../../../../../../assets/js/components/resources/bank/calendar/common/PayDialog.jsx';
import PayForm from '../../../../../../../../assets/js/components/resources/bank/calendar/common/PayForm.jsx';

describe('PayDialog', () => {
  const noop = () => undefined;
  const props = {
    show: true,
    occurrence: { kind: 'debt', currency: 'BRL' },
    accounts: [],
    state: { fields: {}, fieldErrors: {}, error: null },
    pending: false,
    onChange: noop,
    onConfirm: noop,
    onCancel: noop,
  };

  it('is a Modal driven by show, with the form', () => {
    const element = PayDialog(props);
    const body = element.props.children[1];

    expect(element.type).toBe(Modal);
    expect(element.props.show).toBeTrue();
    expect(body.props.children[1].type).toBe(PayForm);
  });

  it('disables the buttons while pending', () => {
    const footer = PayDialog({ ...props, pending: true }).props.children[2];

    expect(footer.props.children.every((button) => button.props.disabled)).toBeTrue();
  });

  it('renders nothing without an occurrence', () => {
    expect(PayDialog({ ...props, occurrence: null })).toBeNull();
  });
});
