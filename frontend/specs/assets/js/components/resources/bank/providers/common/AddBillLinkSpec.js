import React from 'react';
import AddBillLink from '../../../../../../../../assets/js/components/resources/bank/providers/common/AddBillLink.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

function output(account, context = { kind: 'personal' }) {
  return renderedOutput(React.createElement(AddBillLink, { account: { id: 4, archived_at: null, ...account }, context }));
}

describe('AddBillLink', () => {
  it('opens the new bill page with the provider pre-selected', () => {
    expect(output().containsAttribute('href', '#/bank/bills/new?provider=4')).toBeTrue();
    expect(output().contains('Add bill')).toBeTrue();
  });

  it('builds the link under an organization', () => {
    expect(output({}, { kind: 'organization', orgId: 5 }).containsAttribute('href', '#/orgs/5/bank/bills/new?provider=4'))
      .toBeTrue();
  });

  it('is hidden on an archived provider', () => {
    expect(output({ archived_at: '2026-04-01T00:00:00.000Z' }).isEmpty()).toBeTrue();
  });
});
