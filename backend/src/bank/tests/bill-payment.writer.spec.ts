import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import { BillPaymentWriter, type PaymentTarget } from '../bill-payment.writer.js';
import type { PayOccurrenceDto } from '../dto/pay-occurrence.dto.js';
import { Account } from '../entities/account.entity.js';
import { BillPayment } from '../entities/bill-payment.entity.js';
import { ProviderBill } from '../entities/provider-bill.entity.js';
import { Reconciliation } from '../entities/reconciliation.entity.js';
import { Transaction } from '../entities/transaction.entity.js';
import { paymentCommand, type PaymentCommand } from '../payment-body.js';
import { paymentDescription } from '../payment-description.js';
import { PERSONAL } from './account.test-support.js';
import { mysqlError } from './support/in-memory-where.js';

const TARGET: PaymentTarget = { sourceAccountId: 3, billId: null, providerBillId: null, nominal: '2026-01-10', label: 'Loan', currency: 'BRL' };
const PAID: PaymentCommand = { status: 'paid', paidOn: '2026-01-12', amount: 1000n, payingAccountId: 9, recordCharge: true };

// A fake transactional manager: writes are staged and only "committed" into `committed` when the
// work resolves; a write numbered `failOn` throws, as MySQL would, and nothing is committed.
// `lockedBill` is what the locked bill read inside the transaction finds; `resolve` stands in for
// the paying-account re-check.
function fakeDatabase(failOn?: number, error: Error = new Error('write failed')) {
  const committed: Array<{ entity: string; row: Record<string, unknown> }> = [];
  let writes = 0;
  let nextId = 100;
  const findOneBy = jest.fn(async () => null);
  const order: string[] = [];
  const findOne = jest.fn(async (options?: unknown): Promise<ProviderBill | null> => {
    const kind = (options as { where: { kind: ProviderBill['kind'] } }).where.kind;

    return Object.assign(new ProviderBill(), kind === 'recurring'
      ? { id: 7, kind, chargeFrequency: 'monthly', dueDay: 10, billsFrom: '2026-01-01', showInCalendar: true }
      : { id: 7, kind, dueDate: '2026-01-10' });
  });
  const findProvider = jest.fn(async (_options?: unknown): Promise<Account | null> => Object.assign(new Account(), { id: 3, archivedAt: null }));
  const resolve = jest.fn(async () => {
    order.push('paying');
    return {};
  });
  // The statement and row locks of an undo: no open statement and no linked row by default.
  const reconciliation = {
    openStatement: jest.fn(async (_accountId: number, _manager?: unknown): Promise<Partial<Reconciliation> | null> => null),
    lockTransactions: jest.fn(async (_manager: unknown, _accountId: number, _ids: number[]): Promise<Array<{ id: number; reconciliationId: number | null }>> => []),
  };
  const lockStatementRead = jest.fn(async (options?: unknown) => Object.assign(new Reconciliation(), { id: (options as { where: { id: number } }).where.id }));

  const transaction = async <R>(work: (manager: unknown) => Promise<R>): Promise<R> => {
    const staged: typeof committed = [];
    const manager = {
      getRepository: (entity: unknown) => ({
        findOne: (options: unknown) => {
          if (entity === ProviderBill) {
            order.push('bill');
            return findOne(options);
          }

          if (entity === Account) {
            order.push('provider');
            return findProvider(options);
          }

          if (entity === Reconciliation) {
            order.push('statement');
            return lockStatementRead(options);
          }

          return Promise.reject(new Error('unexpected read'));
        },
        create: (fields: Record<string, unknown>) => ({ ...fields }),
        save: async (row: Record<string, unknown>) => {
          writes += 1;
          if (writes === failOn) throw error;
          const saved = { ...row, id: nextId++ };
          staged.push({ entity: entity === Transaction ? 'transaction' : 'payment', row: saved });
          return saved;
        },
        delete: async (where: Record<string, unknown>) => {
          writes += 1;
          if (writes === failOn) throw error;
          staged.push({ entity: entity === Transaction ? 'delete-transactions' : 'delete-payment', row: where });
          return { affected: 1 };
        },
      }),
    };
    const result = await work(manager);
    committed.push(...staged);
    return result;
  };

  const repository = { findOneBy, manager: { transaction } };

  return { writer: new BillPaymentWriter(repository as never, { resolve } as never, reconciliation as never), committed, reconciliation, lockStatementRead, findOneBy, findOne, findProvider, resolve, order };
}

