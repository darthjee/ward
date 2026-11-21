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
        role: 'owner',
        refreshRole: refreshOrgs,
      });
    });

    describe('role', () => {
      const refreshOrgs = () => Promise.resolve();
      const orgRoute = { page: 'bank', context: { kind: 'organization', orgId: 5 } };
      const loadedState = (orgs) => ({
        userId: 1, orgs, orgsLoaded: true, orgsError: null,
      });

      it('is owner in personal context, even before the list loads', () => {
        const value = buildOwnerContextValue(
          { page: 'home', context: { kind: 'personal' } },
          {
            userId: null, orgs: [], orgsLoaded: false, orgsError: null,
          },
          refreshOrgs,
        );

        expect(value.role).toBe('owner');
      });

      ['user', 'admin', 'owner'].forEach((role) => {
        it(`is the org's ${role} role in an organization context`, () => {
          const value = buildOwnerContextValue(
            orgRoute,
            loadedState([{ id: 4, role: 'owner' }, { id: 5, role }]),
            refreshOrgs,
          );

          expect(value.role).toBe(role);
        });
      });

      it('matches the org id regardless of its type', () => {
        const value = buildOwnerContextValue(
          orgRoute,
          loadedState([{ id: '5', role: 'admin' }]),
          refreshOrgs,
        );

        expect(value.role).toBe('admin');
      });

      it('is null while the list is loading', () => {
        const value = buildOwnerContextValue(
          orgRoute,
          {
            userId: 1, orgs: [], orgsLoaded: false, orgsError: null,
          },
          refreshOrgs,
        );

        expect(value.role).toBeNull();
      });

      it('is null when the org is not in the list', () => {
        const value = buildOwnerContextValue(
          orgRoute,
          loadedState([{ id: 6, role: 'owner' }]),
          refreshOrgs,
        );

        expect(value.role).toBeNull();
      });

      it('exposes refreshOrgs as refreshRole', () => {
        const value = buildOwnerContextValue(orgRoute, loadedState([]), refreshOrgs);

        expect(value.refreshRole).toBe(refreshOrgs);
      });
    });
  });
});
