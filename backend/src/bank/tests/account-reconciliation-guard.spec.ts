import { BadRequestException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import {
  applyCurrencyChange,
  assertAnchorUnlocked,
  hasLockingStatement,
  touchesStatementLockedFields,
} from '../account-reconciliation-guard.js';
import { buildAccount } from './account.test-support.js';
import type { UpdateAccountDto } from '../dto/update-account.dto.js';

const dto = (fields: Partial<UpdateAccountDto>): UpdateAccountDto => fields as UpdateAccountDto;
const codeOf = (action: () => unknown): unknown => {
  try {
    action();
  } catch (error) {
    return (error as { getResponse(): { code?: string } }).getResponse().code;
  }
  throw new Error('expected a throw');
};

describe('touchesStatementLockedFields', () => {
  it.each([{ currency: 'USD' }, { opening_date: '2026-01-02' }, { opening_balance: '1.00' }])('is true for %j', (fields) => {
    expect(touchesStatementLockedFields(dto(fields))).toBe(true);
  });

  it('is false for the other fields', () => {
    expect(touchesStatementLockedFields(dto({ name: 'x', notes: 'y', bank_name: 'z' }))).toBe(false);
  });
});

describe('hasLockingStatement', () => {
  const manager = {} as never;

  it('asks the query inside the write transaction when the body touches the anchor or the currency', async () => {
    const query = { hasAny: jest.fn(async () => true) };

    await expect(hasLockingStatement(query as never, manager, buildAccount({ id: 4 }), dto({ opening_date: '2026-01-02' }))).resolves.toBe(true);
    expect(query.hasAny).toHaveBeenCalledWith(4, manager);
  });

  it('runs no query for a body that touches neither', async () => {
    const query = { hasAny: jest.fn(async () => true) };

    await expect(hasLockingStatement(query as never, manager, buildAccount(), dto({ name: 'x' }))).resolves.toBe(false);
    expect(query.hasAny).not.toHaveBeenCalled();
  });
});

describe('assertAnchorUnlocked', () => {
  const account = buildAccount({ openingDate: '2026-01-01', openingBalance: 100000n });

  it.each([
    ['a new opening_date', { opening_date: '2026-01-02' }],
    ['a new opening_balance', { opening_balance: '1000.01' }],
    ['both', { opening_date: '2026-01-02', opening_balance: '5.00' }],
  ])('answers ACCOUNT_RECONCILED for %s when a statement exists', (_label, fields) => {
    expect(codeOf(() => assertAnchorUnlocked(account, dto(fields), true))).toBe(ErrorCodes.ACCOUNT_RECONCILED);
  });

  it('accepts unchanged values, compared as minor units ("1000" equals "1000.00")', () => {
    expect(() => assertAnchorUnlocked(account, dto({ opening_date: '2026-01-01', opening_balance: '1000' }), true)).not.toThrow();
  });

  it('accepts a body without the anchor fields', () => {
    expect(() => assertAnchorUnlocked(account, dto({ name: 'x' }), true)).not.toThrow();
  });

  it('accepts any change when there is no statement, without parsing the balance', () => {
    expect(() => assertAnchorUnlocked(account, dto({ opening_date: '2026-01-02', opening_balance: 'abc' }), false)).not.toThrow();
  });

  it('answers 400 for a malformed balance when a statement exists', () => {
    expect(() => assertAnchorUnlocked(account, dto({ opening_balance: 'abc' }), true)).toThrow(BadRequestException);
  });
});

describe('applyCurrencyChange', () => {
  const balances = (hasTransactions: boolean) => ({ hasTransactions: jest.fn(async () => hasTransactions) });
  const codeOfAsync = async (promise: Promise<unknown>): Promise<unknown> => {
    try {
      await promise;
    } catch (error) {
      return (error as { getResponse(): { code?: string } }).getResponse().code;
    }
    throw new Error('expected a rejection');
  };

  it('changes the currency, converting the stored opening balance, when nothing locks it', async () => {
    const account = buildAccount({ openingBalance: 1000n });

    await applyCurrencyChange(account, dto({ currency: 'JPY' }), false, balances(false) as never);

    expect(account).toMatchObject({ currency: 'JPY', openingBalance: 10n });
  });

  it('keeps a new opening balance for the service to parse', async () => {
    const account = buildAccount({ openingBalance: 1000n });

    await applyCurrencyChange(account, dto({ currency: 'JPY', opening_balance: '5' }), false, balances(false) as never);

    expect(account).toMatchObject({ currency: 'JPY', openingBalance: 1000n });
  });

  it.each([
    ['a statement', true, false],
    ['a transaction', false, true],
  ])('answers CURRENCY_LOCKED with %s', async (_label, hasStatement, hasTransactions) => {
    const account = buildAccount();

    expect(await codeOfAsync(applyCurrencyChange(account, dto({ currency: 'USD' }), hasStatement, balances(hasTransactions) as never)))
      .toBe(ErrorCodes.CURRENCY_LOCKED);
    expect(account.currency).toBe('BRL');
  });

  it('does nothing, and asks nothing, when the currency is absent or the same', async () => {
    const source = balances(true);
    const account = buildAccount();

    await applyCurrencyChange(account, dto({}), true, source as never);
    await applyCurrencyChange(account, dto({ currency: 'BRL' }), true, source as never);

    expect(source.hasTransactions).not.toHaveBeenCalled();
    expect(account.currency).toBe('BRL');
  });
});
