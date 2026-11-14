import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type EntityManager, type Repository } from 'typeorm';
import { accountOwnerWhere } from './account-fields.js';
import { accountRefsById } from './account-refs.js';
import { convertAmountInput, parseAmountInput } from './amount-input.js';
import { billPaid } from './bill-conflicts.js';
import { serializeBill, type BillListResponse, type BillResponse } from './bill-response.js';
import { PROVIDER_TYPE } from './bill-schedule.js';
import { accountNotFoundInBody } from './body-reference-errors.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import type { CreateBillDto } from './dto/create-bill.dto.js';
import type { UpdateBillDto } from './dto/update-bill.dto.js';
import { Account } from './entities/account.entity.js';
import { BillPayment } from './entities/bill-payment.entity.js';
import { Bill } from './entities/bill.entity.js';
import { buildPagination, LEDGER_PER_PAGE } from './pagination.js';
import { PayingAccountResolver } from './paying-account.resolver.js';

/** A one-off bill and its (owned, active) provider-expense account. */
export interface OwnedBill {
  bill: Bill;
  provider: Account;
}

/**
 * @param {string} value - The body's decimal amount.
 * @param {string} currency - The provider's currency.
 * @returns {bigint} The amount, in minor units.
 * @throws {BadRequestException} When malformed, over the bound, with too many decimals or not > 0.
 */
export function parseBillAmount(value: string, currency: string): bigint {
  const amount = parseAmountInput('amount', value, currency);

  if (amount <= 0n) {
    throw new BadRequestException('amount must be greater than zero');
  }

  return amount;
}

/**
 * One-off bills (lazy `BankModule`, see `docs/agents/modules/bank/bills.md`).
 * A bill has no owner column: it is reached only through an owned, active
 * provider-expense account, so a bill of another owner or context, or of an
 * archived provider, answers the uniform 404. Body account ids answer the
 * generic 422.
 */
@Injectable()
export class BillService {
  private readonly billRepository: Repository<Bill>;
  private readonly accountRepository: Repository<Account>;
  private readonly paymentRepository: Repository<BillPayment>;
  private readonly payingAccounts: PayingAccountResolver;

  /**
   * @param {Repository<Bill>} billRepository - The bill repository.
   * @param {Repository<Account>} accountRepository - The account repository.
   * @param {Repository<BillPayment>} paymentRepository - The bill payment repository.
   * @param {PayingAccountResolver} payingAccounts - Resolves body paying accounts.
   */
  constructor(
    @InjectRepository(Bill) billRepository: Repository<Bill>,
    @InjectRepository(Account) accountRepository: Repository<Account>,
    @InjectRepository(BillPayment) paymentRepository: Repository<BillPayment>,
      payingAccounts: PayingAccountResolver,
  ) {
    this.billRepository = billRepository;
    this.accountRepository = accountRepository;
    this.paymentRepository = paymentRepository;
    this.payingAccounts = payingAccounts;
  }

