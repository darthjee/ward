import type { INestApplication } from '@nestjs/common';
import { ALICE, base, beforeNextTransaction, buildBankTestApp, createAccount, send } from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { CONTEXTS, reconciliationClient } from './support/reconciliation-e2e.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));
jest.mock('../accountant-charges.query.js', () => jest.requireActual('./support/in-memory-accountant-charges.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));

// The three payment undos (`DELETE occurrences/:date/payment.json` of a debt, `DELETE
// bills/:id/payment.json` and `DELETE provider-bills/:id/occurrences/:date/payment.json`) are
// blocked by a cleared generated row and keep working for ticked or skipped ones (api/existing-routes.md,
// *Bill payments*). January 2026: the debt is due on the 10th, the provider on the 5th.

type Route = 'debt occurrence' | 'one-off bill' | 'provider-bill occurrence';

const ROUTES: Route[] = ['debt occurrence', 'one-off bill', 'provider-bill occurrence'];
const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;
const PAID = (payingId: number) => ({ status: 'paid', paid_on: '2026-01-12', amount: '490.00', paying_account_id: payingId });

describe('bill payment undo locks (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  beforeAll(async () => {
    ({ app, repos } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  const rowsOf = (accountId: number) => repos.transactions.rows.filter((row) => row.accountId === accountId);

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const api = () => reconciliationClient(app, orgId);

    // A paid occurrence of the route: its source account, its paying account and the undo request.
    async function paid(route: Route, status: 'paid' | 'skipped' = 'paid') {
      const prefix = base(orgId);
      const checking = await createAccount(app, ALICE, orgId, { name: uniqueName('Checking'), opening_date: '2026-01-01' });
      const body = status === 'paid' ? PAID(checking.id) : { status };

      if (route === 'debt occurrence') {
        const source = await createAccount(app, ALICE, orgId, {
          type: 'debt', name: uniqueName('Loan'), opening_date: '2026-01-01', debt: { due_day: 10, instalment_amount: '500.00', bills_from: '2026-01-01' },
        });
        await send(app, 'post', `${prefix}/accounts/${source.id}/occurrences/2026-01-10/payment.json`, ALICE, body).expect(201);

        return { checking, source, undo: () => send(app, 'delete', `${prefix}/accounts/${source.id}/occurrences/2026-01-10/payment.json`, ALICE) };
      }

      const source = await createAccount(app, ALICE, orgId, { type: 'provider_expense', name: uniqueName('Vivo'), opening_date: '2026-01-01' });

      if (route === 'one-off bill') {
        const bill = (await send(app, 'post', `${prefix}/bills.json`, ALICE, {
          provider_account_id: source.id, paying_account_id: checking.id, due_date: '2026-01-20', amount: '80.00', description: 'IPVA',
        }).expect(201)).body;
        await send(app, 'post', `${prefix}/bills/${bill.id}/payment.json`, ALICE, body).expect(201);

        return { checking, source, undo: () => send(app, 'delete', `${prefix}/bills/${bill.id}/payment.json`, ALICE) };
      }

      const recurring = (await send(app, 'post', `${prefix}/accounts/${source.id}/provider-bills.json`, ALICE, {
        kind: 'recurring', description: source.name, due_day: 5, expected_amount: '200.00', bills_from: '2026-01-01',
      }).expect(201)).body;
      await send(app, 'post', `${prefix}/provider-bills/${recurring.id}/occurrences/2026-01-05/payment.json`, ALICE, body).expect(201);

      return { checking, source, undo: () => send(app, 'delete', `${prefix}/provider-bills/${recurring.id}/occurrences/2026-01-05/payment.json`, ALICE) };
    }

    // Opens a statement on the account, ticks the row and (optionally) finishes it; returns the statement id.
    async function tickRow(accountId: number, transactionId: number, balance: string, finish: boolean): Promise<number> {
      const client = api();
      const statement = await client.open(accountId, '2026-01-31', balance);
      await client.ticks(accountId, statement, { tick: [transactionId] }).expect(200);

      if (finish) {
        await client.finish(accountId, statement).expect(200);
      }

      return statement;
    }

    describe.each(ROUTES)('the %s undo', (route) => {
      it('is blocked with TRANSACTION_CLEARED when the withdrawal is cleared, and deletes none of the rows', async () => {
        const { checking, source, undo } = await paid(route);
        const [withdrawal] = rowsOf(checking.id);
        await tickRow(checking.id, withdrawal.id, '-490.00', true);
        const sourceRows = rowsOf(source.id).length;

        const response = await undo().expect(409);

        expect(response.body.error).toEqual({ code: 'TRANSACTION_CLEARED', message: 'This transaction is part of a finished reconciliation.' });
        expect(rowsOf(checking.id)).toHaveLength(1);
        expect(rowsOf(source.id)).toHaveLength(sourceRows);
        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === source.id)).toBe(true);
      });

      it('is blocked when a row on the source account is cleared', async () => {
        const { checking, source, undo } = await paid(route);
        const payment = rowsOf(source.id).find((row) => row.amount > 0n)!;
        await tickRow(source.id, payment.id, '490.00', true);

        await undo().expect(409);

        expect(rowsOf(source.id).some((row) => row.id === payment.id)).toBe(true);
        expect(rowsOf(checking.id)).toHaveLength(1);
      });

      it('is allowed when the row is only ticked: the tick is dropped and the statement recomputed', async () => {
        const { checking, undo } = await paid(route);
        const [withdrawal] = rowsOf(checking.id);
        const statement = await tickRow(checking.id, withdrawal.id, '-490.00', false);
        expect((await api().show(checking.id, statement).expect(200)).body).toMatchObject({ ticked_sum: '-490.00', difference: '0.00' });

        await undo().expect(204);

        expect(rowsOf(checking.id)).toEqual([]);
        expect((await api().show(checking.id, statement).expect(200)).body).toMatchObject({
          ticked_sum: '0.00', difference: '-490.00', transaction_count: 0,
        });
      });

      it('still undoes a skipped payment, which has no linked rows', async () => {
        const { source, undo } = await paid(route, 'skipped');
        await api().open(source.id, '2026-01-31', '0.00');

        await undo().expect(204);

        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === source.id)).toBe(false);
      });

      it('answers TRANSACTION_CLEARED when a finish slips in between the pre-check and the write', async () => {
        const { checking, source, undo } = await paid(route);
        const [withdrawal] = rowsOf(checking.id);
        const statement = await tickRow(checking.id, withdrawal.id, '-490.00', false);
        beforeNextTransaction(app, () => api().finish(checking.id, statement).expect(200));

        const response = await undo().expect(409);

        expect(response.body.error.code).toBe('TRANSACTION_CLEARED');
        expect(rowsOf(checking.id)).toHaveLength(1);
        expect(repos.billPayments.rows.some((row) => row.sourceAccountId === source.id)).toBe(true);
      });

      it('locks the source and the paying account rows', async () => {
        const { undo } = await paid(route);
        const before = repos.accounts.locks.length;

        await undo().expect(204);

        expect(repos.accounts.locks.slice(before)).toEqual(['pessimistic_write', 'pessimistic_write']);
      });
    });
  });
});
