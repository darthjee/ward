import type { DataSource, EntityManager, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { AccountantChargesQuery, PREVIEW_MAX_ROWS } from '../../../bank/accountant-charges.query.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { Transaction } from '../../../bank/entities/transaction.entity.js';
import type { OwnerContext } from '../../../core/owner-context.js';

const ALICE: OwnerContext = { kind: 'user', userId: 1 };
const BOB: OwnerContext = { kind: 'user', userId: 2 };
const ALICE_ORG: OwnerContext = { kind: 'organization', organizationId: 1 };

interface AccountFields {
  owner?: OwnerContext;
  type?: string;
  forAccountant?: boolean | null;
  archived?: boolean;
  openingDate?: string;
  currency?: string;
}

describe('accountant hand-off SQL (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let transactions: Repository<Transaction>;
  let query: AccountantChargesQuery;

  async function insertAccount(fields: AccountFields = {}): Promise<number> {
    const owner = fields.owner ?? ALICE;
    const account = await accounts.save(accounts.create({
      userId: owner.kind === 'user' ? owner.userId : null,
      organizationId: owner.kind === 'organization' ? owner.organizationId : null,
      type: fields.type ?? 'provider_expense',
      name: `Provider ${Math.random()}`,
      bankName: 'Vivo',
      currency: fields.currency ?? 'BRL',
      openingDate: fields.openingDate ?? '2026-01-01',
      openingBalance: 0n,
      archivedAt: fields.archived ? new Date() : null,
    }));
    const forAccountant = fields.forAccountant === undefined ? true : fields.forAccountant;
    if (forAccountant !== null) {
      await ds.query(
        'INSERT INTO bank_provider_expense_details (account_id, for_accountant, provider_tax_id) VALUES (?, ?, ?)',
        [account.id, forAccountant ? 1 : 0, '02.558.157/0001-62'],
      );
    }
    return account.id;
  }

  async function insertTransaction(accountId: number, date: string, amount: bigint, sentAt: Date | null = null): Promise<number> {
    const saved = await transactions.save(transactions.create({
      accountId,
      date,
      amount,
      description: `${date} ${amount}`,
      sentToAccountantAt: sentAt,
    }));
    return saved.id;
  }

  async function sentAtOf(id: number): Promise<Date | null> {
    return (await transactions.findOneByOrFail({ id })).sentToAccountantAt;
  }

  beforeAll(async () => {
    ds = await createTestDataSource();
    accounts = ds.getRepository(Account);
    transactions = ds.getRepository(Transaction);
    query = new AccountantChargesQuery(transactions);
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  describe('preview', () => {
    it('returns only the owner\'s for_accountant provider charges in the range, by date then id', async () => {
      const flagged = await insertAccount({ openingDate: '2026-10-20' });
      const archived = await insertAccount({ archived: true });
      const unflagged = await insertAccount({ forAccountant: false });
      const regular = await insertAccount({ type: 'regular', forAccountant: null });
      const bobs = await insertAccount({ owner: BOB });
      const orgs = await insertAccount({ owner: ALICE_ORG });

      const late = await insertTransaction(flagged, '2026-10-31', -3n);
      const first = await insertTransaction(flagged, '2026-10-01', -1n);
      const second = await insertTransaction(archived, '2026-10-01', -2n);
      await insertTransaction(flagged, '2026-10-02', 5n);
      await insertTransaction(flagged, '2026-09-30', -1n);
      await insertTransaction(flagged, '2026-11-01', -1n);
      await insertTransaction(unflagged, '2026-10-03', -1n);
      await insertTransaction(regular, '2026-10-03', -1n);
      await insertTransaction(bobs, '2026-10-03', -1n);
      const orgCharge = await insertTransaction(orgs, '2026-10-03', -1n);

      const rows = await query.preview(ALICE, '2026-10-01', '2026-10-31', false);

      expect(rows.map((row) => row.id)).toEqual([first, second, late]);
      expect(rows[0]).toEqual({
        id: first,
        date: '2026-10-01',
        description: '2026-10-01 -1',
        amount: -1n,
        sentToAccountantAt: null,
        accountId: flagged,
        accountName: expect.stringMatching(/^Provider /),
        bankName: 'Vivo',
        providerTaxId: '02.558.157/0001-62',
        currency: 'BRL',
      });
      expect((await query.preview(ALICE_ORG, '2026-10-01', '2026-10-31', false)).map((row) => row.id)).toEqual([orgCharge]);
    });

    it('hides sent charges unless includeSent, mapping the mark as a Date', async () => {
      const account = await insertAccount();
      const sent = await insertTransaction(account, '2026-10-01', -1n, new Date('2026-10-10T10:00:00Z'));
      const unsent = await insertTransaction(account, '2026-10-02', -1n);

      expect((await query.preview(ALICE, '2026-10-01', '2026-10-31', false)).map((row) => row.id)).toEqual([unsent]);
      const all = await query.preview(ALICE, '2026-10-01', '2026-10-31', true);
      expect(all.map((row) => row.id)).toEqual([sent, unsent]);
      expect(all[0].sentToAccountantAt).toBeInstanceOf(Date);
    });

    it(`reads at most ${PREVIEW_MAX_ROWS + 1} rows`, async () => {
      const account = await insertAccount();
      const values = Array.from({ length: PREVIEW_MAX_ROWS + 5 }, () => '(?, \'2026-10-05\', -1, \'Bulk\')').join(', ');
      await ds.query(
        `INSERT INTO bank_transactions (account_id, date, amount, description) VALUES ${values}`,
        Array.from({ length: PREVIEW_MAX_ROWS + 5 }, () => account),
      );

      expect(await query.preview(ALICE, '2026-10-01', '2026-10-31', false)).toHaveLength(PREVIEW_MAX_ROWS + 1);
    });
  });

  describe('resolveForUpdate', () => {
    it('resolves only the owner\'s ids, with the type and flag (null for other types)', async () => {
      const provider = await insertAccount();
      const unflagged = await insertAccount({ forAccountant: false });
      const regular = await insertAccount({ type: 'regular', forAccountant: null });
      const bobs = await insertAccount({ owner: BOB });
      const charge = await insertTransaction(provider, '2026-10-01', -1n);
      const off = await insertTransaction(unflagged, '2026-10-01', -2n);
      const plain = await insertTransaction(regular, '2026-10-01', 3n);
      const foreign = await insertTransaction(bobs, '2026-10-01', -4n);

      const rows = await ds.transaction((manager) => query.resolveForUpdate(manager, ALICE, [charge, off, plain, foreign]));

      expect(rows.sort((a, b) => a.id - b.id)).toEqual([
        { id: charge, amount: -1n, sentToAccountantAt: null, type: 'provider_expense', forAccountant: true },
        { id: off, amount: -2n, sentToAccountantAt: null, type: 'provider_expense', forAccountant: false },
        { id: plain, amount: 3n, sentToAccountantAt: null, type: 'regular', forAccountant: null },
      ]);
    });

    it('locks the transaction rows (FOR UPDATE OF t) but not the account or details rows', async () => {
      const account = await insertAccount();
      const charge = await insertTransaction(account, '2026-10-01', -1n);
      const other = ds.createQueryRunner();
      await other.connect();

      try {
        await ds.transaction(async (manager: EntityManager) => {
          await query.resolveForUpdate(manager, ALICE, [charge]);

          await other.startTransaction();
          await expect(
            other.query('SELECT id FROM bank_transactions WHERE id = ? FOR UPDATE NOWAIT', [charge]),
          ).rejects.toThrow(/NOWAIT|lock/i);
          await expect(
            other.query('SELECT id FROM bank_accounts WHERE id = ? FOR UPDATE NOWAIT', [account]),
          ).resolves.toHaveLength(1);
          await expect(
            other.query('SELECT account_id FROM bank_provider_expense_details WHERE account_id = ? FOR UPDATE NOWAIT', [account]),
          ).resolves.toHaveLength(1);
          await other.rollbackTransaction();
        });
      } finally {
        await other.release();
      }
    });
  });

  describe('stamp / clear', () => {
    it('stamps the unsent rows and keeps existing timestamps', async () => {
      const account = await insertAccount();
      const original = new Date('2026-10-10T10:00:00Z');
      const sent = await insertTransaction(account, '2026-10-01', -1n, original);
      const unsent = await insertTransaction(account, '2026-10-02', -1n);
      const untouched = await insertTransaction(account, '2026-10-03', -1n);
      const now = new Date('2026-11-09T12:00:00Z');

      await ds.transaction((manager) => query.stamp(manager, [sent, unsent], now));

      expect(await sentAtOf(sent)).toEqual(original);
      expect(await sentAtOf(unsent)).toEqual(now);
      expect(await sentAtOf(untouched)).toBeNull();
    });

    it('clears the marks of the ids only', async () => {
      const account = await insertAccount();
      const mark = new Date('2026-10-10T10:00:00Z');
      const cleared = await insertTransaction(account, '2026-10-01', -1n, mark);
      const kept = await insertTransaction(account, '2026-10-02', -1n, mark);

      await ds.transaction((manager) => query.clear(manager, [cleared]));

      expect(await sentAtOf(cleared)).toBeNull();
      expect(await sentAtOf(kept)).toEqual(mark);
    });
  });
});
