import React from 'react';
import BankErrorAlert from '../../../../../../../assets/js/components/resources/bank/common/BankErrorAlert.jsx';
import { classifyError } from '../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

function render(props) {
  return renderedOutput(React.createElement(BankErrorAlert, props));
}

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

describe('BankErrorAlert', () => {
  it('renders nothing without an error', () => {
    expect(render({ error: null }).isEmpty()).toBeTrue();
  });

  it('renders nothing for a notFound', () => {
    expect(render({ error: classifyError(new ApiError(404, 'Not found')) }).isEmpty()).toBeTrue();
  });

  it('renders a conflict message', () => {
    const page = render({ error: classifyError(new ApiError(409, 'Archive it instead', 'ACCOUNT_HAS_TRANSACTIONS')) });

    expect(page.contains('alert-danger')).toBeTrue();
    expect(page.contains('Archive it instead')).toBeTrue();
    expect(page.contains('Retry')).toBeFalse();
  });

  it('lists validation details', () => {
    const page = render({
      error: classifyError(new ApiError(400, 'Validation failed', 'VALIDATION_FAILED', ['a is bad', 'b is bad'])),
    });

    expect(page.containsInOrder('<li>a is bad</li>', '<li>b is bad</li>')).toBeTrue();
  });

  it('escapes messages', () => {
    const page = render({ error: classifyError(new ApiError(409, '<b>x</b>', 'X')) });

    expect(page.containsTag('b')).toBeFalse();
  });

  describe('transient errors', () => {
    const error = classifyError(new TypeError('Failed to fetch'));

    it('renders a dismissible alert with Retry', () => {
      const page = render({ error, onRetry: () => undefined, onDismiss: () => undefined });

      expect(page.contains('alert-dismissible')).toBeTrue();
      expect(page.contains('Retry')).toBeTrue();
      expect(page.contains('btn-close')).toBeTrue();
    });

    it('omits the buttons without handlers', () => {
      const page = render({ error });

      expect(page.contains('Retry')).toBeFalse();
      expect(page.contains('btn-close')).toBeFalse();
    });

    it('wires Retry and dismiss', () => {
      const onRetry = jasmine.createSpy('onRetry');
      const onDismiss = jasmine.createSpy('onDismiss');
      const element = BankErrorAlert({ error, onRetry, onDismiss });
      const clickable = findAll(element, (node) => typeof node.props?.onClick === 'function');

      clickable.forEach((node) => node.props.onClick());

      expect(onRetry).toHaveBeenCalled();
      expect(onDismiss).toHaveBeenCalled();
    });
  });
});
