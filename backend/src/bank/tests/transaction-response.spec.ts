import { buildPagination } from '../pagination.js';
import { serializeLedger, serializeTransaction } from '../transaction-response.js';
import { buildAccount } from './account.test-support.js';
import { Transaction } from '../entities/transaction.entity.js';

describe('serializeTransaction', () => {
  it('returns the public fields with the amount in the currency exponent', () => {
    const transaction = Object.assign(new Transaction(), {
      id: 3,
      accountId: 1,
      date: '2026-01-02',
      amount: 500n,
      description: 'Sushi',
      notes: 'n',
      createdAt: new Date(0),
      updatedAt: new Date(1),
    });

    expect(serializeTransaction(transaction, 'JPY')).toEqual({
      id: 3,
      date: '2026-01-02',
      amount: '500',
      description: 'Sushi',
      notes: 'n',
      created_at: new Date(0),
      updated_at: new Date(1),
    });
  });
});

describe('serializeLedger', () => {
  const account = buildAccount({ currency: 'BRL', openingDate: '2026-10-01' });
  const rows = [{ id: 7, date: '2026-11-01', amount: -1250n, description: 'x', notes: null, balance: 98750n }];

  it('builds the envelope with the opening row', () => {
    expect(serializeLedger(account, rows, 100000n, buildPagination(1, 50, 1))).toEqual({
      transactions: [{ id: 7, date: '2026-11-01', amount: '-12.50', description: 'x', notes: null, balance: '987.50' }],
      opening: { date: '2026-10-01', amount: '1000.00', balance: '1000.00' },
      pagination: { page: 1, per_page: 50, total_pages: 1, total_count: 1 },
    });
  });

  it('sets opening to null when not on the last page', () => {
    expect(serializeLedger(account, rows, null, buildPagination(1, 50, 120)).opening).toBeNull();
  });
});
