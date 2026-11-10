import { QueryFailedError } from 'typeorm';
import { Account } from '../../entities/account.entity.js';
import { BillPayment } from '../../entities/bill-payment.entity.js';
import { Bill } from '../../entities/bill.entity.js';
import { DebtDetails } from '../../entities/debt-details.entity.js';
import { InvestmentDetails } from '../../entities/investment-details.entity.js';
import { ProviderExpenseDetails } from '../../entities/provider-expense-details.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';

// In-memory stand-ins for the `bank_accounts` / `bank_transactions` / `bank_debt_details` /
// `bank_investment_details` / `bank_provider_expense_details` repositories, used by the bank e2e harness (no DB in `backend_tests`). They mimic the DB rules
// the services rely on: the per-owner, case-insensitive active-name unique indexes
// (`ER_DUP_ENTRY`), the transactions' `ON DELETE RESTRICT` FK (`ER_ROW_IS_REFERENCED_2`) and the
// details tables' `ON DELETE CASCADE` FK. Reads return copies, so a failed write
// never leaves a half-mutated row behind (like a rolled-back statement). The real schema is
// covered by `bank-schema.integration-spec.ts`.

type Row = { id?: number; createdAt?: Date; updatedAt?: Date };
type Where = Record<string, unknown>;

function mysqlError(code: string): QueryFailedError {
  return new QueryFailedError('in-memory', [], Object.assign(new Error(code), { code }));
}

type Operator = { type: string; value: unknown };
const isSet = (value: unknown): boolean => value !== null && value !== undefined;
const OPERATORS: Record<string, (actual: never, value: never) => boolean> = {
  isNull: (actual) => !isSet(actual),
  in: (actual, value: unknown[]) => value.includes(actual),
  between: (actual, [low, high]: [never, never]) => isSet(actual) && actual >= low && actual <= high,
  lessThan: (actual, value) => isSet(actual) && actual < value,
};

function matches(row: object, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key];

    if (expected && typeof expected === 'object' && 'type' in expected) {
      const operator = expected as Operator;
      return OPERATORS[operator.type]?.(actual as never, operator.value as never) ?? false;
    }

    return actual === expected;
  });
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, 'en', { sensitivity: 'base' });
  }

  return Number(a) - Number(b);
}

export function createInMemoryBankRepo<T extends Row>(
  entity: new () => T,
  checkWrite: (row: T, rows: T[]) => void = () => undefined,
) {
  const rows: T[] = [];
  let nextId = 1;
  const copy = (row: T): T => Object.assign(new entity(), row);

  const repo = {
    rows,
    create: (fields: Partial<T>): T => Object.assign(new entity(), fields),
    find: async ({ where = {}, order = {} }: { where?: Where | Where[]; order?: Record<string, 'ASC' | 'DESC'> } = {}) =>
      rows
        .filter((row) => (Array.isArray(where) ? where.some((branch) => matches(row, branch)) : matches(row, where)))
        .sort((a, b) => {
          for (const [field, direction] of Object.entries(order)) {
            const diff = compare((a as never)[field], (b as never)[field]);
            if (diff !== 0) return direction === 'DESC' ? -diff : diff;
          }
          return 0;
        })
        .map(copy),
    async findAndCount(options: { where?: Where; order?: Record<string, 'ASC' | 'DESC'>; skip?: number; take?: number }) {
      const all = await repo.find(options);
      const start = options.skip ?? 0;

      return [all.slice(start, options.take === undefined ? undefined : start + options.take), all.length] as [T[], number];
    },
    findOneBy: async (where: Where): Promise<T | null> => {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? copy(row) : null;
    },
    existsBy: async (where: Where): Promise<boolean> => rows.some((row) => matches(row, where)),
    save: async (entityToSave: T): Promise<T> => {
      const now = new Date();
      const index = rows.findIndex((row) => row.id !== undefined && row.id === entityToSave.id);
      const candidate = copy({ ...entityToSave, updatedAt: now });

      if (index === -1) {
        candidate.id = nextId++;
        candidate.createdAt = now;
      }

      checkWrite(candidate, rows.filter((_row, position) => position !== index));

      if (index === -1) {
        rows.push(candidate);
      } else {
        rows[index] = candidate;
      }

      return Object.assign(entityToSave, copy(candidate));
    },
    delete: async (where: Where): Promise<{ affected: number }> => {
      const doomed = rows.filter((row) => matches(row, where));
      doomed.forEach((row) => rows.splice(rows.indexOf(row), 1));
      return { affected: doomed.length };
    },
  };

  return repo;
}

export type InMemoryBankRepo<T extends Row> = ReturnType<typeof createInMemoryBankRepo<T>>;

type DetailsRow = { accountId: number; createdAt: Date; updatedAt: Date };

// A 1:1 details table (`bank_debt_details`, `bank_investment_details`, `bank_provider_expense_details`) is keyed by `account_id`
// (no `id`): `save()` upserts on it. `find()` counts its calls so specs can assert there is no N+1.
export function createInMemoryDetailsRepo<T extends DetailsRow>(entity: new () => T) {
  const rows: T[] = [];
  const copy = (row: Partial<T>): T => Object.assign(new entity(), row);

  return {
    rows,
    findCalls: 0,
    async find({ where = {} }: { where?: Where } = {}): Promise<T[]> {
      this.findCalls += 1;
      return rows.filter((row) => matches(row, where)).map(copy);
    },
    save: async (entityToSave: Partial<T>): Promise<T> => {
      const now = new Date();
      const index = rows.findIndex((row) => row.accountId === entityToSave.accountId);
      const candidate = copy({ ...(index === -1 ? { createdAt: now } : rows[index]), ...entityToSave, updatedAt: now });

      if (index === -1) {
        rows.push(candidate);
      } else {
        rows[index] = candidate;
      }

      return copy(candidate);
    },
  };
}

