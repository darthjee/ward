import type { INestApplication } from '@nestjs/common';
import { hasMinRole, OrgRole } from '../../core/org-role.js';
import {
  ALICE,
  ALICE_ORG,
  base,
  BOB,
  buildBankTestApp,
  createAccount,
  send,
  withoutTimestamp,
} from './support/build-bank-test-app.js';
import type { InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { ORG_MEMBERS, seedOrgRoles, UNIFORM_403, UNIFORM_404 } from './support/owner-matrix.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));
jest.mock('../accountant-charges.query.js', () => jest.requireActual('./support/in-memory-accountant-charges.query.js'));

// The per-role matrix of #143: every owner-scoped bank write route, under `/orgs/:orgId/bank/...`,
// against an `owner`, an `admin`, a `user` and a non-member. A role at or above the route's
// `@MinOrgRole` gets 2xx, a lower role the uniform 403, and a non-member the uniform 404. Fixtures
// are created by Alice (the organization's original owner) before each request.

type Body = Record<string, unknown>;
type Method = 'post' | 'patch' | 'delete';

interface Prepared {
  path: string;
  body?: Body;
}

interface RouteCase {
  label: string;
  method: Method;
  minRole: OrgRole;
  setup: (orgId: number | null) => Promise<Prepared>;
}

const ROLES = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.USER];

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('organization roles on bank writes (e2e)', () => {
  let app: INestApplication;
  let repos: InMemoryBankRepos;

  const expectOk = async (method: Method, path: string, body?: Body, user = ALICE): Promise<Body> => {
    const response = await send(app, method, path, user, body);

    if (response.status >= 300) {
      throw new Error(`setup ${method.toUpperCase()} ${path} answered ${response.status}: ${JSON.stringify(response.body)}`);
    }

    return response.body as Body;
  };
  const regular = async (orgId: number | null): Promise<number> =>
    (await createAccount(app, ALICE, orgId, { name: uniqueName('Checking'), opening_date: '2026-01-01' })).id;
  const debt = async (orgId: number | null): Promise<number> =>
    (await createAccount(app, ALICE, orgId, {
      type: 'debt',
      name: uniqueName('Loan'),
      debt: { due_day: 10, instalment_amount: '500.00', bills_from: '2026-01-01' },
    })).id;
  const provider = async (orgId: number | null): Promise<number> =>
    (await createAccount(app, ALICE, orgId, { type: 'provider_expense', name: uniqueName('Vivo'), opening_date: '2026-01-01' })).id;
  const providerBill = async (orgId: number | null): Promise<number> => {
    const providerId = await provider(orgId);
    const created = await expectOk('post', `${base(orgId)}/accounts/${providerId}/provider-bills.json`, {
      kind: 'recurring', description: uniqueName('Plan'), due_day: 5, expected_amount: '200.00', bills_from: '2026-01-01',
    });

    return created.id as number;
  };
  const bill = async (orgId: number | null): Promise<number> => {
    const created = await expectOk('post', `${base(orgId)}/bills.json`, {
      provider_account_id: await provider(orgId),
      paying_account_id: await regular(orgId),
      due_date: '2026-01-20',
      amount: '80.00',
      description: uniqueName('IPVA'),
    });

    return created.id as number;
  };
  const transaction = async (orgId: number | null, accountId: number): Promise<number> => {
    const created = await expectOk('post', `${base(orgId)}/accounts/${accountId}/transactions.json`, {
      date: '2026-01-02', amount: '-10.00', description: 'Charge',
    });

    return created.id as number;
  };
  const skip = { status: 'skipped' };
  const occurrencePath = (orgId: number | null, accountId: number) =>
    `${base(orgId)}/accounts/${accountId}/occurrences/2026-01-10/payment.json`;
  const perBillPath = (orgId: number | null, id: number) => `${base(orgId)}/provider-bills/${id}/occurrences/2026-01-05/payment.json`;

  const ROUTES: RouteCase[] = [
    { label: 'POST accounts.json', method: 'post', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts.json`, body: { name: uniqueName('New') },
    }) },
    { label: 'PATCH accounts/:accountId.json', method: 'patch', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}.json`, body: { name: uniqueName('Renamed') },
    }) },
    { label: 'DELETE accounts/:accountId.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}.json`,
    }) },
    { label: 'POST accounts/:accountId/archive.json', method: 'post', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}/archive.json`,
    }) },
    { label: 'POST accounts/:accountId/unarchive.json', method: 'post', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const id = await regular(orgId);
      await expectOk('post', `${base(orgId)}/accounts/${id}/archive.json`);

      return { path: `${base(orgId)}/accounts/${id}/unarchive.json` };
    } },
    { label: 'POST accounts/:accountId/transactions.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await regular(orgId)}/transactions.json`,
      body: { date: '2026-01-03', amount: '-5.00', description: 'Coffee' },
    }) },
    { label: 'PATCH accounts/:accountId/transactions/:transactionId.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => {
      const accountId = await regular(orgId);

      return {
        path: `${base(orgId)}/accounts/${accountId}/transactions/${await transaction(orgId, accountId)}.json`,
        body: { description: 'Edited' },
      };
    } },
    { label: 'DELETE accounts/:accountId/transactions/:transactionId.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const accountId = await regular(orgId);

      return { path: `${base(orgId)}/accounts/${accountId}/transactions/${await transaction(orgId, accountId)}.json` };
    } },
    { label: 'POST bills.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/bills.json`,
      body: {
        provider_account_id: await provider(orgId),
        paying_account_id: await regular(orgId),
        due_date: '2026-02-20',
        amount: '10.00',
        description: uniqueName('Fee'),
      },
    }) },
    { label: 'PATCH bills/:id.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/bills/${await bill(orgId)}.json`, body: { description: uniqueName('Edited') },
    }) },
    { label: 'DELETE bills/:id.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/bills/${await bill(orgId)}.json`,
    }) },
    { label: 'POST accounts/:accountId/provider-bills.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/accounts/${await provider(orgId)}/provider-bills.json`,
      body: { kind: 'recurring', description: uniqueName('Plan'), due_day: 5, bills_from: '2026-01-01' },
    }) },
    { label: 'PATCH provider-bills/:id.json', method: 'patch', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/provider-bills/${await providerBill(orgId)}.json`, body: { description: uniqueName('Edited') },
    }) },
    { label: 'DELETE provider-bills/:id.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => ({
      path: `${base(orgId)}/provider-bills/${await providerBill(orgId)}.json`,
    }) },
    { label: 'POST accounts/:accountId/occurrences/:dueDate/payment.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: occurrencePath(orgId, await debt(orgId)), body: skip,
    }) },
    { label: 'DELETE accounts/:accountId/occurrences/:dueDate/payment.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const path = occurrencePath(orgId, await debt(orgId));
      await expectOk('post', path, skip);

      return { path };
    } },
    { label: 'POST bills/:id/payment.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/bills/${await bill(orgId)}/payment.json`, body: skip,
    }) },
    { label: 'DELETE bills/:id/payment.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const path = `${base(orgId)}/bills/${await bill(orgId)}/payment.json`;
      await expectOk('post', path, skip);

      return { path };
    } },
    { label: 'POST provider-bills/:id/occurrences/:dueDate/payment.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: perBillPath(orgId, await providerBill(orgId)), body: skip,
    }) },
    { label: 'DELETE provider-bills/:id/occurrences/:dueDate/payment.json', method: 'delete', minRole: OrgRole.ADMIN, setup: async (orgId) => {
      const path = perBillPath(orgId, await providerBill(orgId));
      await expectOk('post', path, skip);

      return { path };
    } },
    { label: 'POST accountant/mark-sent.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => ({
      path: `${base(orgId)}/accountant/mark-sent.json`,
      body: { transaction_ids: [await transaction(orgId, await provider(orgId))] },
    }) },
    { label: 'POST accountant/mark-unsent.json', method: 'post', minRole: OrgRole.USER, setup: async (orgId) => {
      const ids = [await transaction(orgId, await provider(orgId))];
      await expectOk('post', `${base(orgId)}/accountant/mark-sent.json`, { transaction_ids: ids });

      return { path: `${base(orgId)}/accountant/mark-unsent.json`, body: { transaction_ids: ids } };
    } },
  ];

  beforeAll(async () => {
    let seedMembership: Parameters<typeof seedOrgRoles>[0];
    ({ app, repos, seedMembership } = await buildBankTestApp());
    seedOrgRoles(seedMembership);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('covers every owner-scoped bank write route', () => {
    expect(ROUTES).toHaveLength(22);
  });

  describe.each(ROUTES)('$label (min $minRole)', ({ method, minRole, setup }) => {
    it.each(ROLES)('as %s', async (role) => {
      const { path, body } = await setup(ALICE_ORG);
      const response = await send(app, method, path, ORG_MEMBERS[role], body);

      if (hasMinRole(role, minRole)) {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      } else {
        expect(response.status).toBe(403);
        expect(withoutTimestamp(response)).toEqual(UNIFORM_403);
      }
    });

    it('as a non-member answers the uniform 404', async () => {
      const { path, body } = await setup(ALICE_ORG);
      const response = await send(app, method, path, BOB, body).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    if (minRole === OrgRole.ADMIN) {
      it('is unaffected in the personal context', async () => {
        const { path, body } = await setup(null);
        const response = await send(app, method, path, ALICE, body);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
      });
    }
  });

  describe('the 403', () => {
    it('leaves the data untouched (a user cannot delete an account)', async () => {
      const id = await regular(ALICE_ORG);

      await send(app, 'delete', `${base(ALICE_ORG)}/accounts/${id}.json`, ORG_MEMBERS.user).expect(403);
      expect(repos.accounts.rows.some((row) => row.id === id)).toBe(true);
      await send(app, 'get', `${base(ALICE_ORG)}/accounts/${id}.json`, ORG_MEMBERS.user).expect(200);
    });

    it('names neither the resource nor the required role', async () => {
      const id = await regular(ALICE_ORG);
      const response = await send(app, 'post', `${base(ALICE_ORG)}/accounts/${id}/archive.json`, ORG_MEMBERS.user).expect(403);

      expect(JSON.stringify(response.body)).not.toMatch(/admin|account|archive/i);
    });
  });

  describe('the 404 comes before the role check', () => {
    it.each(['0' + String(ALICE_ORG), 'abc', '-1'])('for the malformed :orgId %p', async (orgId) => {
      const response = await send(app, 'post', `/orgs/${orgId}/bank/accounts.json`, ORG_MEMBERS.user, { name: 'X' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });

    it('for a non-member on an admin route', async () => {
      const response = await send(app, 'post', `${base(ALICE_ORG)}/accounts.json`, BOB, { name: 'X' }).expect(404);

      expect(withoutTimestamp(response)).toEqual(UNIFORM_404);
    });
  });

  describe('reads stay open to every member', () => {
    it.each(ROLES)('as %s', async (role) => {
      await send(app, 'get', `${base(ALICE_ORG)}/accounts.json`, ORG_MEMBERS[role]).expect(200);
    });
  });
});
