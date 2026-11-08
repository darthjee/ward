import React from 'react';
import OwnerContextProvider, {
  buildOwnerContextValue,
} from '../../../../../../assets/js/components/common/ownerContext/OwnerContextProvider.jsx';
import useOwnerContext from '../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

function Probe() {
  const {
    context, page, userId, orgsLoaded,
  } = useOwnerContext();

  return React.createElement('span', null, `${context.kind}:${context.orgId}:${page}:${userId}:${orgsLoaded}`);
}

describe('OwnerContextProvider', () => {
  it('exposes the route context and page, with an empty org state', () => {
    const route = { page: 'org-edit', context: { kind: 'organization', orgId: 5 } };
    const element = React.createElement(OwnerContextProvider, { route }, React.createElement(Probe));

    expect(renderedOutput(element).contains('organization:5:org-edit:null:false')).toBeTrue();
  });

  describe('buildOwnerContextValue', () => {
    it('merges the route and the org-list state', () => {
      const refreshOrgs = () => Promise.resolve();
      const orgs = [{ id: 5 }];
      const value = buildOwnerContextValue(
        { page: 'home', context: { kind: 'personal' } },
        {
          userId: 1, orgs, orgsLoaded: true, orgsError: null,
        },
        refreshOrgs,
      );

      expect(value).toEqual({
        context: { kind: 'personal' },
        page: 'home',
        userId: 1,
        orgs,
        orgsLoaded: true,
        orgsError: null,
        refreshOrgs,
      });
    });
  });
});
