import { NotFoundException } from '@nestjs/common';
import { buildAccount, ORGANIZATION, PERSONAL } from './account.test-support.js';
import { ProviderBillResolver } from '../provider-bill.resolver.js';
import { createInMemoryBankRepos, type InMemoryBankRepos } from './support/in-memory-bank-repos.js';
import { ownerNotFound } from '../../core/parse-id.js';

describe('ProviderBillResolver', () => {
  let counter = 0;
  let repos: InMemoryBankRepos;
  let resolver: ProviderBillResolver;

  const addAccount = async (overrides: Parameters<typeof buildAccount>[0]) => repos.accounts.save(buildAccount({ id: undefined, name: `acc-${++counter}`, ...overrides }));
  const addBill = async (providerAccountId: number, kind: 'recurring' | 'one_off' = 'one_off') =>
    repos.bills.save(repos.bills.create({ providerAccountId, kind, description: 'b' }));

  beforeEach(() => {
    repos = createInMemoryBankRepos();
    resolver = new ProviderBillResolver(repos.bills as never, repos.accounts as never);
  });

  describe('#resolve', () => {
    it('returns a bill of either kind with its provider', async () => {
      const provider = await addAccount({ type: 'provider_expense' });
      const oneOff = await addBill(provider.id);
      const recurring = await addBill(provider.id, 'recurring');

      await expect(resolver.resolve(PERSONAL, oneOff.id)).resolves.toMatchObject({ bill: { id: oneOff.id }, provider: { id: provider.id } });
      await expect(resolver.resolve(PERSONAL, recurring.id)).resolves.toMatchObject({ bill: { kind: 'recurring' } });
    });

    it('locks the bill when inside a transaction', async () => {
      const provider = await addAccount({ type: 'provider_expense' });
      const bill = await addBill(provider.id);

      await resolver.resolve(PERSONAL, bill.id, { getRepository: (entity: unknown) => (entity === repos.bills.create({}).constructor ? repos.bills : repos.accounts) } as never);

      expect(repos.bills.locks).toEqual(['pessimistic_write']);
    });

    it('answers the same 404 for unknown, foreign, other-context, archived and debt', async () => {
      const mine = await addAccount({ type: 'provider_expense' });
      const foreign = await addAccount({ type: 'provider_expense', userId: 99 });
      const archived = await addAccount({ type: 'provider_expense', archivedAt: new Date() });
      const debt = await addAccount({ type: 'debt' });
      const bills = [await addBill(mine.id), await addBill(foreign.id), await addBill(archived.id), await addBill(debt.id)];
      const bodies: unknown[] = [];

      for (const [owner, id] of [
        [PERSONAL, 9999], [PERSONAL, bills[1].id], [PERSONAL, bills[2].id], [PERSONAL, bills[3].id], [ORGANIZATION, bills[0].id],
      ] as const) {
        const error = await resolver.resolve(owner, id).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(NotFoundException);
        bodies.push((error as NotFoundException).getResponse());
      }

      expect(new Set(bodies.map((body) => JSON.stringify(body)))).toEqual(new Set([JSON.stringify(ownerNotFound().getResponse())]));
    });
  });

  describe('#provider', () => {
    it('returns an owned provider, archived only when allowed', async () => {
      const active = await addAccount({ type: 'provider_expense' });
      const archived = await addAccount({ type: 'provider_expense', archivedAt: new Date() });

      await expect(resolver.provider(PERSONAL, active.id)).resolves.toMatchObject({ id: active.id });
      await expect(resolver.provider(PERSONAL, archived.id, { allowArchived: true })).resolves.toMatchObject({ id: archived.id });
      await expect(resolver.provider(PERSONAL, archived.id)).rejects.toMatchObject({ response: { code: 'ACCOUNT_ARCHIVED' } });
    });

    it('answers the uniform 404 for unknown, foreign, other-context and debt ids', async () => {
      const mine = await addAccount({ type: 'provider_expense' });
      const foreign = await addAccount({ type: 'provider_expense', userId: 99 });
      const debt = await addAccount({ type: 'debt' });

      for (const [owner, id] of [[PERSONAL, 9999], [PERSONAL, foreign.id], [PERSONAL, debt.id], [ORGANIZATION, mine.id]] as const) {
        await expect(resolver.provider(owner, id)).rejects.toEqual(ownerNotFound());
      }
    });

    it('uses the caller-chosen not-found error', async () => {
      const custom = new Error('custom');

      await expect(resolver.provider(PERSONAL, 9999, { notFound: () => custom })).rejects.toBe(custom);
    });

    it('reads through a given manager', async () => {
      const active = await addAccount({ type: 'provider_expense' });
      const manager = { getRepository: () => repos.accounts };

      await expect(resolver.provider(PERSONAL, active.id, {}, manager as never)).resolves.toMatchObject({ id: active.id });
    });
  });
});
