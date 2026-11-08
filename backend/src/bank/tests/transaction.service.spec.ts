import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import { ownerNotFound } from '../../core/parse-id.js';
import { AccountTypeRegistry } from '../account-types/account-type.registry.js';
import { RegularAccountHandler } from '../account-types/regular-account.handler.js';
import type { CreateTransactionDto } from '../dto/create-transaction.dto.js';
import type { Account } from '../entities/account.entity.js';
import { Transaction } from '../entities/transaction.entity.js';
import type { LedgerRow } from '../ledger.query.js';
import { TransactionService } from '../transaction.service.js';
import { buildAccount, ORGANIZATION, PERSONAL } from './account.test-support.js';

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return Object.assign(new Transaction(), {
    id: 5,
    accountId: 1,
    date: '2026-01-10',
    amount: -1250n,
    description: 'Coffee',
    notes: null,
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  });
}

function row(id: number, balance: bigint): LedgerRow {
  return { id, date: '2026-01-10', amount: -100n, description: `t${id}`, notes: null, balance };
}

function setup(account: Account | null = buildAccount(), stored: Transaction | null = buildTransaction()) {
  const transactionRepository = {
    create: jest.fn((fields: Partial<Transaction>) => buildTransaction({ id: undefined, ...fields })),
    save: jest.fn(async (transaction: Transaction) => ({ ...transaction, id: transaction.id ?? 42 })),
    findOneBy: jest.fn(async () => stored),
    delete: jest.fn(async () => ({})),
  };
  const accounts = {
    findOwned: jest.fn(async () => {
      if (!account) {
        throw ownerNotFound();
      }
      return account;
    }),
  };
  const ledgerQuery = {
    count: jest.fn(async () => 0),
    page: jest.fn(async (): Promise<LedgerRow[]> => []),
    openingEffective: jest.fn(async () => 100000n),
  };
  const registry = new AccountTypeRegistry([new RegularAccountHandler()]);
  const service = new TransactionService(
    transactionRepository as never,
    accounts as never,
    registry,
    ledgerQuery as never,
  );

  return { service, transactionRepository, accounts, ledgerQuery };
}

const createDto = (fields: Partial<CreateTransactionDto> = {}): CreateTransactionDto =>
  ({ date: '2026-01-10', amount: '-12.50', description: 'Coffee', ...fields }) as CreateTransactionDto;

async function conflictCode(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return ((error as ConflictException).getResponse() as { code?: string }).code;
  }
  throw new Error('expected a rejection');
}

