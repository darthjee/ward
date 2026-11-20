import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { accountOwnerWhere } from './account-fields.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { billSourceOf, DEBT_TYPE, type BillSource } from './bill-schedule.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import { Account } from './entities/account.entity.js';

/**
 * Resolves a path `:accountId` of the account-level occurrence routes into a
 * bill source: a `debt` account of the owner (archived included), with its
 * schedule. Providers pay and list history per bill (`/provider-bills/:id/...`),
 * so a `provider_expense` account answers the same uniform 404 as an unknown
 * or foreign one.
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
   * @throws {NotFoundException} The uniform 404 (unknown, foreign, other context, not a debt).
   */
  async resolve(owner: OwnerContext, accountId: number): Promise<BillSource> {
    const account = await this.accountRepository.findOneBy({ ...accountOwnerWhere(owner), id: accountId });

    if (!account || account.type !== DEBT_TYPE) {
      throw ownerNotFound();
    }

    const details = await this.registry.loadDetails([account], this.accountRepository.manager);

    return billSourceOf(account, details.get(account.id));
  }
}
