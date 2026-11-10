import React from 'react';
import SentMark from '../../../../../../../../assets/js/components/resources/bank/providers/common/SentMark.jsx';
import { localToday } from '../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const SENT_AT = '2026-03-02T15:00:00.000Z';
const SENT = { id: 9, description: 'Charge', sent_to_accountant_at: SENT_AT };

describe('SentMark', () => {
  it('shows the local sent date and Mark as unsent', () => {
    const page = renderedOutput(React.createElement(SentMark, { transaction: SENT, onMarkUnsent: () => undefined }));

    expect(page.containsInOrder(`Sent ${localToday(new Date(SENT_AT))}`, 'Mark as unsent')).toBeTrue();
    expect(page.contains('disabled')).toBeFalse();
  });

  it('marks the row as unsent on click', () => {
    const onMarkUnsent = jasmine.createSpy('onMarkUnsent');
    const element = SentMark({ transaction: SENT, onMarkUnsent });

    element.props.children[1].props.onClick();

    expect(onMarkUnsent).toHaveBeenCalledWith(SENT);
  });

  it('disables the link while a Mark as unsent runs', () => {
    expect(renderedOutput(React.createElement(SentMark, { transaction: SENT, pending: true, onMarkUnsent: () => undefined }))
      .contains('disabled')).toBeTrue();
  });

  it('renders nothing for an unsent charge, a payment or the opening row', () => {
    [{ id: 1, sent_to_accountant_at: null }, { id: 2 }].forEach((transaction) => {
      expect(renderedOutput(React.createElement(SentMark, { transaction, onMarkUnsent: () => undefined })).isEmpty()).toBeTrue();
    });
  });
});
