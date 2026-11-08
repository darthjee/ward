import { QueryFailedError } from 'typeorm';
import { Account } from '../../entities/account.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';

// In-memory stand-ins for the `bank_accounts` / `bank_transactions` repositories, used by the
// bank e2e harness (no DB in `backend_tests`). They mimic the DB rules the services rely on:
// the per-owner, case-insensitive active-name unique indexes (`ER_DUP_ENTRY`) and the
// `ON DELETE RESTRICT` FK (`ER_ROW_IS_REFERENCED_2`). Reads return copies, so a failed write
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
      return (expected as { type: string }).type === 'isNull' ? actual === null || actual === undefined : false;
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

export interface InMemoryBankRepos {
  accounts: InMemoryBankRepo<Account>;
  transactions: InMemoryBankRepo<Transaction>;
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
  const deleteAccount = accounts.delete;

  accounts.delete = async (where: Where) => {
    const referenced = accounts.rows
      .filter((row) => matches(row, where))
      .some((row) => transactions.rows.some((transaction) => transaction.accountId === row.id));

    if (referenced) {
      throw mysqlError('ER_ROW_IS_REFERENCED_2');
    }

    return deleteAccount(where);
  };

  return { accounts, transactions };
}
