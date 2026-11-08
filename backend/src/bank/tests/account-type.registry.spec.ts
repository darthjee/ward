import { BadRequestException } from '@nestjs/common';
import { AccountTypeRegistry } from '../account-types/account-type.registry.js';
import { RegularAccountHandler } from '../account-types/regular-account.handler.js';

describe('AccountTypeRegistry', () => {
  const registry = new AccountTypeRegistry([new RegularAccountHandler()]);

  it('returns the regular handler', () => {
    expect(registry.get('regular')).toBeInstanceOf(RegularAccountHandler);
  });

  it.each(['debt', 'investment', 'provider_expense', 'unknown', ''])('rejects %p (no handler) with a 400', (type) => {
    expect(() => registry.get(type)).toThrow(BadRequestException);
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
