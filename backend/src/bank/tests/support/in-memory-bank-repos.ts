import { QueryFailedError } from 'typeorm';
import { Account } from '../../entities/account.entity.js';
import { DebtDetails } from '../../entities/debt-details.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';

// In-memory stand-ins for the `bank_accounts` / `bank_transactions` / `bank_debt_details`
// repositories, used by the bank e2e harness (no DB in `backend_tests`). They mimic the DB rules
// the services rely on: the per-owner, case-insensitive active-name unique indexes
// (`ER_DUP_ENTRY`), the transactions' `ON DELETE RESTRICT` FK (`ER_ROW_IS_REFERENCED_2`) and the
// debt details' `ON DELETE CASCADE` FK. Reads return copies, so a failed write
// never leaves a half-mutated row behind (like a rolled-back statement). The real schema is
// covered by `bank-schema.integration-spec.ts`.

type Row = { id?: number; createdAt?: Date; updatedAt?: Date };
type Where = Record<string, unknown>;

function mysqlError(code: string): QueryFailedError {
  return new QueryFailedError('in-memory', [], Object.assign(new Error(code), { code }));
}

function matches(row: object, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key];

    if (expected && typeof expected === 'object' && 'type' in expected) {
      const operator = expected as { type: string; value: unknown };
      if (operator.type === 'isNull') return actual === null || actual === undefined;
      if (operator.type === 'in') return (operator.value as unknown[]).includes(actual);
      return false;
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
    find: async ({ where = {}, order = {} }: { where?: Where; order?: Record<string, 'ASC' | 'DESC'> } = {}) =>
      rows
        .filter((row) => matches(row, where))
        .sort((a, b) => {
          for (const [field, direction] of Object.entries(order)) {
            const diff = compare((a as never)[field], (b as never)[field]);
            if (diff !== 0) return direction === 'DESC' ? -diff : diff;
          }
          return 0;
        })
        .map(copy),
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

// `bank_debt_details` is keyed by `account_id` (no `id`): `save()` upserts on it. `find()`
// counts its calls so specs can assert there is no N+1.
export function createInMemoryDebtDetailsRepo() {
  const rows: DebtDetails[] = [];
  const copy = (row: Partial<DebtDetails>): DebtDetails => Object.assign(new DebtDetails(), row);

  return {
    rows,
    findCalls: 0,
    async find({ where = {} }: { where?: Where } = {}): Promise<DebtDetails[]> {
      this.findCalls += 1;
      return rows.filter((row) => matches(row, where)).map(copy);
    },
    save: async (entityToSave: Partial<DebtDetails>): Promise<DebtDetails> => {
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

export type InMemoryDebtDetailsRepo = ReturnType<typeof createInMemoryDebtDetailsRepo>;

export interface InMemoryBankRepos {
  accounts: InMemoryBankRepo<Account>;
  transactions: InMemoryBankRepo<Transaction>;
  debtDetails: InMemoryDebtDetailsRepo;
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

export function createInMemoryBankRepos(): InMemoryBankRepos {
  const accounts = createInMemoryBankRepo(Account, checkActiveName);
  const transactions = createInMemoryBankRepo(Transaction);
  const debtDetails = createInMemoryDebtDetailsRepo();
  const deleteAccount = accounts.delete;

  accounts.delete = async (where: Where) => {
    const referenced = accounts.rows
      .filter((row) => matches(row, where))
      .some((row) => transactions.rows.some((transaction) => transaction.accountId === row.id));

    if (referenced) {
      throw mysqlError('ER_ROW_IS_REFERENCED_2');
    }

    const doomed = new Set(accounts.rows.filter((row) => matches(row, where)).map((row) => row.id));
    const result = await deleteAccount(where);
    debtDetails.rows.splice(0, debtDetails.rows.length, ...debtDetails.rows.filter((row) => !doomed.has(row.accountId)));

    return result;
  };

  return { accounts, transactions, debtDetails };
}
