import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { applyPayingAccount, assertMoveTarget, paidPaymentExists } from './bill-shared.js';
import type { OwnerContext } from '../core/owner-context.js';
import type { CreateProviderBillDto } from './dto/create-provider-bill.dto.js';
import type { UpdateProviderBillDto } from './dto/update-provider-bill.dto.js';
import { Account } from './entities/account.entity.js';
import { BillPayment } from './entities/bill-payment.entity.js';
import { ProviderBill } from './entities/provider-bill.entity.js';
import { todayUtc } from './ledger-date.js';
import { PayingAccountResolver } from './paying-account.resolver.js';
import { assertRecurringRoom, listProviderBills, lockProvider } from './provider-bill-checks.js';
import {
  mapProviderBillNameClash,
  providerBillKindLocked,
  providerBillPaid,
  providerBillProviderLocked,
  sameDescription,
} from './provider-bill-conflicts.js';
import { defaultProviderBillFields, mergeProviderBillFields, providerBillFieldsOf } from './provider-bill-fields.js';
import { serializeProviderBill, type ProviderBillListResponse, type ProviderBillResponse } from './provider-bill-response.js';
import { ProviderBillResolver, type ResolvedProviderBill } from './provider-bill.resolver.js';

/**
 * Provider bills of both kinds (lazy `BankModule`, see
 * `docs/agents/specs/split-provider/api/provider-bills.md`). A bill has no
 * owner column: it is reached only through an owned, active provider-expense
 * account (`ProviderBillResolver`), so every miss answers the uniform 404.
 * Every write runs in a transaction.
 */
@Injectable()
export class ProviderBillService {
  private readonly billRepository: Repository<ProviderBill>;
  private readonly resolver: ProviderBillResolver;
  private readonly payingAccounts: PayingAccountResolver;