  /**
   * Lists the owner's one-off bills (of active providers), newest `due_date`
   * first, then newest id; 50 per page.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number | undefined} providerAccountId - Optional provider filter (unknown → empty list).
   * @param {number} page - The 1-based page.
   * @returns {Promise<BillListResponse>} `{ bills, pagination }`.
   */
  async list(owner: OwnerContext, providerAccountId: number | undefined, page: number): Promise<BillListResponse> {
    const providers = new Map((await this.accountRepository.find({ where: this.#providerWhere(owner) })).map((p) => [p.id, p]));
    const ids = providerAccountId === undefined ? [...providers.keys()] : [providerAccountId].filter((id) => providers.has(id));

    if (ids.length === 0) {
      return { bills: [], pagination: buildPagination(page, LEDGER_PER_PAGE, 0) };
    }

    const [bills, total] = await this.billRepository.findAndCount({
      where: { providerAccountId: In(ids) },
      order: { dueDate: 'DESC', id: 'DESC' },
      skip: (page - 1) * LEDGER_PER_PAGE,
      take: LEDGER_PER_PAGE,
    });

    return { bills: await this.#present(bills, providers), pagination: buildPagination(page, LEDGER_PER_PAGE, total) };
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @returns {Promise<BillResponse>} The bill.
   * @throws {NotFoundException} The uniform 404.
   */
  async find(owner: OwnerContext, id: number): Promise<BillResponse> {
    const { bill, provider } = await this.findOwned(owner, id);

    return (await this.#present([bill], new Map([[provider.id, provider]])))[0];
  }

  /**
   * Loads a bill whose provider is owned by `owner` and not archived.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @param {EntityManager} [manager] - A transactional manager, when inside one.
   * @returns {Promise<OwnedBill>} The bill and its provider.
   * @throws {NotFoundException} The uniform 404 (unknown, foreign, other context, archived provider).
   */
  async findOwned(owner: OwnerContext, id: number, manager?: EntityManager): Promise<OwnedBill> {
    const bills = manager ? manager.getRepository(Bill) : this.billRepository;
    const accounts = manager ? manager.getRepository(Account) : this.accountRepository;
    const bill = await bills.findOneBy({ id });
    const provider = bill ? await accounts.findOneBy({ ...this.#providerWhere(owner), id: bill.providerAccountId }) : null;

    if (!bill || !provider) {
      throw ownerNotFound();
    }

    return { bill, provider };
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {CreateBillDto} dto - The validated body.
   * @returns {Promise<BillResponse>} The new bill.
   * @throws {UnprocessableEntityException} 422 "account not found" / "currency mismatch".
   * @throws {BadRequestException} For an invalid amount in the provider's currency.
   */
  async create(owner: OwnerContext, dto: CreateBillDto): Promise<BillResponse> {
    const provider = await this.#bodyProvider(owner, dto.provider_account_id);
    await this.payingAccounts.resolve(owner, dto.paying_account_id, provider.currency);
    const bill = this.billRepository.create({
      providerAccountId: provider.id,
      payingAccountId: dto.paying_account_id,
      dueDate: dto.due_date,
      amount: parseBillAmount(dto.amount, provider.currency),
      description: dto.description,
      notes: dto.notes ?? null,
    });

    return (await this.#present([await this.billRepository.save(bill)], new Map([[provider.id, provider]])))[0];
  }

  /**
   * Edits a bill. Changing the provider re-checks the paying account's
   * currency and rescales a stored amount into the new currency; a paid bill
   * cannot change provider (409). Its payment row follows the new provider /
   * due date.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @param {UpdateBillDto} dto - The validated body.
   * @returns {Promise<BillResponse>} The updated bill.
   * @throws {NotFoundException} The uniform 404.
   * @throws {UnprocessableEntityException} 422 "account not found" / "currency mismatch".
   * @throws {ConflictException} 409 when a paid bill changes provider.
   */
  async update(owner: OwnerContext, id: number, dto: UpdateBillDto): Promise<BillResponse> {
    const { provider: stored } = await this.findOwned(owner, id);
    const moved = dto.provider_account_id !== undefined && dto.provider_account_id !== stored.id;
    const provider = moved ? await this.#bodyProvider(owner, dto.provider_account_id as number) : stored;
    const saved = await this.billRepository.manager.transaction(async (manager) => {
      const { bill, payment } = await this.#lockedBill(manager, id, stored.id);

      if (moved && payment?.status === 'paid') {
        throw billPaid();
      }

      await this.#applyPaying(owner, bill, dto.paying_account_id, provider.currency, moved, manager);
      bill.amount = dto.amount === undefined
        ? convertAmountInput('amount', bill.amount, stored.currency, provider.currency)
        : parseBillAmount(dto.amount, provider.currency);
      Object.assign(bill, { providerAccountId: provider.id }, definedFields(dto));

      const result = await manager.getRepository(Bill).save(bill);
      if (payment) {
        await manager.getRepository(BillPayment).save(Object.assign(payment, { sourceAccountId: provider.id, dueDate: bill.dueDate }));
      }
      return result;
    });

    return (await this.#present([saved], new Map([[provider.id, provider]])))[0];
  }

  /**
   * Hard-deletes an unpaid or skipped bill together with its payment row.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @returns {Promise<void>}
   * @throws {NotFoundException} The uniform 404.
   * @throws {ConflictException} 409 when the bill is paid.
   */
  async delete(owner: OwnerContext, id: number): Promise<void> {
    const { provider } = await this.findOwned(owner, id);

    await this.billRepository.manager.transaction(async (manager) => {
      const { payment } = await this.#lockedBill(manager, id, provider.id);

      if (payment?.status === 'paid') {
        throw billPaid();
      }

      await manager.getRepository(BillPayment).delete({ billId: id });
      await manager.getRepository(Bill).delete({ id });
    });
  }

  #providerWhere(owner: OwnerContext): Record<string, unknown> {
    return { ...accountOwnerWhere(owner), type: PROVIDER_TYPE, archivedAt: IsNull() };
  }

  async #bodyProvider(owner: OwnerContext, id: number): Promise<Account> {
    const provider = await this.accountRepository.findOneBy({ ...this.#providerWhere(owner), id });

    if (!provider) {
      throw accountNotFoundInBody();
    }

    return provider;
  }

  /**
   * Re-reads the bill inside the write's transaction, locked `FOR UPDATE` (the
   * lock `BillPaymentWriter` takes to pay it, so a concurrent pay serializes
   * with the edit / delete), and its payment row under that lock.
   */
  async #lockedBill(manager: EntityManager, id: number, providerAccountId: number): Promise<{ bill: Bill; payment: BillPayment | null }> {
    const bill = await manager.getRepository(Bill).findOne({ where: { id, providerAccountId }, lock: { mode: 'pessimistic_write' } });

    if (!bill) {
      throw ownerNotFound();
    }

    return { bill, payment: await manager.getRepository(BillPayment).findOneBy({ billId: id }) };
  }

  async #applyPaying(
    owner: OwnerContext,
    bill: Bill,
    sent: number | null | undefined,
    currency: string,
    moved: boolean,
    manager: EntityManager,
  ): Promise<void> {
    if (sent !== undefined) {
      bill.payingAccountId = sent;
    }

    if (bill.payingAccountId !== null && (sent !== undefined || moved)) {
      await this.payingAccounts.resolve(owner, bill.payingAccountId, currency, manager);
    }
  }

  async #present(bills: Bill[], providers: Map<number, Account>): Promise<BillResponse[]> {
    const payments = bills.length === 0
      ? []
      : await this.paymentRepository.find({ where: { billId: In(bills.map(({ id }) => id)) } });
    const refs = await accountRefsById(
      [...bills.map(({ payingAccountId }) => payingAccountId), ...payments.map(({ payingAccountId }) => payingAccountId)],
      this.accountRepository.manager,
    );
    const byBill = new Map(payments.map((payment) => [payment.billId, payment]));

    return bills.map((bill) => serializeBill(bill, providers.get(bill.providerAccountId) as Account, byBill.get(bill.id), refs));
  }
}

/**
 * @param {UpdateBillDto} dto - The validated body.
 * @returns {Partial<Bill>} The plain-copy fields that were sent.
 */
function definedFields(dto: UpdateBillDto): Partial<Bill> {
  const fields: Partial<Bill> = { dueDate: dto.due_date, description: dto.description, notes: dto.notes };

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}