describe('TransactionService', () => {
  describe('create', () => {
    it('stores the amount in minor units of the account currency, through the owned account', async () => {
      const { service, transactionRepository, accounts } = setup();

      const result = await service.create(ORGANIZATION, 1, createDto());

      expect(accounts.findOwned).toHaveBeenCalledWith(ORGANIZATION, 1);
      expect(transactionRepository.create).toHaveBeenCalledWith({
        accountId: 1,
        date: '2026-01-10',
        amount: -1250n,
        description: 'Coffee',
        notes: null,
      });
      expect(result).toEqual({
        id: 42,
        date: '2026-01-10',
        amount: '-12.50',
        description: 'Coffee',
        notes: null,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it.each([
      ['zero', '0.00', 'BRL'],
      ['three decimals in BRL', '10.555', 'BRL'],
      ['decimals in JPY', '1.5', 'JPY'],
      ['four decimals in BHD', '1.2345', 'BHD'],
      ['over 10^13 minor units', '100000000000.01', 'BRL'],
    ])('rejects %s with a 400', async (_label, amount, currency) => {
      const { service } = setup(buildAccount({ currency }));

      await expect(service.create(PERSONAL, 1, createDto({ amount }))).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['500', 'JPY', '500'],
      ['-1.234', 'BHD', '-1.234'],
      ['100000000000.00', 'BRL', '100000000000.00'],
    ])('accepts %s in %s', async (amount, currency, expected) => {
      const { service } = setup(buildAccount({ currency }));

      await expect(service.create(PERSONAL, 1, createDto({ amount }))).resolves.toMatchObject({ amount: expected });
    });

    it('answers 409 on an archived account', async () => {
      const { service } = setup(buildAccount({ archivedAt: new Date() }));

      expect(await conflictCode(service.create(PERSONAL, 1, createDto()))).toBe(ErrorCodes.ACCOUNT_ARCHIVED);
    });

    it('answers 404 for an account that is not owned', async () => {
      const { service } = setup(null);

      await expect(service.create(PERSONAL, 1, createDto())).rejects.toThrow(NotFoundException);
    });

    it('answers 404 for an account type without a ledger', async () => {
      const { service } = setup();
      const handler = Object.assign(new RegularAccountHandler(), { carriesLedger: false });
      Object.assign(service, { registry: new AccountTypeRegistry([handler]) });

      await expect(service.create(PERSONAL, 1, createDto())).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('looks the transaction up within the account and edits the sent fields', async () => {
      const { service, transactionRepository } = setup();

      const result = await service.update(PERSONAL, 1, 5, { amount: '3', notes: null, description: undefined });

      expect(transactionRepository.findOneBy).toHaveBeenCalledWith({ id: 5, accountId: 1 });
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 300n, notes: null, description: 'Coffee', date: '2026-01-10' }),
      );
      expect(result.amount).toBe('3.00');
    });

    it('edits the date and description', async () => {
      const { service, transactionRepository } = setup();

      await service.update(PERSONAL, 1, 5, { date: '2026-01-01', description: 'Tea' });

      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-01-01', description: 'Tea', amount: -1250n }),
      );
    });

    it('answers 404 for a transaction of another account', async () => {
      const { service } = setup(buildAccount(), null);

      await expect(service.update(PERSONAL, 1, 5, {})).rejects.toThrow(NotFoundException);
    });

    it('rejects a zero amount', async () => {
      const { service } = setup();

      await expect(service.update(PERSONAL, 1, 5, { amount: '0' })).rejects.toThrow(BadRequestException);
    });

    it('answers 409 on an archived account', async () => {
      const { service } = setup(buildAccount({ archivedAt: new Date() }));

      expect(await conflictCode(service.update(PERSONAL, 1, 5, {}))).toBe(ErrorCodes.ACCOUNT_ARCHIVED);
    });
  });

  describe('delete', () => {
    it('hard-deletes the transaction of the account', async () => {
      const { service, transactionRepository } = setup();

      await service.delete(PERSONAL, 1, 5);

      expect(transactionRepository.delete).toHaveBeenCalledWith({ id: 5, accountId: 1 });
    });

    it('answers 404 for a transaction of another account', async () => {
      const { service, transactionRepository } = setup(buildAccount(), null);

      await expect(service.delete(PERSONAL, 1, 5)).rejects.toThrow(NotFoundException);
      expect(transactionRepository.delete).not.toHaveBeenCalled();
    });

    it('answers 409 on an archived account', async () => {
      const { service } = setup(buildAccount({ archivedAt: new Date() }));

      expect(await conflictCode(service.delete(PERSONAL, 1, 5))).toBe(ErrorCodes.ACCOUNT_ARCHIVED);
    });
  });

  describe('ledger', () => {
    it('returns an empty ledger with only the opening row on page 1', async () => {
      const { service, ledgerQuery } = setup();

      const result = await service.ledger(PERSONAL, 1, 1);

      expect(ledgerQuery.page).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 1, 50);
      expect(result).toEqual({
        transactions: [],
        opening: { date: '2026-01-01', amount: '1000.00', balance: '1000.00' },
        pagination: { page: 1, per_page: 50, total_pages: 1, total_count: 0 },
      });
    });

    it('omits the opening row before the last page', async () => {
      const { service, ledgerQuery } = setup();
      ledgerQuery.count.mockResolvedValue(120);
      ledgerQuery.page.mockResolvedValue([row(120, 5000n)]);

      const result = await service.ledger(PERSONAL, 1, 2);

      expect(ledgerQuery.page).toHaveBeenCalledWith(expect.anything(), 2, 50);
      expect(ledgerQuery.openingEffective).not.toHaveBeenCalled();
      expect(result.opening).toBeNull();
      expect(result.transactions).toEqual([
        { id: 120, date: '2026-01-10', amount: '-1.00', description: 't120', notes: null, balance: '50.00' },
      ]);
      expect(result.pagination).toEqual({ page: 2, per_page: 50, total_pages: 3, total_count: 120 });
    });

    it('adds the opening row on the last page', async () => {
      const { service, ledgerQuery } = setup();
      ledgerQuery.count.mockResolvedValue(120);
      ledgerQuery.openingEffective.mockResolvedValue(-5n);

      const result = await service.ledger(PERSONAL, 1, 3);

      expect(result.opening).toEqual({ date: '2026-01-01', amount: '-0.05', balance: '-0.05' });
    });

    it('answers an empty page past the last one, with the same metadata', async () => {
      const { service, ledgerQuery } = setup();
      ledgerQuery.count.mockResolvedValue(10);

      const result = await service.ledger(PERSONAL, 1, 4);

      expect(ledgerQuery.page).not.toHaveBeenCalled();
      expect(result).toEqual({
        transactions: [],
        opening: null,
        pagination: { page: 4, per_page: 50, total_pages: 1, total_count: 10 },
      });
    });

    it('answers 404 for an account that is not owned', async () => {
      const { service } = setup(null);

      await expect(service.ledger(PERSONAL, 1, 1)).rejects.toThrow(NotFoundException);
    });

    it('works on an archived account (read-only, still reachable)', async () => {
      const { service } = setup(buildAccount({ archivedAt: new Date() }));

      await expect(service.ledger(PERSONAL, 1, 1)).resolves.toMatchObject({ transactions: [] });
    });
  });
});
