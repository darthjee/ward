import { accountRefsById, withPayingAccounts } from '../account-refs.js';
import { Account } from '../entities/account.entity.js';

describe('account refs', () => {
  const setup = () => {
    const find = jest.fn(async () => [
      Object.assign(new Account(), { id: 5, name: 'Checking', userId: 7 }),
    ]);
    const manager = { getRepository: jest.fn(() => ({ find })) };

    return { find, manager };
  };

  it('loads id and name only, in one query, ignoring nulls and repeats', async () => {
    const { find, manager } = setup();

    const refs = await accountRefsById([5, null, 5], manager as never);

    expect(manager.getRepository).toHaveBeenCalledWith(Account);
    expect(find).toHaveBeenCalledTimes(1);
    expect(refs.get(5)).toEqual({ id: 5, name: 'Checking' });
  });

  it('skips the query without ids', async () => {
    const { manager } = setup();

    await expect(accountRefsById([null], manager as never)).resolves.toEqual(new Map());
    expect(manager.getRepository).not.toHaveBeenCalled();
  });

  it('attaches the paying account ref (null when unset or gone)', async () => {
    const { manager } = setup();

    const rows = await withPayingAccounts([{ payingAccountId: 5 }, { payingAccountId: null }, { payingAccountId: 6 }], manager as never);

    expect(rows.map((row) => row.payingAccount)).toEqual([{ id: 5, name: 'Checking' }, null, null]);
  });
});
