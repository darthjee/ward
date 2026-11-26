import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ALICE, buildBankTestApp, send } from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { mysqlError } from './support/in-memory-where.js';
import { CONTEXTS, reconciliationClient, type ReconciliationClient } from './support/reconciliation-e2e.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));

// The opening-anchor and currency locks of `PATCH accounts/:id.json`, and the reconciliation fields
// of the account detail (`api/existing-routes.md`, *Accounts*). The checks run once in
// `AccountService`, so every account type gets them: the same cases run for each type.

const TYPES = ['regular', 'debt', 'investment', 'provider_expense'];
const STATEMENT_DATE = '2026-01-31';
// Every account of this spec opens at 0.00 on 2026-01-01, so a zero-row statement of 0.00 balances.
const ACCOUNT = { opening_date: '2026-01-01', opening_balance: '0.00' };

const unique = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

type State = 'open' | 'finished' | 'undone';

describe('account reconciliation locks (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(TYPES.flatMap((type) => CONTEXTS.map(([context, orgId]) => [type, context, orgId] as const)))(
    'a %s account in the %s context',
    (type, _context, orgId) => {
      const api = (): ReconciliationClient => reconciliationClient(app, orgId);
      const path = (id: number): string => `${api().base}/accounts/${id}.json`;
      const patch = (id: number, body: object) => send(app, 'patch', path(id), ALICE, body);
      const detail = async (id: number) => (await send(app, 'get', path(id), ALICE).expect(200)).body;

      // A fresh account with a zero-row statement in the given state.
      async function seed(state: State | null) {
        const client = api();
        const { id } = await client.account({ type, ...ACCOUNT });
        const statement = state === null ? null : await client.open(id, STATEMENT_DATE, '0.00');

        if (state === 'finished' || state === 'undone') {
          await client.finish(id, statement!).expect(200);
        }
        if (state === 'undone') {
          await client.undo(id, statement!).expect(200);
        }

        return { client, id, statement };
      }

      describe('the opening anchor', () => {
        it.each<[State, string, object]>([
          ['open', 'opening_date', { opening_date: '2025-12-31' }],
          ['open', 'opening_balance', { opening_balance: '5.00' }],
          ['open', 'both', { opening_date: '2025-12-31', opening_balance: '5.00' }],
          ['finished', 'opening_date', { opening_date: '2025-12-31' }],
          ['finished', 'opening_balance', { opening_balance: '5.00' }],
          ['finished', 'both', { opening_date: '2025-12-31', opening_balance: '5.00' }],
          ['undone', 'opening_date', { opening_date: '2025-12-31' }],
          ['undone', 'opening_balance', { opening_balance: '5.00' }],
          ['undone', 'both', { opening_date: '2025-12-31', opening_balance: '5.00' }],
        ])('answers ACCOUNT_RECONCILED with a %s statement when %s changes, applying nothing', async (state, _field, body) => {
          const { id } = await seed(state);

          const response = await patch(id, { ...body, notes: 'changed' }).expect(409);

          expect(response.body.error).toEqual({
            code: 'ACCOUNT_RECONCILED',
            message: 'The opening date and balance cannot change once the account has a reconciliation.',
          });
          expect(repos.accounts.rows.find((row) => row.id === id)).toMatchObject({ openingDate: '2026-01-01', openingBalance: 0n, notes: null });
        });

        it('accepts unchanged opening values ("0" equals "0.00") and a name edit', async () => {
          const { id } = await seed('finished');

          const response = await patch(id, { opening_date: '2026-01-01', opening_balance: '0', name: unique('Renamed') }).expect(200);

          expect(response.body).toMatchObject({ name: expect.stringContaining('Renamed'), opening_date: '2026-01-01', opening_balance: '0.00' });
        });

        it('is allowed again once a cancel removes the last statement', async () => {
          const { client, id, statement } = await seed('open');

          await client.cancel(id, statement!).expect(204);

          await patch(id, { opening_date: '2025-12-31' }).expect(200);
        });

        it('is not locked while the account has no statement', async () => {
          const { id } = await seed(null);

          await patch(id, { opening_date: '2025-12-31' }).expect(200);
        });

        it('answers 400 for a malformed balance when a statement exists', async () => {
          const { id } = await seed('open');

          await patch(id, { opening_balance: 'abc' }).expect(400);
        });
      });

      describe('the currency', () => {
        it.each<State>(['open', 'finished'])('answers CURRENCY_LOCKED with a zero-row %s statement', async (state) => {
          const { id } = await seed(state);

          const response = await patch(id, { currency: 'USD' }).expect(409);

          expect(response.body.error.code).toBe('CURRENCY_LOCKED');
        });

        it('is released after a cancel', async () => {
          const { client, id, statement } = await seed('open');
          await client.cancel(id, statement!).expect(204);

          await patch(id, { currency: 'USD' }).expect(200);
        });

        it('accepts the same currency with a statement', async () => {
          const { id } = await seed('open');

          await patch(id, { currency: 'BRL', name: unique('Same') }).expect(200);
        });
      });

      describe('the detail fields', () => {
        it('carries last_reconciliation and open_reconciliation_id after finish, undo and cancel', async () => {
          const { client, id } = await seed(null);
          expect(await detail(id)).toMatchObject({ last_reconciliation: null, open_reconciliation_id: null });

          const started = await client.open(id, STATEMENT_DATE, '0.00');
          expect(await detail(id)).toMatchObject({ last_reconciliation: null, open_reconciliation_id: started });

          await client.finish(id, started).expect(200);
          expect(await detail(id)).toMatchObject({
            last_reconciliation: { statement_date: STATEMENT_DATE, statement_balance: '0.00', reconciled_at: expect.any(String) },
            open_reconciliation_id: null,
          });

          await client.undo(id, started).expect(200);
          expect(await detail(id)).toMatchObject({ last_reconciliation: null, open_reconciliation_id: started });

          await client.cancel(id, started).expect(204);
          expect(await detail(id)).toMatchObject({ last_reconciliation: null, open_reconciliation_id: null });
        });

        it('keeps both fields off the list and the write responses', async () => {
          const { id } = await seed('open');

          const listed = await send(app, 'get', `${api().base}/accounts.json?type=${type}`, ALICE).expect(200);
          const edited = await patch(id, { name: unique('Edited') }).expect(200);

          for (const body of [listed.body.find((account: { id: number }) => account.id === id), edited.body]) {
            expect(body).not.toHaveProperty('last_reconciliation');
            expect(body).not.toHaveProperty('open_reconciliation_id');
          }
        });
      });

      describe('deleting and locking', () => {
        it('still deletes an account with a zero-row statement and no transactions (the cascade)', async () => {
          const { id } = await seed('open');

          await send(app, 'delete', path(id), ALICE).expect(204);

          expect(repos.reconciliations.rows.some((row) => row.accountId === id)).toBe(false);
        });

        it('takes the account row lock on a PATCH', async () => {
          const { id } = await seed('open');
          const before = repos.accounts.locks.length;

          await patch(id, { name: unique('Locked') }).expect(200);

          expect(repos.accounts.locks.slice(before)).toEqual(['pessimistic_write']);
        });

        it('maps a deadlock to CONCURRENT_UPDATE', async () => {
          const { id } = await seed('open');
          const { manager } = app.get<{ manager: { transaction: unknown } }>(getDataSourceToken());
          const original = manager.transaction;
          manager.transaction = async () => {
            manager.transaction = original;
            throw mysqlError('ER_LOCK_DEADLOCK');
          };

          const response = await patch(id, { name: unique('Deadlocked') }).expect(409);

          expect(response.body.error.code).toBe('CONCURRENT_UPDATE');
        });
      });
    },
  );
});
