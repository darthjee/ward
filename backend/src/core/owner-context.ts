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

/**
 * A parameterised raw-SQL `WHERE` fragment and its bound values.
 */
export interface OwnerSqlWhere {
  sql: string;
  params: number[];
}

const SQL_ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Raw-SQL counterpart of {@link ownerWhere}, for queries that cannot go through
 * TypeORM's `where` (e.g. hand-written `query()` SQL). Both owner columns are
 * always constrained and the owner id is bound as a parameter, never inlined.
 * @param {OwnerContext} ctx - The resolved owner context.
 * @param {string} alias - The table alias owning the `user_id`/`organization_id`
 *   columns; must be a plain SQL identifier.
 * @returns {OwnerSqlWhere} `<alias>.user_id = ? AND <alias>.organization_id IS NULL`
 *   for a user owner, or the reverse for an organization owner, with its params.
 * @throws {Error} When `alias` is not a plain SQL identifier.
 */
export function ownerSqlWhere(ctx: OwnerContext, alias: string): OwnerSqlWhere {
  if (!SQL_ALIAS.test(alias)) {
    throw new Error(`Invalid SQL alias: ${JSON.stringify(alias)}`);
  }

  if (ctx.kind === 'user') {
    return { sql: `${alias}.user_id = ? AND ${alias}.organization_id IS NULL`, params: [ctx.userId] };
  }

  return { sql: `${alias}.user_id IS NULL AND ${alias}.organization_id = ?`, params: [ctx.organizationId] };
}
