import { BadRequestException } from '@nestjs/common';
import { buildAccount } from './account.test-support.js';
import { AccountTypeRegistry } from '../account-types/account-type.registry.js';
import { DebtAccountHandler } from '../account-types/debt-account.handler.js';
import { InvestmentAccountHandler } from '../account-types/investment-account.handler.js';
import { ProviderExpenseAccountHandler } from '../account-types/provider-expense-account.handler.js';
import { RegularAccountHandler } from '../account-types/regular-account.handler.js';

const allHandlers = (): AccountTypeRegistry => new AccountTypeRegistry([
  new RegularAccountHandler(),
  new DebtAccountHandler(),
  new InvestmentAccountHandler(),
  new ProviderExpenseAccountHandler(),
]);

describe('AccountTypeRegistry', () => {
  const registry = new AccountTypeRegistry([new RegularAccountHandler()]);

  it('returns the regular handler', () => {
    expect(registry.get('regular')).toBeInstanceOf(RegularAccountHandler);
  });

  it.each(['savings', 'nope', 'unknown', ''])('rejects %p (unknown type) with a 400', (type) => {
    expect(() => registry.get(type)).toThrow(BadRequestException);
    expect(() => allHandlers().get(type)).toThrow(BadRequestException);
  });

  it('rejects a type whose handler is not registered', () => {
    expect(() => registry.get('debt')).toThrow(BadRequestException);
  });

  it.each([
    ['regular', RegularAccountHandler],
    ['debt', DebtAccountHandler],
    ['investment', InvestmentAccountHandler],
    ['provider_expense', ProviderExpenseAccountHandler],
  ])('resolves %p once every handler is registered', (type, handler) => {
    expect(allHandlers().get(type)).toBeInstanceOf(handler);
  });

  describe('assertNoForeignNested with provider_expense registered', () => {
    const all = allHandlers();

    it.each([
      ['a provider_expense object on a regular account', { provider_expense: {} }, 'regular'],
      ['a provider_expense object on a debt account', { provider_expense: { due_day: 1 } }, 'debt'],
      ['a provider_expense object on an investment account', { provider_expense: {} }, 'investment'],
      ['a debt object on a provider_expense account', { debt: {} }, 'provider_expense'],
      ['an investment object on a provider_expense account', { investment: {} }, 'provider_expense'],
    ])('rejects %s', (_label, dto, type) => {
      expect(() => all.assertNoForeignNested(dto, type)).toThrow(BadRequestException);
    });

    it('accepts a provider_expense object on a provider_expense account', () => {
      expect(() => all.assertNoForeignNested({ provider_expense: {} }, 'provider_expense')).not.toThrow();
    });
  });

  describe('assertNoForeignNested with investment registered', () => {
    const all = new AccountTypeRegistry([new RegularAccountHandler(), new DebtAccountHandler(), new InvestmentAccountHandler()]);

    it.each([
      ['an investment object on a regular account', { investment: {} }, 'regular'],
      ['an investment object on a debt account', { investment: { kind: 'fund' } }, 'debt'],
      ['a debt object on an investment account', { debt: {} }, 'investment'],
    ])('rejects %s', (_label, dto, type) => {
      expect(() => all.assertNoForeignNested(dto, type)).toThrow(BadRequestException);
    });

    it('accepts an investment object on an investment account', () => {
      expect(() => all.assertNoForeignNested({ investment: {} }, 'investment')).not.toThrow();
    });
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

  it('has no account-level rule', () => {
    expect(() => handler.validateAccount()).not.toThrow();
  });

  it('has no details', async () => {
    await expect(handler.loadDetails()).resolves.toEqual(new Map());
    await expect(handler.saveDetails()).resolves.toBeUndefined();
    expect(handler.serialize()).toBeUndefined();
  });
});
