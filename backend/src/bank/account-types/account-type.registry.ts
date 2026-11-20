import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ACCOUNT_TYPE_HANDLERS, type AccountTypeHandler } from './account-type-handler.js';
import type { Account } from '../entities/account.entity.js';

/**
 * The registered {@link AccountTypeHandler}s, keyed by `type`. A type without
 * a handler is unsupported: every route that names it answers 400.
 */
@Injectable()
export class AccountTypeRegistry {
  private readonly handlers: ReadonlyMap<string, AccountTypeHandler>;

  /**
   * @param {AccountTypeHandler[]} handlers - Every registered handler.
   */
  constructor(@Inject(ACCOUNT_TYPE_HANDLERS) handlers: AccountTypeHandler[]) {
    this.handlers = new Map(handlers.map((handler) => [handler.type, handler]));
  }

  /**
   * @param {string} type - The requested account type.
   * @returns {AccountTypeHandler} The type's handler.
   * @throws {BadRequestException} When no handler is registered for `type`.
   */
  get(type: string): AccountTypeHandler {
    const handler = this.handlers.get(type);

    if (!handler) {
      throw new BadRequestException('unsupported account type');
    }

    return handler;
  }

  /**
   * Rejects a nested object named after another registered type (e.g. a
   * `debt` object on a regular account).
   * @param {object} dto - The request body.
   * @param {string} type - The account's own type.
   * @returns {void}
   * @throws {BadRequestException} When `dto` carries another type's nested object.
   */
  assertNoForeignNested(dto: object, type: string): void {
    for (const other of this.handlers.keys()) {
      if (other !== type && (dto as Record<string, unknown>)[other] !== undefined) {
        throw new BadRequestException(`a ${other} object is only accepted on ${other} accounts`);
      }
    }
  }

  /**
   * Loads the details of accounts of any type: one `loadDetails` call per
   * type present (no N+1).
   * @param {Account[]} accounts - The accounts.
   * @param {EntityManager} manager - The entity manager to read through.
   * @returns {Promise<Map<number, unknown>>} Details keyed by account id.
   * @throws {BadRequestException} When an account's type has no handler.
   */
  async loadDetails(accounts: Account[], manager: EntityManager): Promise<Map<number, unknown>> {
    const details = new Map<number, unknown>();

    for (const [type, group] of this.#byType(accounts)) {
      const loaded = await this.get(type).loadDetails(group.map(({ id }) => id), manager);
      loaded.forEach((value, id) => details.set(id, value));
    }

    return details;
  }

  /**
   * Loads the list-only top-level fields of accounts of any type: one
   * `listExtras` call per type present that implements it (no N+1).
   * @param {Account[]} accounts - The listed accounts.
   * @returns {Promise<Map<number, Record<string, unknown>>>} Extra fields keyed by account id.
   * @throws {BadRequestException} When an account's type has no handler.
   */
  async listExtras(accounts: Account[]): Promise<Map<number, Record<string, unknown>>> {
    const extras = new Map<number, Record<string, unknown>>();

    for (const [type, group] of this.#byType(accounts)) {
      const handler = this.get(type);
      const loaded = handler.listExtras ? await handler.listExtras(group) : new Map<number, Record<string, unknown>>();
      loaded.forEach((value, id) => extras.set(id, value));
    }

    return extras;
  }

  #byType(accounts: Account[]): Map<string, Account[]> {
    const byType = new Map<string, Account[]>();

    for (const account of accounts) {
      byType.set(account.type, [...(byType.get(account.type) ?? []), account]);
    }

    return byType;
  }
}
