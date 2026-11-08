import React from 'react';
import BankMenu from '../../../../../../../assets/js/components/common/header/bankMenu/BankMenu.jsx';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

function withValue(props, value = {}) {
  return React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, userId: 1, ...value } },
    React.createElement(BankMenu, props),
  );
}

describe('BankMenu', () => {
  it('renders nothing while logged out', () => {
    expect(renderedOutput(withValue({ loggedIn: false })).isEmpty()).toBeTrue();
  });

  it('renders nothing while pending', () => {
    expect(renderedOutput(withValue({ loggedIn: true, pending: true })).isEmpty()).toBeTrue();
  });

  it('links Accounts under Personal with zero organizations', () => {
    const page = renderedOutput(withValue({ loggedIn: true }, { orgs: [] }));

    expect(page.contains('Bank')).toBeTrue();
    expect(page.contains('href="#/bank/accounts"')).toBeTrue();
    expect(page.contains('Accounts')).toBeTrue();
  });

  it('links Accounts under the active organization', () => {
    const page = renderedOutput(withValue(
      { loggedIn: true },
      { context: { kind: 'organization', orgId: 5 }, orgs: [{ id: 5, name: 'Acme' }] },
    ));

    expect(page.contains('href="#/orgs/5/bank/accounts"')).toBeTrue();
  });

  it('shows no disabled or stub entries', () => {
    const page = renderedOutput(withValue({ loggedIn: true }));

    expect(page.contains('Debts')).toBeFalse();
    expect(page.contains('Investments')).toBeFalse();
    expect(page.contains('Providers')).toBeFalse();
    expect(page.contains('Calendar')).toBeFalse();
    expect(page.contains('disabled')).toBeFalse();
  });
});
