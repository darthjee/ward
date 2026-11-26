import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BillPayment } from '../entities/bill-payment.entity.js';
import {
  ALICE,
  beforeNextTransaction,
  buildBankTestApp,
  send,
  type BankTestApp,
} from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { mysqlError } from './support/in-memory-where.js';
import { ORG_MEMBERS, seedOrgRoles } from './support/owner-matrix.js';
import { CONTEXTS, reconciliationClient, type ReconciliationClient } from './support/reconciliation-e2e.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../payment-generated.query.js', () => jest.requireActual('./support/in-memory-payment-generated.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));

// The lock matrix of `docs/agents/specs/reconciliation/model.md` on `PATCH` and `DELETE
// .../transactions/:id.json` (api/existing-routes.md): the rows are the three states of a
// transaction, the columns the changed fields.

type State = 'uncleared' | 'ticked' | 'cleared';

const STATEMENT_DATE = '2026-01-31';
const STATEMENT_BALANCE = '1010.00';

describe('transaction reconciliation locks (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;
  let seedMembership: BankTestApp['seedMembership'];

  beforeAll(async () => {
    ({ app, repos, seedMembership } = await buildBankTestApp());
    seedOrgRoles(seedMembership);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  const rowOf = (id: number) => repos.transactions.rows.find((row) => row.id === id)!;

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const api = (): ReconciliationClient => reconciliationClient(app, orgId);
    const path = (accountId: number, id: number): string => `${api().base}/accounts/${accountId}/transactions/${id}.json`;
    const patch = (accountId: number, id: number, body: object, user = ALICE) => send(app, 'patch', path(accountId, id), user, body);
    const remove = (accountId: number, id: number, user = ALICE) => send(app, 'delete', path(accountId, id), user);

    // A 10.00 row dated 2026-01-10 on a fresh account (opening 2026-01-01, 1000.00), in the given state.
    async function seed(state: State) {
      const client = api();
      const { id: accountId } = await client.account();
      const id = await client.transaction(accountId, '2026-01-10', '10.00');
      const statement = state === 'uncleared' ? null : await client.open(accountId, STATEMENT_DATE, STATEMENT_BALANCE);

      if (statement !== null) {
        await client.ticks(accountId, statement, { tick: [id] }).expect(200);
      }
      if (state === 'cleared') {
        await client.finish(accountId, statement!).expect(200);
      }

      return { client, accountId, id, statement };
    }

    describe('the lock matrix', () => {
      it.each<[State, number, number, number]>([
        ['uncleared', 200, 200, 204],
        ['ticked', 200, 200, 204],
        ['cleared', 409, 200, 409],
      ])('on a %s row: amount/date PATCH %i, description/notes PATCH %i, DELETE %i', async (state, amountDate, textual, deletion) => {
        const amountRow = await seed(state);
        const dateRow = await seed(state);
        const textRow = await seed(state);
        const deleteRow = await seed(state);

        await patch(amountRow.accountId, amountRow.id, { amount: '20.00' }).expect(amountDate);
        await patch(dateRow.accountId, dateRow.id, { date: '2026-01-12' }).expect(amountDate);
        await patch(textRow.accountId, textRow.id, { description: 'Tea', notes: 'n' }).expect(textual);
        await remove(deleteRow.accountId, deleteRow.id).expect(deletion);
      });

      it('answers TRANSACTION_CLEARED with fixed text and applies nothing', async () => {
        const { accountId, id } = await seed('cleared');

        const response = await patch(accountId, id, { amount: '20.00', date: '2026-01-12', description: 'Tea' }).expect(409);

        expect(response.body.error).toEqual({ code: 'TRANSACTION_CLEARED', message: 'This transaction is part of a finished reconciliation.' });
        expect(rowOf(id)).toMatchObject({ amount: 1000n, date: '2026-01-10', description: 'Row' });
      });

      it('accepts an unchanged amount and date on a cleared row ("10" equals "10.00")', async () => {
        const { accountId, id } = await seed('cleared');

        const response = await patch(accountId, id, { amount: '10', date: '2026-01-10', description: 'Tea' }).expect(200);

        expect(response.body).toMatchObject({ amount: '10.00', description: 'Tea', reconciliation: { status: 'finished', statement_date: STATEMENT_DATE } });
      });

      it('answers 409 for a changed amount together with a description change, applying nothing', async () => {
        const { accountId, id } = await seed('cleared');

        await patch(accountId, id, { amount: '11.00', description: 'Tea' }).expect(409);

        expect(rowOf(id)).toMatchObject({ amount: 1000n, description: 'Row' });
      });

      it('answers 409 on DELETE of a cleared row for the owner and, in an organization, the admin', async () => {
        const { accountId, id } = await seed('cleared');

        await remove(accountId, id).expect(409);
        if (orgId !== null) {
          await remove(accountId, id, ORG_MEMBERS.admin).expect(409);
        }

        expect(repos.transactions.rows.some((row) => row.id === id)).toBe(true);
      });
    });

    describe('deleting a ticked row', () => {
      it('goes with its tick: the statement ticked_sum, difference and transaction_count change', async () => {
        const { client, accountId, id, statement } = await seed('ticked');

        expect((await client.show(accountId, statement!).expect(200)).body).toMatchObject({
          ticked_sum: '10.00', difference: '0.00', transaction_count: 1,
        });

        await remove(accountId, id).expect(204);

        expect((await client.show(accountId, statement!).expect(200)).body).toMatchObject({
          ticked_sum: '0.00', difference: '10.00', transaction_count: 0,
        });
      });
    });

    describe('moving a ticked row (auto-untick)', () => {
      it.each([
        ['past the statement date', '2026-02-05', null],
        ['before the opening date', '2025-12-31', null],
        ['to exactly the statement date', STATEMENT_DATE, 'open'],
        ['to exactly the opening date', '2026-01-01', 'open'],
      ])('%s', async (_label, date, expected) => {
        const { client, accountId, id, statement } = await seed('ticked');

        const response = await patch(accountId, id, { date }).expect(200);

        expect(response.body.reconciliation).toEqual(expected === null ? null : { id: statement, status: 'open', statement_date: STATEMENT_DATE });
        expect(rowOf(id).reconciliationId).toBe(expected === null ? null : statement);
        expect((await client.show(accountId, statement!).expect(200)).body).toMatchObject(
          expected === null ? { ticked_sum: '0.00', difference: '10.00', transaction_count: 0 } : { ticked_sum: '10.00', difference: '0.00' },
        );
      });

      it('keeps the tick on an amount change', async () => {
        const { client, accountId, id, statement } = await seed('ticked');

        await patch(accountId, id, { amount: '12.00' }).expect(200);

        expect((await client.show(accountId, statement!).expect(200)).body).toMatchObject({ ticked_sum: '12.00', difference: '-2.00' });
      });
    });

    describe('check order', () => {
      const addPayment = (accountId: number, transactionId: number) =>
        repos.billPayments.save(Object.assign(new BillPayment(), {
          sourceAccountId: accountId,
          billId: null,
          dueDate: '2026-01-10',
          status: 'paid',
          paidOn: '2026-01-10',
          amount: 1000n,
          payingAccountId: null,
          paymentTransactionId: null,
          withdrawalTransactionId: null,
          chargeTransactionId: transactionId,
        }));

      it('answers 403 (payment-generated) before TRANSACTION_CLEARED on PATCH, and TRANSACTION_CLEARED on DELETE', async () => {
        if (orgId === null) {
          return;
        }
        const { accountId, id } = await seed('cleared');
        await addPayment(accountId, id);

        await patch(accountId, id, { amount: '20.00' }, ORG_MEMBERS.user).expect(403);
        await patch(accountId, id, { amount: '20.00' }, ORG_MEMBERS.admin).expect(409);
        const deleted = await remove(accountId, id, ORG_MEMBERS.admin).expect(409);

        expect(deleted.body.error.code).toBe('TRANSACTION_CLEARED');
      });

      it('answers 400 for an invalid amount before ACCOUNT_ARCHIVED, and 409 ACCOUNT_ARCHIVED for a valid one', async () => {
        const { client, accountId, id } = await seed('uncleared');
        await client.archive(accountId);

        await patch(accountId, id, { amount: '0' }).expect(400);
        const archived = await patch(accountId, id, { description: 'Tea' }).expect(409);
        const deleted = await remove(accountId, id).expect(409);

        expect(archived.body.error.code).toBe('ACCOUNT_ARCHIVED');
        expect(deleted.body.error.code).toBe('ACCOUNT_ARCHIVED');
      });

      it('answers 404 for an unknown transaction before the 400', async () => {
        const { accountId } = await seed('uncleared');

        await patch(accountId, 999999, { amount: '0' }).expect(404);
      });
    });

    describe('the reconciliation of a created or edited row', () => {
      it('POST dated inside a finished period is allowed and uncleared', async () => {
        const { client, accountId } = await seed('cleared');

        const created = await send(app, 'post', `${client.base}/accounts/${accountId}/transactions.json`, ALICE, {
          date: '2026-01-05', amount: '1.00', description: 'Late',
        }).expect(201);

        expect(created.body.reconciliation).toBeNull();
        expect(rowOf(created.body.id).reconciliationId).toBeNull();
      });

      it('PATCH answers the statement of the row, open or finished, from the account-scoped lookup', async () => {
        const ticked = await seed('ticked');
        const cleared = await seed('cleared');

        expect((await patch(ticked.accountId, ticked.id, { description: 'Tea' }).expect(200)).body.reconciliation)
          .toEqual({ id: ticked.statement, status: 'open', statement_date: STATEMENT_DATE });
        expect((await patch(cleared.accountId, cleared.id, { description: 'Tea' }).expect(200)).body.reconciliation)
          .toEqual({ id: cleared.statement, status: 'finished', statement_date: STATEMENT_DATE });
      });

      it('never joins a statement of another account', async () => {
        const other = await seed('cleared');
        const own = await seed('uncleared');
        rowOf(own.id).reconciliationId = other.statement;

        const response = await patch(own.accountId, own.id, { description: 'Tea' }).expect(200);

        expect(response.body.reconciliation).toBeNull();
      });
    });

    describe('mass assignment', () => {
      it.each([{ reconciliation_id: 1 }, { reconciliation: { id: 1 } }])('rejects %j in a POST and a PATCH body with a 400', async (extra) => {
        const { client, accountId, id } = await seed('uncleared');

        await send(app, 'post', `${client.base}/accounts/${accountId}/transactions.json`, ALICE, {
          date: '2026-01-05', amount: '1.00', description: 'x', ...extra,
        }).expect(400);
        await patch(accountId, id, extra).expect(400);
        expect(rowOf(id).reconciliationId).toBeNull();
      });
    });

    describe('concurrent requests (a tick or a finish slipping in after the pre-checks)', () => {
      it('a tick first: the PATCH finds a ticked row and unticks it when the date leaves the statement', async () => {
        const client = api();
        const { id: accountId } = await client.account();
        const id = await client.transaction(accountId, '2026-01-10', '10.00');
        const statement = await client.open(accountId, STATEMENT_DATE, STATEMENT_BALANCE);
        beforeNextTransaction(app, () => client.ticks(accountId, statement, { tick: [id] }).expect(200));

        const response = await patch(accountId, id, { date: '2026-02-05' }).expect(200);

        expect(response.body.reconciliation).toBeNull();
        expect(rowOf(id).reconciliationId).toBeNull();
      });

      it('a finish first: the PATCH sees the cleared row and answers TRANSACTION_CLEARED, applying nothing', async () => {
        const { client, accountId, id, statement } = await seed('ticked');
        beforeNextTransaction(app, () => client.finish(accountId, statement!).expect(200));

        const response = await patch(accountId, id, { amount: '20.00' }).expect(409);

        expect(response.body.error.code).toBe('TRANSACTION_CLEARED');
        expect(rowOf(id).amount).toBe(1000n);
      });

      it('a finish first: the DELETE answers TRANSACTION_CLEARED', async () => {
        const { client, accountId, id, statement } = await seed('ticked');
        beforeNextTransaction(app, () => client.finish(accountId, statement!).expect(200));

        const response = await remove(accountId, id).expect(409);

        expect(response.body.error.code).toBe('TRANSACTION_CLEARED');
        expect(repos.transactions.rows.some((row) => row.id === id)).toBe(true);
      });
    });

    describe('under the locks', () => {
      it('takes the account row lock and the row lock on a PATCH and a DELETE', async () => {
        const { accountId, id } = await seed('uncleared');
        const locksBefore = repos.accounts.locks.length;

        await patch(accountId, id, { description: 'Tea' }).expect(200);
        await remove(accountId, id).expect(204);

        expect(repos.accounts.locks.slice(locksBefore)).toEqual(['pessimistic_write', 'pessimistic_write']);
      });

      it('maps a deadlock to CONCURRENT_UPDATE', async () => {
        const { accountId, id } = await seed('uncleared');
        const { manager } = app.get<{ manager: { transaction: unknown } }>(getDataSourceToken());
        const original = manager.transaction;
        manager.transaction = async () => {
          manager.transaction = original;
          throw mysqlError('ER_LOCK_DEADLOCK');
        };

        const response = await patch(accountId, id, { description: 'Tea' }).expect(409);

        expect(response.body.error.code).toBe('CONCURRENT_UPDATE');
        expect(rowOf(id).description).toBe('Row');
      });
    });
  });
});
