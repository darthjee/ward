import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { BillPaymentWriter, type PaymentTarget } from '../bill-payment.writer.js';
import type { PayOccurrenceDto } from '../dto/pay-occurrence.dto.js';
import { BillPayment } from '../entities/bill-payment.entity.js';
import { Transaction } from '../entities/transaction.entity.js';
import { paymentCommand, type PaymentCommand } from '../payment-body.js';
import { paymentDescription } from '../payment-description.js';

const TARGET: PaymentTarget = { sourceAccountId: 3, billId: null, nominal: '2026-01-10', label: 'Loan' };
const PAID: PaymentCommand = { status: 'paid', paidOn: '2026-01-12', amount: 1000n, payingAccountId: 9, recordCharge: true };

// A fake transactional manager: writes are staged and only "committed" into `committed` when the
// work resolves; a write numbered `failOn` throws, as MySQL would, and nothing is committed.
function fakeDatabase(failOn?: number, error: Error = new Error('write failed')) {
  const committed: Array<{ entity: string; row: Record<string, unknown> }> = [];
  let writes = 0;
  let nextId = 100;
  const findOneBy = jest.fn(async () => null);

  const transaction = async <R>(work: (manager: unknown) => Promise<R>): Promise<R> => {
    const staged: typeof committed = [];
    const manager = {
      getRepository: (entity: unknown) => ({
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

  return { writer: new BillPaymentWriter(repository as never), committed, findOneBy };
}

describe('BillPaymentWriter', () => {
  it('writes the payment, the withdrawal, the charge and the row in one transaction', async () => {
    const { writer, committed } = fakeDatabase();

    const row = await writer.record(TARGET, PAID);

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

  it('records no charge without record_charge, and only the row for a skip', async () => {
    const paid = fakeDatabase();
    await paid.writer.record(TARGET, { ...PAID, recordCharge: false });
    expect(paid.committed.map(({ entity }) => entity)).toEqual(['transaction', 'transaction', 'payment']);

    const skipped = fakeDatabase();
    const row = await skipped.writer.record(TARGET, { status: 'skipped' });
    expect(skipped.committed.map(({ entity }) => entity)).toEqual(['payment']);
    expect(row).toMatchObject({ status: 'skipped', paidOn: null, amount: null, payingAccountId: null });
  });

  it.each([1, 2, 3, 4])('rolls everything back when write #%i fails', async (failOn) => {
    const { writer, committed } = fakeDatabase(failOn);

    await expect(writer.record(TARGET, PAID)).rejects.toThrow('write failed');

    expect(committed).toEqual([]);
  });

  it('maps a duplicate key raised inside the transaction to 409, saving nothing', async () => {
    const duplicate = new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    const { writer, committed } = fakeDatabase(4, duplicate);

    await expect(writer.record(TARGET, PAID)).rejects.toBeInstanceOf(ConflictException);
    expect(committed).toEqual([]);
  });

  it('answers 409 before writing when the occurrence already has a row', async () => {
    const { writer, committed, findOneBy } = fakeDatabase();
    findOneBy.mockResolvedValueOnce(Object.assign(new BillPayment(), { id: 1 }) as never);

    await expect(writer.record(TARGET, PAID)).rejects.toBeInstanceOf(ConflictException);
    expect(committed).toEqual([]);
  });

  it('looks a one-off payment up by bill id', async () => {
    const { writer, findOneBy } = fakeDatabase();

    await writer.find({ sourceAccountId: 3, billId: 7, nominal: '2026-01-10' });

    expect(findOneBy).toHaveBeenCalledWith({ billId: 7 });
  });

  it('undoes the linked transactions that still exist, then the row, atomically', async () => {
    const payment = Object.assign(new BillPayment(), { id: 5, paymentTransactionId: 1, withdrawalTransactionId: null, chargeTransactionId: 3 });
    const ok = fakeDatabase();
    await ok.writer.remove(payment);
    expect(ok.committed.map(({ entity }) => entity)).toEqual(['delete-transactions', 'delete-payment']);

    const failing = fakeDatabase(2);
    await expect(failing.writer.remove(payment)).rejects.toThrow('write failed');
    expect(failing.committed).toEqual([]);

    const skip = fakeDatabase();
    await skip.writer.remove(Object.assign(new BillPayment(), { id: 6, paymentTransactionId: null, withdrawalTransactionId: null, chargeTransactionId: null }));
    expect(skip.committed.map(({ entity }) => entity)).toEqual(['delete-payment']);
  });

  it('rethrows other errors untouched', async () => {
    const { writer } = fakeDatabase(1, new TypeError('boom'));

    await expect(writer.record(TARGET, PAID)).rejects.toBeInstanceOf(TypeError);
  });
});

describe('paymentCommand', () => {
  const dto = (fields: Partial<PayOccurrenceDto>) => fields as PayOccurrenceDto;

  it('normalises a paid body, defaulting record_charge to true on providers and bills only', () => {
    const body = dto({ status: 'paid', paid_on: '2026-01-12', amount: '10.5', paying_account_id: 9 });

    expect(paymentCommand(body, 'provider', 'BRL')).toEqual({ status: 'paid', paidOn: '2026-01-12', amount: 1050n, payingAccountId: 9, recordCharge: true });
    expect(paymentCommand(body, 'bill', 'BRL')).toMatchObject({ recordCharge: true });
    expect(paymentCommand({ ...body, record_charge: false }, 'bill', 'BRL')).toMatchObject({ recordCharge: false });
    expect(paymentCommand(body, 'debt', 'BRL')).toMatchObject({ recordCharge: false });
  });

  it.each([
    ['record_charge on a debt', dto({ status: 'skipped', record_charge: true }), 'debt'],
    ['a skip with an amount', dto({ status: 'skipped', amount: '1' }), 'provider'],
    ['a paid body without paid_on', dto({ status: 'paid', amount: '1', paying_account_id: 1 }), 'provider'],
    ['a zero amount', dto({ status: 'paid', paid_on: '2026-01-01', amount: '0', paying_account_id: 1 }), 'provider'],
    ['a negative amount', dto({ status: 'paid', paid_on: '2026-01-01', amount: '-1', paying_account_id: 1 }), 'provider'],
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
