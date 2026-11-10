import { UnprocessableEntityException } from '@nestjs/common';
import { buildAccount, ORGANIZATION, PERSONAL } from './account.test-support.js';
import { AccountScheduleValidator } from '../account-schedule.validator.js';
import { accountNotFoundInBody, currencyMismatch } from '../body-reference-errors.js';
import { Account } from '../entities/account.entity.js';
import { PayingAccountResolver } from '../paying-account.resolver.js';

describe('body reference errors', () => {
  it('answers 422 with one generic body per error', () => {
    expect(accountNotFoundInBody()).toBeInstanceOf(UnprocessableEntityException);
    expect(accountNotFoundInBody().getResponse()).toEqual({ code: 'ACCOUNT_NOT_FOUND', message: 'account not found' });
    expect(currencyMismatch().getResponse()).toEqual({ code: 'CURRENCY_MISMATCH', message: 'currency mismatch' });
  });
});

describe('PayingAccountResolver', () => {
  const setup = (found: Account | null) => {
    const findOneBy = jest.fn(async () => found);
    const repository = { findOneBy };
    const resolver = new PayingAccountResolver(repository as never);

    return { resolver, findOneBy };
  };

  it('looks the account up scoped to the owner, regular and active only', async () => {
    const { resolver, findOneBy } = setup(buildAccount({ id: 5 }));

    await expect(resolver.resolve(PERSONAL, 5, 'BRL')).resolves.toMatchObject({ id: 5 });
    expect(findOneBy).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      id: 5,
      type: 'regular',
      archivedAt: expect.objectContaining({ _type: 'isNull' }),
    }));
  });

  it('answers the generic 422 when nothing visible matches', async () => {
    const { resolver } = setup(null);

    await expect(resolver.resolve(ORGANIZATION, 5, 'BRL')).rejects.toEqual(accountNotFoundInBody());
  });

  it('answers 422 currency mismatch for a visible account of another currency', async () => {
    const { resolver } = setup(buildAccount({ currency: 'USD' }));

    await expect(resolver.resolve(PERSONAL, 1, 'BRL')).rejects.toEqual(currencyMismatch());
  });

  it('reads through the given transactional manager', async () => {
    const { resolver, findOneBy } = setup(null);
    const managerFind = jest.fn(async () => buildAccount());
    const manager = { getRepository: jest.fn(() => ({ findOneBy: managerFind })) };

    await resolver.resolve(PERSONAL, 1, 'BRL', manager as never);

    expect(manager.getRepository).toHaveBeenCalledWith(Account);
    expect(managerFind).toHaveBeenCalled();
    expect(findOneBy).not.toHaveBeenCalled();
  });
});

describe('AccountScheduleValidator', () => {
  const setup = () => {
    const resolve = jest.fn(async () => buildAccount());
    const validator = new AccountScheduleValidator({ resolve } as never);

    return { validator, resolve };
  };

  it('checks a sent paying account against the final currency', async () => {
    const { validator, resolve } = setup();

    await validator.validate(PERSONAL, {
      nested: { paying_account_id: 5 },
      prepared: { payingAccountId: 5 },
      currency: 'BRL',
      currencyChanged: false,
    });

    expect(resolve).toHaveBeenCalledWith(PERSONAL, 5, 'BRL');
  });

  it('re-checks a stored paying account when the currency changes', async () => {
    const { validator, resolve } = setup();

    await validator.validate(PERSONAL, { nested: undefined, prepared: { payingAccountId: 5 }, currency: 'USD', currencyChanged: true });

    expect(resolve).toHaveBeenCalledWith(PERSONAL, 5, 'USD');
  });

  it.each([
    ['an unchanged stored paying account', { nested: {}, prepared: { payingAccountId: 5 } }],
    ['a cleared paying account', { nested: { paying_account_id: null }, prepared: { payingAccountId: null } }],
    ['a type without schedule fields', { nested: undefined, prepared: undefined }],
  ])('skips %s', async (_label, fields) => {
    const { validator, resolve } = setup();

    await validator.validate(PERSONAL, { ...fields, currency: 'BRL', currencyChanged: false });

    expect(resolve).not.toHaveBeenCalled();
  });
});
