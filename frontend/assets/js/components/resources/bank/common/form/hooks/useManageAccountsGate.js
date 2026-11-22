import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';
import { ACTIONS, can } from '../../../../../../utils/permissions/orgPermissions.js';

/**
 * Gate an account form page (create / edit) on the caller's role.
 *
 * @description Reads the role from the owner context. While the role is not yet known
 * (`null`), the page is neither `forbidden` nor `allowed`, so it keeps its loading state
 * instead of flashing the permission message.
 * @returns {{forbidden: boolean, allowed: boolean}} `forbidden` when the role is known and may
 *   not manage accounts; `allowed` when the role is known and may.
 */
export default function useManageAccountsGate() {
  const { role } = useOwnerContext();
  const known = role !== null && role !== undefined;
  const allowed = can(role, ACTIONS.MANAGE_ACCOUNTS);

  return { forbidden: known && !allowed, allowed };
}
