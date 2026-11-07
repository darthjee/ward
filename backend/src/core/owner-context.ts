import { FindOperator, IsNull } from 'typeorm';

/**
 * The owner of a user-or-organization-owned request, resolved by
 * `OwnerContextGuard`: the JWT user on personal routes, or the organization
 * from `:orgId` (after the membership check) on organization routes.
 */
export type OwnerContext =
  | { kind: 'user'; userId: number }
  | { kind: 'organization'; organizationId: number };

/**
 * TypeORM `where` fragment selecting the records owned by an {@link OwnerContext}.
 */
export type OwnerWhere =
  | { userId: number; organizationId: FindOperator<unknown> }
  | { userId: FindOperator<unknown>; organizationId: number };

/**
 * Builds the owner filter every user-or-organization-owned query goes through.
 * Both columns are always constrained, so a personal query can never return
 * organization records and vice versa.
 * @param {OwnerContext} ctx - The resolved owner context.
 * @returns {OwnerWhere} `{ userId, organizationId: IsNull() }` for a user owner, or
 *   `{ userId: IsNull(), organizationId }` for an organization owner.
 */
export function ownerWhere(ctx: OwnerContext): OwnerWhere {
  if (ctx.kind === 'user') {
    return { userId: ctx.userId, organizationId: IsNull() };
  }

  return { userId: IsNull(), organizationId: ctx.organizationId };
}
