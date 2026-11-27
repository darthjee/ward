import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import BankErrorAlert from '../../../../../../../../../assets/js/components/resources/bank/common/BankErrorAlert.jsx';
import {
  RECONCILIATION_MESSAGES, classifyReconciliationError,
} from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/controllers/reconciliationErrors.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';
import React from 'react';

describe('reconciliationErrors', () => {
  it('maps the 8 codes', () => {
    expect(RECONCILIATION_MESSAGES.size).toBe(8);
  });

  [...RECONCILIATION_MESSAGES.entries()].forEach(([code, message]) => {
    it(`replaces the server message of ${code}`, () => {
      const classified = classifyReconciliationError(new ApiError(409, 'server text', code));

      expect(classified).toEqual(jasmine.objectContaining({
        kind: 'conflict', code, message, messages: [message],
      }));
    });
  });

  it('says the difference must be 0 to finish', () => {
    const classified = classifyReconciliationError(new ApiError(409, 'x', 'RECONCILIATION_UNBALANCED'));

    expect(classified.message).toBe('The difference must be 0 to finish.');
  });

  it('keeps the server message of an unmapped code', () => {
    const classified = classifyReconciliationError(new ApiError(409, 'Not finished', 'RECONCILIATION_NOT_FINISHED'));

    expect(classified.messages).toEqual(['Not finished']);
  });

  it('keeps the permission message of a 403', () => {
    const plain = classifyReconciliationError(new ApiError(403, 'no', 'FORBIDDEN'));
    const mapped = classifyReconciliationError(new ApiError(403, 'no', 'RECONCILIATION_OPEN'));

    expect(mapped.message).toBe(plain.message);
    expect(plain.kind).toBe('forbidden');
  });

  it('passes a transient error through', () => {
    expect(classifyReconciliationError(new Error('boom')).kind).toBe('transient');
  });

  it('renders the mapped message through BankErrorAlert', () => {
    const error = classifyReconciliationError(new ApiError(409, 'x', 'RECONCILIATION_UNBALANCED'));
    const page = renderedOutput(React.createElement(BankErrorAlert, { error }));

    expect(page.contains('The difference must be 0 to finish.')).toBeTrue();
  });
});
