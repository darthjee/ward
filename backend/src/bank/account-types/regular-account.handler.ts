import { BadRequestException, Injectable } from '@nestjs/common';
import type { AccountTypeHandler } from './account-type-handler.js';

/**
 * Handler of `regular` accounts: an everyday bank account with a ledger and
 * no details table, so it accepts no nested object and serializes none.
 */
@Injectable()
export class RegularAccountHandler implements AccountTypeHandler {
  readonly type = 'regular';
  readonly carriesLedger = true;

  /**
   * @param {unknown} nested - Must be absent.
   * @returns {void}
   * @throws {BadRequestException} When a nested object is given.
   */
  validateCreate(nested: unknown): void {
    this.#rejectNested(nested);
  }

  /**
   * @param {unknown} nested - Must be absent.
   * @returns {void}
   * @throws {BadRequestException} When a nested object is given.
   */
  validateUpdate(nested: unknown): void {
    this.#rejectNested(nested);
  }

  /**
   * @returns {Promise<Map<number, unknown>>} Always empty: no details table.
   */
  async loadDetails(): Promise<Map<number, unknown>> {
    return new Map();
  }

  /**
   * No-op: no details table.
   * @returns {Promise<void>}
   */
  async saveDetails(): Promise<void> {}

  /**
   * @returns {undefined} Regular accounts have no nested response object.
   */
  serialize(): undefined {
    return undefined;
  }

  #rejectNested(nested: unknown): void {
    if (nested !== undefined) {
      throw new BadRequestException('regular accounts take no nested object');
    }
  }
}
