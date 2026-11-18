import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type EntityManager, type Repository } from 'typeorm';
import { accountArchived } from './account-conflicts.js';
import { accountOwnerWhere } from './account-fields.js';
import { PROVIDER_TYPE } from './bill-schedule.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import { Account } from './entities/account.entity.js';
import { ProviderBill } from './entities/provider-bill.entity.js';

/** A provider bill and its (owned, active) provider-expense account. */
export interface ResolvedProviderBill {
  bill: ProviderBill;
  provider: Account;
}

/** How {@link ProviderBillResolver#provider} treats an archived account. */
export interface ProviderResolveOptions {
  /** Return an archived provider instead of answering 409 `ACCOUNT_ARCHIVED`. */
  allowArchived?: boolean;
  /** Builds the error for an unknown / foreign / non-provider account (default: the uniform 404). */
  notFound?: () => Error;
}

/**
 * Resolves provider bills and providers owner-scoped (see
 * `docs/agents/specs/split-provider/security.md`). A bill has no owner column:
 * it is reached only through an owned, non-archived `provider_expense`
 * account, so every miss answers the same uniform 404.
 */
@Injectable()
export class ProviderBillResolver {
  private readonly billRepository: Repository<ProviderBill>;
  private readonly accountRepository: Repository<Account>;

  /**
   * @param {Repository<ProviderBill>} billRepository - The bill repository.
   * @param {Repository<Account>} accountRepository - The account repository.
   */
  constructor(
    @InjectRepository(ProviderBill) billRepository: Repository<ProviderBill>,
    @InjectRepository(Account) accountRepository: Repository<Account>,
  ) {
    this.billRepository = billRepository;
    this.accountRepository = accountRepository;
  }

  /**
   * Loads a bill of any kind and its provider (owned, `provider_expense`, not archived).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @param {EntityManager} [manager] - A transactional manager: the bill row is then locked `FOR UPDATE`.
   * @returns {Promise<ResolvedProviderBill>} The bill and its provider.
   * @throws {NotFoundException} The uniform 404.
   */
  async resolve(owner: OwnerContext, id: number, manager?: EntityManager): Promise<ResolvedProviderBill> {
    const bills = manager ? manager.getRepository(ProviderBill) : this.billRepository;
    const accounts = manager ? manager.getRepository(Account) : this.accountRepository;
    const bill = manager
      ? await bills.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
      : await bills.findOneBy({ id });
    const provider = bill
      ? await accounts.findOneBy({ ...accountOwnerWhere(owner), id: bill.providerAccountId, type: PROVIDER_TYPE, archivedAt: IsNull() })
      : null;

    if (!bill || !provider) {
      throw ownerNotFound();
    }

    return { bill, provider };
  }

  /**
   * Resolves a provider account id (the nested path `:accountId`, or a move target).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {ProviderResolveOptions} [options] - Archived handling and the not-found error.
   * @param {EntityManager} [manager] - A transactional manager, when inside one.
   * @returns {Promise<Account>} The provider account.
   * @throws {Error} The uniform 404 (or `options.notFound()`) for an unknown, foreign,
   *   other-context or non-provider account.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED` for an archived account, unless allowed.
   */
  async provider(
    owner: OwnerContext,
    accountId: number,
    options: ProviderResolveOptions = {},
    manager?: EntityManager,
  ): Promise<Account> {
    const accounts = manager ? manager.getRepository(Account) : this.accountRepository;
    const account = await accounts.findOneBy({ ...accountOwnerWhere(owner), id: accountId, type: PROVIDER_TYPE });

    if (!account) {
      throw options.notFound ? options.notFound() : ownerNotFound();
    }

    if (account.archivedAt !== null && !options.allowArchived) {
      throw accountArchived();
    }

    return account;
  }
}
