import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { OwnerContext } from './hooks/useOwnerContext.js';
import OrgListController, { EMPTY_ORG_STATE, buildOrgListEffect } from './controllers/OrgListController.js';
import { runEntryResolution, trackVisit } from '../../../utils/context/entryResolution.js';

/**
 * Build the provider value from the route and the org-list state.
 *
 * @param {{page: string, context: object}} route - The resolved route (the URL is the only
 *   source of the active context).
 * @param {{userId: (number|null), orgs: Array<object>, orgsLoaded: boolean,
 *   orgsError: (string|null)}} orgState - The org-list state.
 * @param {Function} refreshOrgs - Refetches the org list.
 * @returns {object} The owner-context value.
 */
export function buildOwnerContextValue(route, orgState, refreshOrgs) {
  return {
    context: route.context,
    page: route.page,
    userId: orgState.userId,
    orgs: orgState.orgs,
    orgsLoaded: orgState.orgsLoaded,
    orgsError: orgState.orgsError,
    refreshOrgs,
  };
}

/**
 * Provides the active owner context, the user id and the organization list to the page tree.
 *
 * @description Loads the org list once per session (via {@link OrgListController}), runs entry
 * resolution after each session's first load, and remembers the context of every visited
 * context-aware page.
 * @param {object} props - Component props.
 * @param {{page: string, context: object}} props.route - The resolved route.
 * @param {React.ReactNode} props.children - The page tree.
 * @returns {React.ReactElement} The provider.
 */
export default function OwnerContextProvider({ route, children }) {
  const [orgState, setOrgState] = useState(EMPTY_ORG_STATE);
  const controller = useMemo(
    () => new OrgListController(setOrgState, { onSessionLoaded: (state) => runEntryResolution(state) }),
    [],
  );
  const refreshOrgs = useCallback(() => controller.refresh(), [controller]);

  useEffect(() => buildOrgListEffect(controller)(), [controller]);
  useEffect(() => trackVisit(route, orgState.userId), [route, orgState.userId]);

  const value = useMemo(
    () => buildOwnerContextValue(route, orgState, refreshOrgs),
    [route, orgState, refreshOrgs],
  );

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}