describe('BillPaymentWriter', () => {
  it('writes the payment, the withdrawal, the charge and the row in one transaction', async () => {
    const { writer, committed } = fakeDatabase();

    const row = await writer.record(PERSONAL, TARGET, PAID);

    expect(committed.map(({ entity, row: written }) => [entity, written.accountId ?? null, written.amount])).toEqual([
      ['transaction', 3, 1000n],
      ['transaction', 9, -1000n],
      ['transaction', 3, -1000n],
      ['payment', null, 1000n],
    ]);
    expect(committed.slice(0, 3).every(({ row: written }) =>
      written.date === '2026-01-12' && written.description === 'Loan — 2026-01-10' && written.sentToAccountantAt === null)).toBe(true);
    expect(row).toMatchObject({ status: 'paid', paymentTransactionId: 100, withdrawalTransactionId: 101, chargeTransactionId: 102 });
  });

  it('writes the target\'s provider bill id on the row', async () => {
    const { writer } = fakeDatabase();

    const row = await writer.record(PERSONAL, { ...TARGET, providerBillId: 7 }, { status: 'skipped' });

    expect(row).toMatchObject({ billId: null, providerBillId: 7 });
  });

  it('records no charge without record_charge, and only the row for a skip', async () => {
    const paid = fakeDatabase();
    await paid.writer.record(PERSONAL, TARGET, { ...PAID, recordCharge: false });
    expect(paid.committed.map(({ entity }) => entity)).toEqual(['transaction', 'transaction', 'payment']);

    const skipped = fakeDatabase();
    const row = await skipped.writer.record(PERSONAL, TARGET, { status: 'skipped' });
    expect(skipped.committed.map(({ entity }) => entity)).toEqual(['payment']);
    expect(row).toMatchObject({ status: 'skipped', paidOn: null, amount: null, payingAccountId: null });
  });

  it.each([1, 2, 3, 4])('rolls everything back when write #%i fails', async (failOn) => {
    const { writer, committed } = fakeDatabase(failOn);

    await expect(writer.record(PERSONAL, TARGET, PAID)).rejects.toThrow('write failed');

    expect(committed).toEqual([]);
  });

  it('maps a duplicate key raised inside the transaction to 409, saving nothing', async () => {
    const duplicate = new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    const { writer, committed } = fakeDatabase(4, duplicate);

    await expect(writer.record(PERSONAL, TARGET, PAID)).rejects.toBeInstanceOf(ConflictException);
    expect(committed).toEqual([]);
  });

  it('answers 409 before writing when the occurrence already has a row', async () => {
    const { writer, committed, findOneBy } = fakeDatabase();
    findOneBy.mockResolvedValueOnce(Object.assign(new BillPayment(), { id: 1 }) as never);

    await expect(writer.record(PERSONAL, TARGET, PAID)).rejects.toBeInstanceOf(ConflictException);
    expect(committed).toEqual([]);
  });

  it('re-validates the paying account inside the transaction, through its manager, before any write', async () => {
    const { writer, committed, resolve, findOne } = fakeDatabase();
    resolve.mockRejectedValueOnce(new UnprocessableEntityException('account not found'));

    await expect(writer.record(PERSONAL, TARGET, PAID)).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(resolve).toHaveBeenCalledWith(PERSONAL, 9, 'BRL', expect.objectContaining({ getRepository: expect.any(Function) }));
    expect(findOne).not.toHaveBeenCalled();
    expect(committed).toEqual([]);
  });

  it('skips the paying-account re-check for a skip', async () => {
    const { writer, resolve } = fakeDatabase();

    await writer.record(PERSONAL, TARGET, { status: 'skipped' });

    expect(resolve).not.toHaveBeenCalled();
  });

  it('locks a one-off bill row FOR UPDATE inside the transaction, and answers 404 when it is gone', async () => {
    const bill = { ...TARGET, billId: 7 };
    const ok = fakeDatabase();
    await ok.writer.record(PERSONAL, bill, PAID);
    expect(ok.findOne).toHaveBeenCalledWith({ where: { id: 7, providerAccountId: 3, kind: 'one_off' }, lock: { mode: 'pessimistic_write' } });

    const gone = fakeDatabase();
    gone.findOne.mockResolvedValueOnce(null);
    await expect(gone.writer.record(PERSONAL, bill, PAID)).rejects.toBeInstanceOf(NotFoundException);
    expect(gone.resolve).not.toHaveBeenCalled();
    expect(gone.committed).toEqual([]);
  });

  it('locks provider (share), then the recurring bill (FOR UPDATE), then the paying account', async () => {
    const { writer, findOne, findProvider, order } = fakeDatabase();

    await writer.record(PERSONAL, { ...TARGET, providerBillId: 7 }, PAID);

    expect(order).toEqual(['provider', 'bill', 'paying']);
    expect(findProvider).toHaveBeenCalledWith({ where: { id: 3 }, lock: { mode: 'pessimistic_read' } });
    expect(findOne).toHaveBeenCalledWith({ where: { id: 7, providerAccountId: 3, kind: 'recurring' }, lock: { mode: 'pessimistic_write' } });
  });

  it('answers 404 when the recurring bill is gone or no longer has the occurrence', async () => {
    const target = { ...TARGET, providerBillId: 7 };
    const gone = fakeDatabase();
    gone.findOne.mockResolvedValueOnce(null);
    await expect(gone.writer.record(PERSONAL, target, PAID)).rejects.toBeInstanceOf(NotFoundException);

    const moved = fakeDatabase();
    await expect(moved.writer.record(PERSONAL, { ...target, nominal: '2026-01-11' }, PAID)).rejects.toBeInstanceOf(NotFoundException);
    expect(moved.committed).toEqual([]);

    const noProvider = fakeDatabase();
    noProvider.findProvider.mockResolvedValueOnce(null);
    await expect(noProvider.writer.record(PERSONAL, target, PAID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers 404 when a one-off bill moved its due date', async () => {
    const { writer } = fakeDatabase();

    await expect(writer.record(PERSONAL, { ...TARGET, billId: 7, nominal: '2026-02-02' }, PAID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('writes two bills of one provider on the same date with distinct descriptions', async () => {
    const { writer, committed } = fakeDatabase();

    await writer.record(PERSONAL, { ...TARGET, providerBillId: 7, label: 'Plan A' }, PAID);
    await writer.record(PERSONAL, { ...TARGET, providerBillId: 8, label: 'Plan B' }, PAID);

    const descriptions = committed.filter(({ entity, row }) => entity === 'transaction' && row.accountId === 3 && (row.amount as bigint) > 0n).map(({ row }) => row.description);
    expect(descriptions).toEqual(['Plan A — 2026-01-10', 'Plan B — 2026-01-10']);
  });

  it('looks payments up per provider bill, per one-off bill, or per debt occurrence', async () => {
    const { writer, findOneBy } = fakeDatabase();

    await writer.find({ sourceAccountId: 3, billId: null, providerBillId: 7, nominal: '2026-01-10' });
    await writer.find({ sourceAccountId: 3, billId: null, providerBillId: null, nominal: '2026-01-10' });

    expect(findOneBy).toHaveBeenNthCalledWith(1, { providerBillId: 7, dueDate: '2026-01-10' });
    expect(findOneBy).toHaveBeenNthCalledWith(2, expect.objectContaining({ sourceAccountId: 3, dueDate: '2026-01-10' }));
  });

  it('looks a one-off payment up by bill id', async () => {
    const { writer, findOneBy } = fakeDatabase();

    await writer.find({ sourceAccountId: 3, billId: 7, providerBillId: null, nominal: '2026-01-10' });

    expect(findOneBy).toHaveBeenCalledWith({ billId: 7 });
  });

  it('undoes the linked transactions that still exist, then the row, atomically', async () => {
    const payment = Object.assign(new BillPayment(), {
      id: 5, sourceAccountId: 3, status: 'paid', payingAccountId: null, paymentTransactionId: 1, withdrawalTransactionId: null, chargeTransactionId: 3,
    });
    const ok = fakeDatabase();
    await ok.writer.remove(payment);
    expect(ok.committed.map(({ entity }) => entity)).toEqual(['delete-transactions', 'delete-payment']);

    const failing = fakeDatabase(2);
    await expect(failing.writer.remove(payment)).rejects.toThrow('write failed');
    expect(failing.committed).toEqual([]);

    const skip = fakeDatabase();
    await skip.writer.remove(Object.assign(new BillPayment(), {
      id: 6, sourceAccountId: 3, status: 'skipped', paymentTransactionId: null, withdrawalTransactionId: null, chargeTransactionId: null,
    }));
    expect(skip.committed.map(({ entity }) => entity)).toEqual(['delete-payment']);
    expect(skip.reconciliation.lockTransactions).not.toHaveBeenCalled();
  });

  describe('undo under the reconciliation locks', () => {
    // Source 9 and paying 3 (reversed on purpose): every lock must still go in ascending id order.
    const paid = () => Object.assign(new BillPayment(), {
      id: 5, sourceAccountId: 9, status: 'paid', payingAccountId: 3, paymentTransactionId: 11, withdrawalTransactionId: 10, chargeTransactionId: 12,
    });
    const codeOf = async (promise: Promise<unknown>): Promise<unknown> => {
      try {
        await promise;
      } catch (error) {
        return (error as ConflictException).getResponse();
      }
      throw new Error('expected a rejection');
    };

    it('locks the accounts, then the open statements, then the rows, each in ascending id order', async () => {
      const { writer, findProvider, reconciliation, lockStatementRead, order } = fakeDatabase();
      reconciliation.openStatement.mockImplementation(async (accountId: number) => ({ id: accountId * 10 }));

      await writer.remove(paid());

      expect(findProvider.mock.calls.map(([options]) => (options as { where: { id: number }; lock: { mode: string } }))).toEqual([
        { where: { id: 3 }, lock: { mode: 'pessimistic_write' } },
        { where: { id: 9 }, lock: { mode: 'pessimistic_write' } },
      ]);
      expect(reconciliation.openStatement.mock.calls.map(([accountId]) => accountId)).toEqual([3, 9]);
      expect(lockStatementRead.mock.calls.map(([options]) => (options as { where: { id: number } }).where.id)).toEqual([30, 90]);
      expect(reconciliation.lockTransactions.mock.calls.map(([, accountId, ids]) => [accountId, ids])).toEqual([[3, [10]], [9, [11, 12]]]);
      expect(order).toEqual(['provider', 'provider', 'statement', 'statement']);
    });

    it('locks a single account once when the paying account is the source', async () => {
      const { writer, findProvider } = fakeDatabase();

      await writer.remove(Object.assign(paid(), { payingAccountId: 9 }));

      expect(findProvider).toHaveBeenCalledTimes(1);
    });

    it('answers TRANSACTION_CLEARED and deletes nothing when any linked row is cleared', async () => {
      const { writer, reconciliation, committed } = fakeDatabase();
      reconciliation.openStatement.mockResolvedValue({ id: 20 });
      reconciliation.lockTransactions.mockImplementation(async (_manager, accountId) =>
        accountId === 9 ? [{ id: 11, reconciliationId: 20 }, { id: 12, reconciliationId: 7 }] : []);

      expect(await codeOf(writer.remove(paid()))).toMatchObject({ code: ErrorCodes.TRANSACTION_CLEARED });
      expect(committed).toEqual([]);
    });

    it('treats a link to a statement when the account has no open one as cleared', async () => {
      const { writer, reconciliation } = fakeDatabase();
      reconciliation.lockTransactions.mockResolvedValue([{ id: 10, reconciliationId: 7 }]);

      expect(await codeOf(writer.remove(paid()))).toMatchObject({ code: ErrorCodes.TRANSACTION_CLEARED });
    });

    it('deletes ticked rows, uncleared rows and rows that no longer exist', async () => {
      const { writer, reconciliation, committed } = fakeDatabase();
      reconciliation.openStatement.mockResolvedValue({ id: 20 });
      reconciliation.lockTransactions.mockResolvedValue([{ id: 10, reconciliationId: 20 }, { id: 11, reconciliationId: null }]);

      await writer.remove(paid());

      expect(committed.map(({ entity }) => entity)).toEqual(['delete-transactions', 'delete-payment']);
    });

    it('re-checks the archived rule on the locked accounts, deleting nothing', async () => {
      const { writer, findProvider, committed } = fakeDatabase();
      findProvider.mockImplementation(async (options?: unknown) =>
        Object.assign(new Account(), { id: (options as { where: { id: number } }).where.id, archivedAt: (options as { where: { id: number } }).where.id === 3 ? new Date() : null }));

      expect(await codeOf(writer.remove(paid()))).toMatchObject({ code: ErrorCodes.ACCOUNT_ARCHIVED });
      expect(committed).toEqual([]);
    });

    it('answers 404 when the source account is gone', async () => {
      const { writer, findProvider } = fakeDatabase();
      findProvider.mockResolvedValue(null);

      await expect(writer.remove(paid())).rejects.toThrow(NotFoundException);
    });

    it.each(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'])('maps %s to CONCURRENT_UPDATE', async (code) => {
      const { writer } = fakeDatabase(1, mysqlError(code));

      expect(await codeOf(writer.remove(paid()))).toMatchObject({ code: ErrorCodes.CONCURRENT_UPDATE });
    });
  });

  it('rethrows other errors untouched', async () => {
    const { writer } = fakeDatabase(1, new TypeError('boom'));

    await expect(writer.record(PERSONAL, TARGET, PAID)).rejects.toBeInstanceOf(TypeError);
  });
});

describe('paymentCommand', () => {
  const dto = (fields: Partial<PayOccurrenceDto>) => fields as PayOccurrenceDto;

  it('normalises a paid body, defaulting record_charge to true on providers and bills only', () => {
    const body = dto({ status: 'paid', paid_on: '2026-01-12', amount: '10.5', paying_account_id: 9 });

    expect(paymentCommand(body, 'provider_bill', 'BRL')).toEqual({ status: 'paid', paidOn: '2026-01-12', amount: 1050n, payingAccountId: 9, recordCharge: true });
    expect(paymentCommand(body, 'bill', 'BRL')).toMatchObject({ recordCharge: true });
    expect(paymentCommand({ ...body, record_charge: false }, 'bill', 'BRL')).toMatchObject({ recordCharge: false });
    expect(paymentCommand(body, 'debt', 'BRL')).toMatchObject({ recordCharge: false });
  });

  it.each([
    ['record_charge on a debt', dto({ status: 'skipped', record_charge: true }), 'debt'],
    ['a skip with an amount', dto({ status: 'skipped', amount: '1' }), 'provider_bill'],
    ['a paid body without paid_on', dto({ status: 'paid', amount: '1', paying_account_id: 1 }), 'provider_bill'],
    ['a zero amount', dto({ status: 'paid', paid_on: '2026-01-01', amount: '0', paying_account_id: 1 }), 'provider_bill'],
    ['a negative amount', dto({ status: 'paid', paid_on: '2026-01-01', amount: '-1', paying_account_id: 1 }), 'provider_bill'],
  ] as const)('answers 400 for %s', (_label, body, kind) => {
    expect(() => paymentCommand(body, kind, 'BRL')).toThrow(BadRequestException);
  });

  it('accepts a bare skip', () => {
    expect(paymentCommand(dto({ status: 'skipped' }), 'debt', 'BRL')).toEqual({ status: 'skipped' });
  });
});

describe('paymentDescription', () => {
  it('joins the label and the nominal date', () => {
    expect(paymentDescription('Car loan', '2026-01-10')).toBe('Car loan — 2026-01-10');
  });

  it('truncates the label by code points so the whole text fits 255 and keeps the date', () => {
    const description = paymentDescription('😀'.repeat(300), '2026-01-10');

    expect([...description]).toHaveLength(255);
    expect(description.endsWith('😀 — 2026-01-10')).toBe(true);
  });
});
