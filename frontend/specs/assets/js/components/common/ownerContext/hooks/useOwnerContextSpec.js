import React from 'react';
import useOwnerContext, {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

function Probe() {
  const { context, page, orgs } = useOwnerContext();

  return React.createElement('span', null, `${context.kind}:${page}:${orgs.length}`);
}

describe('useOwnerContext', () => {
  it('returns the default value outside a provider', () => {
    expect(renderedOutput(React.createElement(Probe)).contains('personal:home:0')).toBeTrue();
  });

  it('returns the provided value', () => {
    const value = { ...DEFAULT_OWNER_CONTEXT, context: { kind: 'organization', orgId: 5 }, page: 'org-edit' };
    const element = React.createElement(OwnerContext.Provider, { value }, React.createElement(Probe));

    expect(renderedOutput(element).contains('organization:org-edit:0')).toBeTrue();
  });

  it('defaults refreshOrgs to a resolved promise', async () => {
    await expectAsync(DEFAULT_OWNER_CONTEXT.refreshOrgs()).toBeResolved();
  });
});
