/**
 * Injection token for the Core-owned organization-membership lookup port.
 * `OwnerContextGuard` depends on it; the Auth module provides the
 * implementation (`OrganizationService`), so `core/` never imports `auth/`.
 */
export const ORGANIZATION_MEMBERSHIP_LOOKUP = Symbol('ORGANIZATION_MEMBERSHIP_LOOKUP');

/**
 * Port answering whether a user is a member of an organization. Implementations
 * run one indexed lookup on the unique `(organization_id, user_id)` key, without
 * first checking that the organization exists (identical cost either way, so
 * organizations cannot be enumerated), never cache between requests and never
 * bypass the check for Ward's global admin.
 */
export interface OrganizationMembershipLookup {
  /**
   * Checks whether `userId` is a member of organization `orgId`.
   * @param {number} userId - The authenticated user's id.
   * @param {number} orgId - The organization id, already parsed by `parseOrgId()`.
   * @returns {Promise<boolean>} Whether a membership row exists.
   */
  isMember(userId: number, orgId: number): Promise<boolean>;
}
