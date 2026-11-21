import React from 'react';
import useCan from '../../../../../../../assets/js/components/common/ownerContext/hooks/useCan.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { ACTIONS } from '../../../../../../../assets/js/utils/permissions/orgPermissions.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

function Probe({ action }) {
  return React.createElement('span', null, `can:${useCan(action)}`);
}

function renderWithRole(role, action) {
  const value = { ...DEFAULT_OWNER_CONTEXT, role };

  return renderedOutput(React.createElement(
    OwnerContext.Provider,
    { value },
    React.createElement(Probe, { action }),
  ));
}

describe('useCan', () => {
  it('allows an admin action for an admin', () => {
    expect(renderWithRole('admin', ACTIONS.DELETE).contains('can:true')).toBeTrue();
  });

  it('denies an admin action for a user', () => {
    expect(renderWithRole('user', ACTIONS.DELETE).contains('can:false')).toBeTrue();
  });

  it('allows a write action for a user', () => {
    expect(renderWithRole('user', ACTIONS.WRITE).contains('can:true')).toBeTrue();
  });

  it('denies everything outside a provider (role not yet known)', () => {
    const output = renderedOutput(React.createElement(Probe, { action: ACTIONS.WRITE }));

    expect(output.contains('can:false')).toBeTrue();
  });
});
