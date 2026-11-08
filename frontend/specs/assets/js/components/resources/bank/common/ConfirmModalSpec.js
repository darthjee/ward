import Modal from 'react-bootstrap/cjs/Modal.js';
import ConfirmModal from '../../../../../../../assets/js/components/resources/bank/common/ConfirmModal.jsx';

function findAll(node, predicate, acc = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, acc));
    return acc;
  }

  if (!node || typeof node !== 'object') {
    return acc;
  }

  if (predicate(node)) {
    acc.push(node);
  }

  return findAll(node.props?.children, predicate, acc);
}

describe('ConfirmModal', () => {
  let onConfirm;
  let onCancel;

  beforeEach(() => {
    onConfirm = jasmine.createSpy('onConfirm');
    onCancel = jasmine.createSpy('onCancel');
  });

  function build(props = {}) {
    return ConfirmModal({
      show: true, title: 'Delete?', children: 'Sure?', onConfirm, onCancel, ...props,
    });
  }

  function buttons(element) {
    return findAll(element, (node) => typeof node.props?.onClick === 'function');
  }

  it('renders a react-bootstrap Modal driven by show', () => {
    expect(build().type).toBe(Modal);
    expect(build({ show: false }).props.show).toBeFalse();
    expect(build().props.onHide).toBe(onCancel);
  });

  it('wires cancel and confirm', () => {
    const [cancel, confirm] = buttons(build());

    cancel.props.onClick();
    confirm.props.onClick();

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
    expect(confirm.props.children).toBe('Delete');
  });

  it('uses a custom confirm label', () => {
    expect(buttons(build({ confirmLabel: 'Remove' }))[1].props.children).toBe('Remove');
  });

  it('disables both buttons while pending', () => {
    buttons(build({ pending: true })).forEach((button) => {
      expect(button.props.disabled).toBeTrue();
    });
  });

  it('enables both buttons when idle', () => {
    buttons(build()).forEach((button) => {
      expect(button.props.disabled).toBeFalse();
    });
  });
});
