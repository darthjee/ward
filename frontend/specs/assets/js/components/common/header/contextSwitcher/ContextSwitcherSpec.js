import React from 'react';
import ContextSwitcher from '../../../../../../../assets/js/components/common/header/contextSwitcher/ContextSwitcher.jsx';
import ContextSwitcherHelper from '../../../../../../../assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelper.jsx';
import ContextSwitcherController from '../../../../../../../assets/js/components/common/header/contextSwitcher/controllers/ContextSwitcherController.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';

const ORGS = [{ id: 5, name: 'Acme', role: 'owner' }];

function withValue(props, value = {}) {
  return React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, userId: 1, ...value } },
    React.createElement(ContextSwitcher, props),
  );
}

describe('ContextSwitcher', () => {
  it('renders nothing while logged out', () => {
    expect(renderedOutput(withValue({ loggedIn: false })).isEmpty()).toBeTrue();
  });

  it('renders nothing while pending', () => {
    expect(renderedOutput(withValue({ loggedIn: true, pending: true })).isEmpty()).toBeTrue();
  });

  it('renders the dropdown with the organizations once logged in', () => {
    const page = renderedOutput(withValue({ loggedIn: true }, { orgs: ORGS }));

    expect(page.containsInOrder('Personal', 'Acme', 'Create organization')).toBeTrue();
  });

  it('picks through the controller with the user id', () => {
    spyOn(ContextSwitcherController.prototype, 'pick');

    const handlers = renderCapturingHandlers(() => withValue({ loggedIn: true }), ContextSwitcherHelper);

    handlers.onPick({ kind: 'organization', orgId: 5 });

    expect(ContextSwitcherController.prototype.pick).toHaveBeenCalledWith({ kind: 'organization', orgId: 5 }, 1);
  });
});
