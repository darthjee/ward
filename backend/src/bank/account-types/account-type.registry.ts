import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ACCOUNT_TYPE_HANDLERS, type AccountTypeHandler } from './account-type-handler.js';

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
}
