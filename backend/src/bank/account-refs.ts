import { In, type EntityManager } from 'typeorm';
import { Account } from './entities/account.entity.js';

/** An account as exposed inside another resource: id and name only, never owner fields. */
export type AccountRef = { id: number; name: string };

/**
 * Loads the id and name of the given accounts in one query (no N+1). The ids
 * come from rows already scoped to their owner (same-owner FKs), so no owner
 * filter applies here.
 * @param {Array<number | null>} ids - The account ids (`null`s and repeats are ignored).
 * @param {EntityManager} manager - The entity manager to read through.
 * @returns {Promise<Map<number, AccountRef>>} The refs keyed by account id.
 */
export async function accountRefsById(ids: Array<number | null>, manager: EntityManager): Promise<Map<number, AccountRef>> {
  const unique = [...new Set(ids.filter((id): id is number => id !== null))];

  if (unique.length === 0) {
    return new Map();
  }

  const accounts = await manager.getRepository(Account).find({ where: { id: In(unique) }, select: { id: true, name: true } });

  return new Map(accounts.map((account) => [account.id, { id: account.id, name: account.name }]));
}

/**
 * Attaches the default paying account's ref to each details row.
 * @param {T[]} rows - Details rows carrying a `payingAccountId`.
 * @param {EntityManager} manager - The entity manager to read through.
 * @returns {Promise<Array<T & { payingAccount: AccountRef | null }>>} The rows, each with `payingAccount`.
 */
export async function withPayingAccounts<T extends { payingAccountId: number | null }>(
  rows: T[],
  manager: EntityManager,
): Promise<Array<T & { payingAccount: AccountRef | null }>> {
  const refs = await accountRefsById(rows.map((row) => row.payingAccountId), manager);

  return rows.map((row) =>
    Object.assign(row, { payingAccount: row.payingAccountId === null ? null : refs.get(row.payingAccountId) ?? null }));
}