  /**
   * @param {Repository<ProviderBill>} billRepository - The bill repository.
   * @param {ProviderBillResolver} resolver - Resolves bills and providers owner-scoped.
   * @param {PayingAccountResolver} payingAccounts - Resolves body paying accounts.
   */
  constructor(
    @InjectRepository(ProviderBill) billRepository: Repository<ProviderBill>,
      resolver: ProviderBillResolver,
      payingAccounts: PayingAccountResolver,
  ) {
    this.billRepository = billRepository;
    this.resolver = resolver;
    this.payingAccounts = payingAccounts;
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The path provider account id (archived allowed).
   * @param {string | undefined} kind - The `kind` filter.
   * @param {number} page - The 1-based page.
   * @returns {Promise<ProviderBillListResponse>} `{ provider_bills, pagination }`.
   * @throws {NotFoundException} The uniform 404.
   */
  async list(owner: OwnerContext, accountId: number, kind: string | undefined, page: number): Promise<ProviderBillListResponse> {
    const provider = await this.resolver.provider(owner, accountId, { allowArchived: true });

    return listProviderBills(this.billRepository, provider, kind, page);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id (archived providers allowed, read-only).
   * @returns {Promise<ProviderBillResponse>} The bill.
   * @throws {NotFoundException} The uniform 404.
   */
  async find(owner: OwnerContext, id: number): Promise<ProviderBillResponse> {
    const { bill, provider } = await this.resolver.resolve(owner, id, undefined, { allowArchived: true });

    return serializeProviderBill(bill, provider.currency);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The path provider account id.
   * @param {CreateProviderBillDto} dto - The validated body.
   * @returns {Promise<ProviderBillResponse>} The new bill.
   * @throws {NotFoundException} The uniform 404.
   * @throws {ConflictException} `ACCOUNT_ARCHIVED`, `PROVIDER_BILL_LIMIT`, `PROVIDER_BILL_NAME_TAKEN`.
   * @throws {BadRequestException} When the kind's field matrix or an amount is invalid.
   * @throws {UnprocessableEntityException} 422 "account not found" / "currency mismatch".
   */
  async create(owner: OwnerContext, accountId: number, dto: CreateProviderBillDto): Promise<ProviderBillResponse> {
    return this.billRepository.manager.transaction(async (manager) => {
      const provider = await this.resolver.provider(owner, accountId, {}, manager);
      const fields = mergeProviderBillFields(dto.kind, defaultProviderBillFields(dto.kind, todayUtc(new Date())), dto, provider.currency);

      if (fields.payingAccountId !== null) {
        await this.payingAccounts.resolve(owner, fields.payingAccountId, provider.currency, manager);
      }

      if (dto.kind === 'recurring') {
        await assertRecurringRoom(manager, provider.id, fields.description);
      }

      const repository = manager.getRepository(ProviderBill);
      const bill = repository.create({ ...fields, providerAccountId: provider.id, kind: dto.kind });
      const saved = await mapProviderBillNameClash(() => repository.save(bill));

      return serializeProviderBill(saved, provider.currency);
    });
  }

  /**
   * Edits a bill. A one-off may move to another provider (same currency, not
   * archived, not paid); a recurring bill cannot. `kind` cannot change.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @param {UpdateProviderBillDto} dto - The validated body.
   * @returns {Promise<ProviderBillResponse>} The updated bill.
   * @throws {NotFoundException} The uniform 404.
   * @throws {ConflictException} `KIND_LOCKED`, `PROVIDER_LOCKED`, `PAID`, `ACCOUNT_ARCHIVED`, `NAME_TAKEN`.
   * @throws {BadRequestException} When the merged state is invalid.
   * @throws {UnprocessableEntityException} 422 "account not found" / "currency mismatch".
   */
  async update(owner: OwnerContext, id: number, dto: UpdateProviderBillDto): Promise<ProviderBillResponse> {
    return this.billRepository.manager.transaction(async (manager) => {
      const { bill, provider: stored } = await this.#resolveForUpdate(owner, id, manager);

      if (dto.kind !== undefined && dto.kind !== bill.kind) {
        throw providerBillKindLocked();
      }

      const target = await this.#moveTarget(owner, bill, stored, dto, manager);
      const moved = target.id !== stored.id;
      const fields = mergeProviderBillFields(bill.kind, providerBillFieldsOf(bill), dto, target.currency);
      const renamed = bill.kind === 'recurring' && !sameDescription(bill.description, fields.description);

      Object.assign(bill, fields, { providerAccountId: target.id });
      await applyPayingAccount(this.payingAccounts, owner, bill, dto.paying_account_id, target.currency, moved, manager);

      if (renamed) {
        await assertRecurringRoom(manager, target.id, fields.description, bill.id);
      }

      const saved = await mapProviderBillNameClash(() => manager.getRepository(ProviderBill).save(bill));
      await this.#syncPayment(manager, saved);

      return serializeProviderBill(saved, target.currency);
    });
  }

  /**
   * Hard-deletes a bill; its skipped payment rows cascade, a paid one blocks.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @returns {Promise<void>}
   * @throws {NotFoundException} The uniform 404.
   * @throws {ConflictException} `PROVIDER_BILL_PAID` when a payment row is `paid`.
   */
  async delete(owner: OwnerContext, id: number): Promise<void> {
    await this.billRepository.manager.transaction(async (manager) => {
      const { bill } = await this.resolver.resolve(owner, id, manager);

      if (await paidPaymentExists(manager, bill)) {
        throw providerBillPaid();
      }

      await manager.getRepository(ProviderBill).delete({ id });
    });
  }

  /**
   * Resolves a bill for writing with the provider-first lock order (as the
   * provider write-through): ownership on an unlocked read, the provider row
   * locked for a recurring bill, then the bill re-read under its own lock.
   */
  async #resolveForUpdate(owner: OwnerContext, id: number, manager: EntityManager): Promise<ResolvedProviderBill> {
    const peeked = await this.resolver.peek(owner, id, manager);

    if (peeked.bill.kind === 'recurring') {
      await lockProvider(manager, peeked.provider.id);
    }

    return this.resolver.resolve(owner, id, manager);
  }

  /**
   * The provider a PATCH writes against: the stored one, or the resolved move
   * target (`PROVIDER_LOCKED` first, then the target's own rules).
   */
  async #moveTarget(
    owner: OwnerContext,
    bill: ProviderBill,
    stored: Account,
    dto: UpdateProviderBillDto,
    manager: EntityManager,
  ): Promise<Account> {
    if (dto.provider_account_id === undefined || dto.provider_account_id === stored.id) {
      return stored;
    }

    if (bill.kind === 'recurring') {
      throw providerBillProviderLocked();
    }

    const target = await this.resolver.provider(owner, dto.provider_account_id, { allowArchived: true }, manager);

    assertMoveTarget(stored, target);

    if (await paidPaymentExists(manager, bill)) {
      throw providerBillPaid();
    }

    return target;
  }

  /** A one-off's payment row (skipped) follows its provider and due date. */
  async #syncPayment(manager: EntityManager, bill: ProviderBill): Promise<void> {
    if (bill.kind !== 'one_off') {
      return;
    }

    const payments = manager.getRepository(BillPayment);
    const payment = await payments.findOneBy({ billId: bill.id });

    if (payment) {
      await payments.save(Object.assign(payment, { sourceAccountId: bill.providerAccountId, dueDate: bill.dueDate }));
    }
  }
}