export type InMemoryDetailsRepo<T extends DetailsRow> = ReturnType<typeof createInMemoryDetailsRepo<T>>;
export type InMemoryDebtDetailsRepo = InMemoryDetailsRepo<DebtDetails>;
export type InMemoryInvestmentDetailsRepo = InMemoryDetailsRepo<InvestmentDetails>;
export type InMemoryProviderExpenseDetailsRepo = InMemoryDetailsRepo<ProviderExpenseDetails>;

export interface InMemoryBankRepos {
  accounts: InMemoryBankRepo<Account>;
  transactions: InMemoryBankRepo<Transaction>;
  bills: InMemoryBankRepo<Bill>;
  billPayments: InMemoryBankRepo<BillPayment>;
  debtDetails: InMemoryDebtDetailsRepo;
  investmentDetails: InMemoryInvestmentDetailsRepo;
  providerExpenseDetails: InMemoryProviderExpenseDetailsRepo;
}

function checkActiveName(account: Account, others: Account[]): void {
  if (account.archivedAt) {
    return;
  }

  const clash = others.some((other) =>
    !other.archivedAt &&
    other.userId === account.userId &&
    other.organizationId === account.organizationId &&
    other.name.toLowerCase() === account.name.toLowerCase());

  if (clash) {
    throw mysqlError('ER_DUP_ENTRY');
  }
}

// The two unique keys of `bank_bill_payments`: `(bill_id)` for one-offs, and
// `(source_account_id, derived_due_date)` for derived occurrences (bill_id NULL).
function checkBillPaymentKeys(payment: BillPayment, others: BillPayment[]): void {
  const clash = others.some((other) =>
    payment.billId !== null && payment.billId !== undefined
      ? other.billId === payment.billId
      : (other.billId === null || other.billId === undefined) &&
        other.sourceAccountId === payment.sourceAccountId &&
        other.dueDate === payment.dueDate);

  if (clash) {
    throw mysqlError('ER_DUP_ENTRY');
  }
}

const TRANSACTION_REFS = ['paymentTransactionId', 'withdrawalTransactionId', 'chargeTransactionId'] as const;

export function createInMemoryBankRepos(): InMemoryBankRepos {
  const accounts = createInMemoryBankRepo(Account, checkActiveName);
  const transactions = createInMemoryBankRepo(Transaction);
  const createTransaction = transactions.create;
  // Like the nullable column with no default: a new transaction starts unsent.
  transactions.create = (fields: Partial<Transaction>): Transaction =>
    createTransaction({ sentToAccountantAt: null, ...fields });
  const debtDetails = createInMemoryDetailsRepo(DebtDetails);
  const investmentDetails = createInMemoryDetailsRepo(InvestmentDetails);
  const providerExpenseDetails = createInMemoryDetailsRepo(ProviderExpenseDetails);
  const bills = createInMemoryBankRepo(Bill);
  const billPayments = createInMemoryBankRepo(BillPayment, checkBillPaymentKeys);
  const deleteAccount = accounts.delete;
  const deleteBill = bills.delete;
  const deleteTransaction = transactions.delete;
  const keep = <T>(rows: T[], predicate: (row: T) => boolean): void => {
    rows.splice(0, rows.length, ...rows.filter(predicate));
  };

  // `bank_bill_payments.bill_id` is ON DELETE CASCADE.
  bills.delete = async (where: Where) => {
    const doomed = new Set(bills.rows.filter((row) => matches(row, where)).map((row) => row.id));
    const result = await deleteBill(where);
    keep(billPayments.rows, (row) => row.billId === null || row.billId === undefined || !doomed.has(row.billId));
    return result;
  };

  // The payment rows' transaction references are ON DELETE SET NULL.
  transactions.delete = async (where: Where) => {
    const doomed = new Set(transactions.rows.filter((row) => matches(row, where)).map((row) => row.id));
    const result = await deleteTransaction(where);
    for (const payment of billPayments.rows) {
      for (const ref of TRANSACTION_REFS) {
        if (payment[ref] !== null && doomed.has(payment[ref])) payment[ref] = null;
      }
    }
    return result;
  };

  accounts.delete = async (where: Where) => {
    const referenced = accounts.rows
      .filter((row) => matches(row, where))
      .some((row) => transactions.rows.some((transaction) => transaction.accountId === row.id));

    if (referenced) {
      throw mysqlError('ER_ROW_IS_REFERENCED_2');
    }

    const doomed = new Set(accounts.rows.filter((row) => matches(row, where)).map((row) => row.id));
    const result = await deleteAccount(where);
    for (const details of [debtDetails, investmentDetails, providerExpenseDetails] as Array<{ rows: DetailsRow[] }>) {
      details.rows.splice(0, details.rows.length, ...details.rows.filter((row) => !doomed.has(row.accountId)));
    }
    // Bills and payments cascade from their provider / source account; paying accounts are SET NULL.
    keep(bills.rows, (row) => !doomed.has(row.providerAccountId));
    keep(billPayments.rows, (row) => !doomed.has(row.sourceAccountId));
    for (const row of [...bills.rows, ...billPayments.rows, ...debtDetails.rows, ...providerExpenseDetails.rows]) {
      if (row.payingAccountId !== null && doomed.has(row.payingAccountId)) row.payingAccountId = null;
    }

    return result;
  };

  return { accounts, transactions, bills, billPayments, debtDetails, investmentDetails, providerExpenseDetails };
}
