import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import {
  accountArchived,
  accountHasTransactions,
  accountNameTaken,
  currencyLocked,
  mapNameClash,
} from '../account-conflicts.js';
import { trimToNull } from '../dto/field-validators.js';
import { bigintTransformer } from '../entities/bigint.transformer.js';

describe('bigintTransformer', () => {
  it('writes bigints as decimal strings and keeps null/undefined', () => {
    expect(bigintTransformer.to(-12345678901234567n)).toBe('-12345678901234567');
    expect(bigintTransformer.to(null)).toBeNull();
    expect(bigintTransformer.to(undefined)).toBeUndefined();
  });

  it('reads MySQL strings (and numbers) as bigints, never through a float', () => {
    expect(bigintTransformer.from('9007199254740993')).toBe(9007199254740993n);
    expect(bigintTransformer.from(42)).toBe(42n);
    expect(bigintTransformer.from(null)).toBeNull();
  });
});

describe('trimToNull', () => {
  it('trims, blanks to null and leaves non-strings alone', () => {
    expect(trimToNull({ value: ' a ' })).toBe('a');
    expect(trimToNull({ value: '  ' })).toBeNull();
    expect(trimToNull({ value: 5 })).toBe(5);
  });
});

describe('account conflicts', () => {
  it.each([
    [accountNameTaken, ErrorCodes.ACCOUNT_NAME_TAKEN],
    [accountHasTransactions, ErrorCodes.ACCOUNT_HAS_TRANSACTIONS],
    [accountArchived, ErrorCodes.ACCOUNT_ARCHIVED],
    [currencyLocked, ErrorCodes.CURRENCY_LOCKED],
  ])('builds a 409 with its code', (build, code) => {
    const exception = build();

    expect(exception).toBeInstanceOf(ConflictException);
    expect(exception.getResponse()).toEqual({ code, message: expect.any(String) });
  });

  it('maps a duplicate entry to ACCOUNT_NAME_TAKEN and passes everything else through', async () => {
    const duplicate = new QueryFailedError('q', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));

    await expect(mapNameClash(async () => 'ok')).resolves.toBe('ok');
    await expect(mapNameClash(async () => { throw duplicate; })).rejects.toThrow(ConflictException);
    await expect(mapNameClash(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
