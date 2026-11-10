import React from 'react';
import BankProviderAccountant from '../../../../../../../../assets/js/components/resources/bank/providers/pages/BankProviderAccountant.jsx';
import AccountantHandoffHelper from '../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/AccountantHandoffHelper.jsx';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { lastFullMonth } from '../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const ORG = { kind: 'organization', orgId: 5 };

function inContext(context = DEFAULT_OWNER_CONTEXT.context) {
  return () => React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1 } },
    React.createElement(BankProviderAccountant),
  );
}

function capture(Page) {
  let captured;

  spyOn(AccountantHandoffHelper, 'render').and.callFake((state, handlers) => {
    captured = { state, handlers };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('BankProviderAccountant', () => {
  it('renders the loading page in Personal with the default range', () => {
    const { from, to } = lastFullMonth();
    const page = renderedOutput(React.createElement(inContext()));

    expect(page.containsElement('h1', 'Accountant hand-off')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/providers')).toBeTrue();
    expect(page.containsAttribute('value', from)).toBeTrue();
    expect(page.containsAttribute('value', to)).toBeTrue();
    expect(page.contains('Loading')).toBeTrue();
  });

  it('renders under an organization', () => {
    const { state } = capture(inContext(ORG));

    expect(state).toEqual(jasmine.objectContaining({ context: ORG, unsentOnly: true, rangeError: null }));
  });

  it('passes the hand-off handlers', () => {
    const { handlers } = capture(inContext());

    expect(Object.keys(handlers)).toEqual(jasmine.arrayContaining(['onRangeChange', 'onDownload', 'onConfirmMarkSent']));
  });
});
