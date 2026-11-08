import { BadRequestException } from '@nestjs/common';
import { buildAccount } from './account.test-support.js';
import { AccountTypeRegistry } from '../account-types/account-type.registry.js';
import { DebtAccountHandler } from '../account-types/debt-account.handler.js';
import { RegularAccountHandler } from '../account-types/regular-account.handler.js';

describe('AccountTypeRegistry', () => {
  const registry = new AccountTypeRegistry([new RegularAccountHandler()]);

  it('returns the regular handler', () => {
    expect(registry.get('regular')).toBeInstanceOf(RegularAccountHandler);
  });

  it.each(['debt', 'investment', 'provider_expense', 'unknown', ''])('rejects %p (no handler) with a 400', (type) => {
    expect(() => registry.get(type)).toThrow(BadRequestException);
  });

  it('resolves debt once its handler is registered', () => {
    const withDebt = new AccountTypeRegistry([new RegularAccountHandler(), new DebtAccountHandler()]);

    expect(withDebt.get('debt')).toBeInstanceOf(DebtAccountHandler);
    expect(() => withDebt.get('investment')).toThrow(BadRequestException);
  });

  describe('assertNoForeignNested', () => {
    const withDebt = new AccountTypeRegistry([new RegularAccountHandler(), new DebtAccountHandler()]);

    it('rejects a debt object on a regular account', () => {
      expect(() => withDebt.assertNoForeignNested({ debt: {} }, 'regular')).toThrow(BadRequestException);
    });

    it('accepts the account\'s own nested object, or none', () => {
      expect(() => withDebt.assertNoForeignNested({ debt: {} }, 'debt')).not.toThrow();
      expect(() => withDebt.assertNoForeignNested({ name: 'a', debt: undefined }, 'regular')).not.toThrow();
    });
  });

  describe('loadDetails', () => {
    it('calls each type\'s handler once with its account ids and merges the results', async () => {
      const debtHandler = new DebtAccountHandler();
      const regularHandler = new RegularAccountHandler();
      const loadDebt = jest.spyOn(debtHandler, 'loadDetails').mockResolvedValue(new Map([[2, 'two'], [3, 'three']]));
      const loadRegular = jest.spyOn(regularHandler, 'loadDetails');
      const withDebt = new AccountTypeRegistry([regularHandler, debtHandler]);
      const manager = {} as never;

      const details = await withDebt.loadDetails([
        buildAccount({ id: 1 }),
        buildAccount({ id: 2, type: 'debt' }),
        buildAccount({ id: 3, type: 'debt' }),
      ], manager);

      expect(loadDebt).toHaveBeenCalledTimes(1);
      expect(loadDebt).toHaveBeenCalledWith([2, 3], manager);
      expect(loadRegular).toHaveBeenCalledTimes(1);
      expect([...details.entries()]).toEqual([[2, 'two'], [3, 'three']]);
    });
  });

  it('registers more handlers by type', () => {
    const other = { ...new RegularAccountHandler(), type: 'debt' } as never;

    expect(new AccountTypeRegistry([new RegularAccountHandler(), other]).get('debt')).toBe(other);
  });
});

describe('RegularAccountHandler', () => {
  const handler = new RegularAccountHandler();

  it('carries a ledger and serves regular', () => {
    expect(handler.type).toBe('regular');
    expect(handler.carriesLedger).toBe(true);
  });

  it('accepts no nested object', () => {
    expect(() => handler.validateCreate(undefined)).not.toThrow();
    expect(() => handler.validateUpdate(undefined)).not.toThrow();
    expect(() => handler.validateCreate({})).toThrow(BadRequestException);
    expect(() => handler.validateUpdate({ a: 1 })).toThrow(BadRequestException);
  });

  it('has no details', async () => {
    await expect(handler.loadDetails()).resolves.toEqual(new Map());
    await expect(handler.saveDetails()).resolves.toBeUndefined();
    expect(handler.serialize()).toBeUndefined();
  });
});
