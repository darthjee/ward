import type { INestApplication } from '@nestjs/common';
import type request from 'supertest';
import { ALICE, ALICE_ORG, base, createAccount, send } from './build-bank-test-app.js';

// Fixtures shared by the reconciliation e2e specs (`reconciliations`, `reconciliation-ticks`,
// `reconciliation-bounds`, `reconciliation-lifecycle`): paths, an account, ledger rows and
// statements created through the API.

export type Body = Record<string, unknown>;

export const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

/**
 * @param {INestApplication} app - The app.
 * @param {number | null} orgId - The organization, or `null` for Personal.
 * @returns {object} The reconciliation request helpers of one context, all acting as Alice unless a user is given.
 */
export function reconciliationClient(app: INestApplication, orgId: number | null) {
  const root = (accountId: number | string) => `${base(orgId)}/accounts/${accountId}/reconciliations`;
  const member = (accountId: number | string, id: number | string) => `${root(accountId)}/${id}`;

  return {
    base: base(orgId),
    account: (fields: Body = {}, user = ALICE) =>
      createAccount(app, user, orgId, { name: uniqueName('Checking'), opening_date: '2026-01-01', opening_balance: '1000.00', ...fields }),
    transaction: async (accountId: number, date: string, amount: string, user = ALICE): Promise<number> =>
      (await send(app, 'post', `${base(orgId)}/accounts/${accountId}/transactions.json`, user, { date, amount, description: 'Row' }).expect(201))
        .body.id as number,
    list: (accountId: number | string, query = '', user = ALICE): request.Test =>
      send(app, 'get', `${root(accountId)}.json${query}`, user),
    start: (accountId: number | string, body: Body, user = ALICE): request.Test =>
      send(app, 'post', `${root(accountId)}.json`, user, body),
    show: (accountId: number | string, id: number | string, user = ALICE): request.Test =>
      send(app, 'get', `${member(accountId, id)}.json`, user),
    edit: (accountId: number | string, id: number | string, body: Body, user = ALICE): request.Test =>
      send(app, 'patch', `${member(accountId, id)}.json`, user, body),
    cancel: (accountId: number | string, id: number | string, user = ALICE): request.Test =>
      send(app, 'delete', `${member(accountId, id)}.json`, user),
    ticks: (accountId: number | string, id: number | string, body: Body, user = ALICE): request.Test =>
      send(app, 'patch', `${member(accountId, id)}/ticks.json`, user, body),
    finish: (accountId: number | string, id: number | string, body: Body = {}, user = ALICE): request.Test =>
      send(app, 'post', `${member(accountId, id)}/finish.json`, user, body),
    undo: (accountId: number | string, id: number | string, body: Body = {}, user = ALICE): request.Test =>
      send(app, 'post', `${member(accountId, id)}/undo.json`, user, body),
    archive: (accountId: number) => send(app, 'post', `${base(orgId)}/accounts/${accountId}/archive.json`, ALICE).expect(200),
    unarchive: (accountId: number) => send(app, 'post', `${base(orgId)}/accounts/${accountId}/unarchive.json`, ALICE).expect(200),
    /** Starts a statement and returns its id. */
    open: async (accountId: number, date: string, balance: string, user = ALICE): Promise<number> =>
      (await send(app, 'post', `${root(accountId)}.json`, user, { statement_date: date, statement_balance: balance }).expect(201)).body.id as number,
  };
}

export type ReconciliationClient = ReturnType<typeof reconciliationClient>;
