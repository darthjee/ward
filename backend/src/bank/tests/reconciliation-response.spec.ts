import { Reconciliation } from '../entities/reconciliation.entity.js';
import { presentHistoryRow, presentStatement } from '../reconciliation-response.js';

const statement = (fields: Partial<Reconciliation> = {}): Reconciliation =>
  Object.assign(new Reconciliation(), {
    id: 4,
    accountId: 1,
    statementDate: '2026-02-28',
    statementBalance: 12_000n,
    reconciledAt: null,
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-02-02T00:00:00Z'),
    ...fields,
  });

describe('presentStatement', () => {
  it('presents an open statement with its live values', () => {
    expect(presentStatement(statement(), { clearedBalance: 10_000n, tickedSum: 1_500n, transactionCount: 2 }, 'BRL')).toEqual({
      id: 4,
      status: 'open',
      statement_date: '2026-02-28',
      statement_balance: '120.00',
      reconciled_at: null,
      cleared_balance: '100.00',
      ticked_sum: '15.00',
      difference: '5.00',
      transaction_count: 2,
      created_at: new Date('2026-02-01T00:00:00Z'),
      updated_at: new Date('2026-02-02T00:00:00Z'),
    });
  });

  it('presents a finished statement with a zero difference and the amount it cleared', () => {
    const finished = statement({ reconciledAt: new Date('2026-03-01T00:00:00Z') });
    const view = presentStatement(finished, { clearedBalance: null, tickedSum: 2_000n, transactionCount: 3 }, 'BRL');

    expect(view).toMatchObject({
      status: 'finished',
      reconciled_at: new Date('2026-03-01T00:00:00Z'),
      cleared_balance: '100.00',
      ticked_sum: '20.00',
      difference: '0.00',
      transaction_count: 3,
    });
  });

  it('ignores the account-wide cleared balance of a finished statement (a later statement may exist)', () => {
    const finished = statement({ reconciledAt: new Date() });

    expect(presentStatement(finished, { clearedBalance: 99_999n, tickedSum: 2_000n, transactionCount: 1 }, 'BRL'))
      .toMatchObject({ cleared_balance: '100.00', difference: '0.00' });
  });

  it('presents a zero-row statement', () => {
    const view = presentStatement(statement({ statementBalance: 10_000n }), { clearedBalance: 10_000n, tickedSum: 0n, transactionCount: 0 }, 'BRL');

    expect(view).toMatchObject({ ticked_sum: '0.00', difference: '0.00', transaction_count: 0 });
  });

  it('keeps the sign of a negative balance and computes the difference exactly', () => {
    const view = presentStatement(
      statement({ statementBalance: -250_000n }),
      { clearedBalance: -100_000n, tickedSum: -50_001n, transactionCount: 1 },
      'BRL',
    );

    expect(view).toMatchObject({
      statement_balance: '-2500.00',
      cleared_balance: '-1000.00',
      ticked_sum: '-500.01',
      difference: '-999.99',
    });
  });

  it('computes in bigint near the 10^13 bound', () => {
    const view = presentStatement(
      statement({ statementBalance: 10n ** 13n }),
      { clearedBalance: 10n ** 13n - 1n, tickedSum: 0n, transactionCount: 0 },
      'BRL',
    );

    expect(view.statement_balance).toBe('100000000000.00');
    expect(view.difference).toBe('0.01');
  });

  it('formats a zero-decimal currency', () => {
    expect(presentStatement(statement({ statementBalance: 500n }), { clearedBalance: 400n, tickedSum: 0n, transactionCount: 0 }, 'JPY'))
      .toMatchObject({ statement_balance: '500', difference: '100' });
  });

  it('carries no owner, user or member field', () => {
    const keys = Object.keys(presentStatement(statement(), { clearedBalance: 0n, tickedSum: 0n, transactionCount: 0 }, 'BRL'));

    expect(keys.filter((key) => /owner|user|member|account/.test(key))).toEqual([]);
  });
});

describe('presentHistoryRow', () => {
  it('presents an open row', () => {
    expect(presentHistoryRow(statement(), 5, false, 'BRL')).toEqual({
      id: 4,
      status: 'open',
      statement_date: '2026-02-28',
      statement_balance: '120.00',
      reconciled_at: null,
      transaction_count: 5,
      undoable: false,
    });
  });

  it('presents a finished undoable row', () => {
    const finished = statement({ reconciledAt: new Date('2026-03-01T00:00:00Z') });

    expect(presentHistoryRow(finished, 0, true, 'BRL')).toMatchObject({ status: 'finished', transaction_count: 0, undoable: true });
  });
});
