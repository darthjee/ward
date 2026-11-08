import React from 'react';
import ArchivedBadge from '../../../../../../../../assets/js/components/resources/bank/common/list/ArchivedBadge.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ArchivedBadge', () => {
  it('marks an archived account', () => {
    expect(renderedOutput(React.createElement(ArchivedBadge, { account: { archived_at: '2026-01-01' } }))
      .containsElement('span', 'Archived')).toBeTrue();
  });

  it('renders nothing for an active account', () => {
    expect(renderedOutput(React.createElement(ArchivedBadge, { account: { archived_at: null } })).isEmpty()).toBeTrue();
  });
});
