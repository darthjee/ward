import { buildPagination } from '../pagination.js';
import { handOffMark, serializeLedger, serializeTransaction } from '../transaction-response.js';
import { buildAccount } from './account.test-support.js';
import { Transaction } from '../entities/transaction.entity.js';

const SENT_AT = new Date('2026-11-09T12:00:00Z');
const provider = buildAccount({ type: 'provider_expense', currency: 'BRL', openingDate: '2026-10-01' });

function buildTransaction(fields: Partial<Transaction> = {}): Transaction {
  return Object.assign(new Transaction(), {
    id: 3,
    accountId: 1,
    date: '2026-01-02',
    amount: 500n,
    description: 'Sushi',
    notes: 'n',
    sentToAccountantAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(1),
    ...fields,
  });
}

describe('handOffMark', () => {
  it('is the mark on a provider-expense charge', () => {
    expect(handOffMark(provider, -1n, SENT_AT)).toEqual({ sent_to_accountant_at: SENT_AT });
    expect(handOffMark(provider, -1n, null)).toEqual({ sent_to_accountant_at: null });
    expect(handOffMark(provider, -1n, undefined)).toEqual({ sent_to_accountant_at: null });
  });

  it('is empty on a provider-expense payment', () => {
    expect(handOffMark(provider, 1n, SENT_AT)).toEqual({});
  });

  it.each(['regular', 'debt', 'investment'])('is empty on a %s account, even for a charge', (type) => {
    expect(handOffMark(buildAccount({ type }), -1n, SENT_AT)).toEqual({});
  });
});

describe('serializeTransaction', () => {
  it('returns the public fields with the amount in the currency exponent', () => {
    const transaction = buildTransaction();

    expect(serializeTransaction(transaction, buildAccount({ currency: 'JPY' }))).toEqual({
      id: 3,
      date: '2026-01-02',
      amount: '500',
      description: 'Sushi',
      notes: 'n',
      created_at: new Date(0),
      updated_at: new Date(1),
    });
  });

  it('carries sent_to_accountant_at on a provider-expense charge (sent or unsent)', () => {
    expect(serializeTransaction(buildTransaction({ amount: -500n, sentToAccountantAt: SENT_AT }), provider))
      .toMatchObject({ amount: '-5.00', sent_to_accountant_at: SENT_AT });
    expect(serializeTransaction(buildTransaction({ amount: -500n }), provider))
      .toMatchObject({ sent_to_accountant_at: null });
  });

  it('omits the key on a provider-expense payment', () => {
    expect(serializeTransaction(buildTransaction({ amount: 500n }), provider)).not.toHaveProperty('sent_to_accountant_at');
  });

  it('omits the key on a charge of another account type', () => {
    expect(serializeTransaction(buildTransaction({ amount: -500n }), buildAccount({ type: 'regular' })))
      .not.toHaveProperty('sent_to_accountant_at');
  });
});

describe('serializeLedger', () => {
  const account = buildAccount({ currency: 'BRL', openingDate: '2026-10-01' });
  const rows = [{ id: 7, date: '2026-11-01', amount: -1250n, description: 'x', notes: null, sentToAccountantAt: null, balance: 98750n }];

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

  it('marks only the charges of a provider-expense account, never the opening row', () => {
    const providerRows = [
      { id: 8, date: '2026-11-02', amount: 5000n, description: 'Payment', notes: null, sentToAccountantAt: null, balance: 1n },
      { id: 7, date: '2026-11-01', amount: -1250n, description: 'Charge', notes: null, sentToAccountantAt: SENT_AT, balance: 2n },
      { id: 6, date: '2026-10-30', amount: -100n, description: 'Charge', notes: null, sentToAccountantAt: null, balance: 3n },
    ];

    const response = serializeLedger(provider, providerRows, 0n, buildPagination(1, 50, 3));

    expect(response.transactions[0]).not.toHaveProperty('sent_to_accountant_at');
    expect(response.transactions[1]).toMatchObject({ sent_to_accountant_at: SENT_AT });
    expect(response.transactions[2]).toMatchObject({ sent_to_accountant_at: null });
    expect(response.opening).not.toHaveProperty('sent_to_accountant_at');
  });

  it('never carries the key on another account type', () => {
    const response = serializeLedger(account, [{ ...rows[0], sentToAccountantAt: SENT_AT }], 100000n, buildPagination(1, 50, 1));

    expect(response.transactions[0]).not.toHaveProperty('sent_to_accountant_at');
  });
});
