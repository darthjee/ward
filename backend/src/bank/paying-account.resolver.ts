import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type EntityManager, type Repository } from 'typeorm';
import { accountOwnerWhere } from './account-fields.js';
import { accountNotFoundInBody, currencyMismatch } from './body-reference-errors.js';
import type { OwnerContext } from '../core/owner-context.js';
import { Account } from './entities/account.entity.js';

/** The only account type a bill can be paid from. */
export const PAYING_ACCOUNT_TYPE = 'regular';

/**
 * Resolves a paying account sent in a request body (`paying_account_id`): a
 * `regular`, non-archived account of the same owner and the required
 * currency (see `docs/agents/specs/banking/bills.md`, *Validation*).
 */
@Injectable()
export class PayingAccountResolver {
  private readonly accountRepository: Repository<Account>;

  /**
   * @param {Repository<Account>} accountRepository - The account repository.
   */
  constructor(@InjectRepository(Account) accountRepository: Repository<Account>) {
    this.accountRepository = accountRepository;
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The body's account id.
   * @param {string} currency - The currency the paying account must have.
   * @param {EntityManager} [manager] - A transactional manager, when inside one:
   *   the account row is then share-locked (`pessimistic_read`) until the
   *   transaction ends, so it cannot be archived (or deleted) under a write
   *   that relies on it.
   * @returns {Promise<Account>} The paying account.
   * @throws {UnprocessableEntityException} 422 "account not found" (unknown,
   *   another owner or context, not `regular`, archived) or "currency mismatch".
   */
  async resolve(owner: OwnerContext, id: number, currency: string, manager?: EntityManager): Promise<Account> {
    const where = { ...accountOwnerWhere(owner), id, type: PAYING_ACCOUNT_TYPE, archivedAt: IsNull() };
    const account = manager
      ? await manager.getRepository(Account).findOne({ where, lock: { mode: 'pessimistic_read' } })
      : await this.accountRepository.findOneBy(where);

    if (!account) {
      throw accountNotFoundInBody();
    }

    if (account.currency !== currency) {
      throw currencyMismatch();
    }

    return account;
  }
}
