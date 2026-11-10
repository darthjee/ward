import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { accountOwnerWhere } from './account-fields.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { BILL_SOURCE_TYPES, billSourceOf, type BillSource } from './bill-schedule.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import { Account } from './entities/account.entity.js';

/**
 * Resolves a path `:accountId` into a bill source: an account of the owner
 * (archived included) of type `debt` or `provider_expense`, with its schedule.
 */
@Injectable()
export class BillSourceResolver {
  private readonly accountRepository: Repository<Account>;
  private readonly registry: AccountTypeRegistry;

  /**
   * @param {Repository<Account>} accountRepository - The account repository.
   * @param {AccountTypeRegistry} registry - Loads the account's details.
   */
  constructor(@InjectRepository(Account) accountRepository: Repository<Account>, registry: AccountTypeRegistry) {
    this.accountRepository = accountRepository;
    this.registry = registry;
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The path account id.
   * @returns {Promise<BillSource>} The account and its schedule.
   * @throws {NotFoundException} The uniform 404 (unknown, foreign, other context, not a debt / provider).
   */
  async resolve(owner: OwnerContext, accountId: number): Promise<BillSource> {
    const account = await this.accountRepository.findOneBy({ ...accountOwnerWhere(owner), id: accountId });

    if (!account || !BILL_SOURCE_TYPES.includes(account.type)) {
      throw ownerNotFound();
    }

    const details = await this.registry.loadDetails([account], this.accountRepository.manager);

    return billSourceOf(account, details.get(account.id));
  }
}
