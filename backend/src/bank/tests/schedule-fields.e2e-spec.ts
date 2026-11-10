import type { INestApplication } from '@nestjs/common';
import { todayUtc } from '../ledger-date.js';
import { ALICE, ALICE_ORG, base, BOB, buildBankTestApp, createAccount, send, withoutTimestamp } from './support/build-bank-test-app.js';
import { ownerKeysIn } from './support/owner-matrix.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

// The bill schedule fields on the debt / provider_expense objects (bills.md, *Schedule fields on
// source accounts*): bills_from lifecycle, show_in_calendar default and the paying_account_id
// 422 rules, in both owner contexts.

type Body = Record<string, unknown>;

const ACCOUNT_NOT_FOUND = { error: { code: 'ACCOUNT_NOT_FOUND', message: 'account not found' }, statusCode: 422 };
const CURRENCY_MISMATCH = { error: { code: 'CURRENCY_MISMATCH', message: 'currency mismatch' }, statusCode: 422 };

const CONTEXTS: Array<[string, number | null]> = [['Personal', null], ['organization', ALICE_ORG]];
const TYPES = ['debt', 'provider_expense'] as const;

const uniqueName = (label: string): string => `${label} ${Math.random().toString(36).slice(2)}`;

describe('schedule fields (e2e)', () => {
  let app: INestApplication;

  const create = (orgId: number | null, type: string, nested: Body, user = ALICE) =>
    send(app, 'post', `${base(orgId)}/accounts.json`, user, { type, name: uniqueName('Source'), [type]: nested });
  const regular = async (orgId: number | null, fields: Body = {}, user = ALICE) =>
    createAccount(app, user, orgId, { name: uniqueName('Checking'), ...fields });

  beforeAll(async () => {
    ({ app } = await buildBankTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe.each(CONTEXTS)('in the %s context', (_context, orgId) => {
    const prefix = base(orgId);

    describe.each(TYPES)('on %s accounts', (type) => {
      it('defaults show_in_calendar to true and the rest to null', async () => {
        const created = await create(orgId, type, {}).expect(201);

        expect(created.body[type]).toMatchObject({ bills_from: null, show_in_calendar: true, paying_account: null });
      });

      it('sets bills_from to today when due_day is first set, and keeps it when due_day is cleared', async () => {
        const created = await create(orgId, type, {}).expect(201);
        const path = `${prefix}/accounts/${created.body.id}.json`;

        const scheduled = await send(app, 'patch', path, ALICE, { [type]: { due_day: 10 } }).expect(200);
        expect(scheduled.body[type]).toMatchObject({ due_day: 10, bills_from: todayUtc(new Date()) });

        await send(app, 'patch', path, ALICE, { [type]: { bills_from: '2026-01-01' } }).expect(200);
        const cleared = await send(app, 'patch', path, ALICE, { [type]: { due_day: null } }).expect(200);
        expect(cleared.body[type]).toMatchObject({ due_day: null, bills_from: '2026-01-01' });
      });

      it('round-trips the three fields through create, update, show and list', async () => {
        const paying = await regular(orgId);
        const created = await create(orgId, type, {
          due_day: 5,
          bills_from: '2026-02-01',
          show_in_calendar: false,
          paying_account_id: paying.id,
        }).expect(201);
        const expected = {
          bills_from: '2026-02-01',
          show_in_calendar: false,
          paying_account: { id: paying.id, name: paying.name },
        };
        expect(created.body[type]).toMatchObject(expected);
        expect(created.body[type]).not.toHaveProperty('paying_account_id');

        const shown = await send(app, 'get', `${prefix}/accounts/${created.body.id}.json`, ALICE).expect(200);
        const list = await send(app, 'get', `${prefix}/accounts.json?type=${type}`, ALICE).expect(200);
        expect(shown.body[type]).toMatchObject(expected);
        expect(list.body.find((row: { id: number }) => row.id === created.body.id)[type]).toMatchObject(expected);
        expect(ownerKeysIn([created.body, shown.body, list.body])).toEqual([]);

        const updated = await send(app, 'patch', `${prefix}/accounts/${created.body.id}.json`, ALICE, {
          [type]: { show_in_calendar: true, paying_account_id: null, bills_from: null },
        }).expect(200);
        expect(updated.body[type]).toMatchObject({ bills_from: null, show_in_calendar: true, paying_account: null });
      });

      it('answers one generic 422 for every invalid paying_account_id', async () => {
        const otherContext = await regular(orgId === null ? ALICE_ORG : null);
        const otherOwner = await regular(null, {}, BOB);
        const nonRegular = (await create(orgId, type, {}).expect(201)).body.id;
        const archived = await regular(orgId);
        await send(app, 'post', `${prefix}/accounts/${archived.id}/archive.json`, ALICE).expect(200);

        const bodies = [];
        for (const id of [999999, otherContext.id, otherOwner.id, nonRegular, archived.id]) {
          bodies.push(withoutTimestamp(await create(orgId, type, { paying_account_id: id }).expect(422)));
        }

        bodies.forEach((body) => expect(body).toEqual(ACCOUNT_NOT_FOUND));
      });

      it('answers 422 currency mismatch for a visible account of another currency', async () => {
        const usd = await regular(orgId, { currency: 'USD' });

        const response = await create(orgId, type, { paying_account_id: usd.id }).expect(422);

        expect(withoutTimestamp(response)).toEqual(CURRENCY_MISMATCH);
      });

      it('re-checks the stored paying account when the currency changes', async () => {
        const paying = await regular(orgId);
        const created = await create(orgId, type, { paying_account_id: paying.id }).expect(201);

        const response = await send(app, 'patch', `${prefix}/accounts/${created.body.id}.json`, ALICE, { currency: 'USD' })
          .expect(422);

        expect(withoutTimestamp(response)).toEqual(CURRENCY_MISMATCH);
      });

      it('rejects invalid schedule values with a 400', async () => {
        await create(orgId, type, { bills_from: '2026-02-30' }).expect(400);
        await create(orgId, type, { show_in_calendar: null }).expect(400);
        await create(orgId, type, { paying_account_id: 0 }).expect(400);
      });
    });
  });
});
