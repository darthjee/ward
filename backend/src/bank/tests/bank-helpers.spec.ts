import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { copyEditableFields, nestedObject, ownerColumns, presentFields } from '../account-fields.js';
import { convertAmountInput, parseAmountInput } from '../amount-input.js';
import { isMysqlError, MYSQL_DUPLICATE_ENTRY } from '../mysql-errors.js';
import { buildAccount, ORGANIZATION, PERSONAL } from './account.test-support.js';

describe('account fields', () => {
  it('builds the owner columns from the context', () => {
    expect(ownerColumns(PERSONAL)).toEqual({ userId: 7, organizationId: null });
    expect(ownerColumns(ORGANIZATION)).toEqual({ userId: null, organizationId: 3 });
  });

  it('reads the nested object named after the type', () => {
    expect(nestedObject({ debt: { a: 1 } }, 'debt')).toEqual({ a: 1 });
    expect(nestedObject({}, 'debt')).toBeUndefined();
  });

  it('lists only the fields actually sent', () => {
    expect(presentFields({ name: 'a', notes: undefined, bank_name: null })).toEqual(['name', 'bank_name']);
  });

  it('copies the sent editable fields', () => {
    const account = buildAccount();

    copyEditableFields(account, { account_number: null, branch: undefined, opening_date: '2025-01-01' } as never);

    expect(account).toMatchObject({ accountNumber: null, branch: '0001', openingDate: '2025-01-01' });
  });
});

describe('amount input', () => {
  it('parses into minor units', () => {
    expect(parseAmountInput('amount', '-12.50', 'BRL', { nonZero: true })).toBe(-1250n);
  });

  it('turns an invalid amount into a 400 naming the field', () => {
    expect(() => parseAmountInput('amount', '0', 'BRL', { nonZero: true })).toThrow(
      new BadRequestException('amount must not be zero'),
    );
  });

  it('converts between exponents', () => {
    expect(convertAmountInput('opening_balance', 100n, 'BRL', 'JPY')).toBe(1n);
    expect(() => convertAmountInput('opening_balance', 101n, 'BRL', 'JPY')).toThrow(BadRequestException);
  });

  it('rethrows unexpected errors', () => {
    expect(() => parseAmountInput('amount', '1', 'NOT-A-CODE')).toThrow(RangeError);
  });
});

describe('isMysqlError', () => {
  it('matches the driver error code of a query failure', () => {
    const error = new QueryFailedError('q', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));

    expect(isMysqlError(error, MYSQL_DUPLICATE_ENTRY)).toBe(true);
    expect(isMysqlError(error, 'OTHER')).toBe(false);
  });

  it('ignores anything else', () => {
    expect(isMysqlError(new Error('x'), MYSQL_DUPLICATE_ENTRY)).toBe(false);
    expect(isMysqlError({ driverError: { code: 'ER_DUP_ENTRY' } }, MYSQL_DUPLICATE_ENTRY)).toBe(false);
  });
});
