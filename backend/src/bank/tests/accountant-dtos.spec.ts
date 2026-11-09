import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import { StrictValidationPipe } from '../../core/strict-validation.pipe.js';
import {
  AccountantChargesQueryDto,
  assertHandOffRange,
  handOffValidationFailed,
} from '../dto/accountant-charges-query.dto.js';
import { MarkChargesDto } from '../dto/mark-charges.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

describe('AccountantChargesQueryDto', () => {
  const queryPipe = new ValidationPipe({ whitelist: true, transform: true });
  const parse = (query: Record<string, unknown>) =>
    queryPipe.transform(query, { type: 'query', metatype: AccountantChargesQueryDto });

  it('accepts from, to and include_sent', async () => {
    await expect(parse({ from: '2026-01-01', to: '2026-01-31', include_sent: 'true' })).resolves.toMatchObject({
      from: '2026-01-01',
      to: '2026-01-31',
      include_sent: 'true',
    });
  });

  it('accepts dates up to UTC today + 1 day and a missing include_sent', async () => {
    const parsed = await parse({ from: isoDay(1), to: isoDay(1) });

    expect(parsed).toMatchObject({ from: isoDay(1), to: isoDay(1) });
    expect(parsed.include_sent).toBeUndefined();
  });

  it('strips unknown parameters', async () => {
    await expect(parse({ from: '2026-01-01', to: '2026-01-31', color: 'red' })).resolves.not.toHaveProperty('color');
  });

  it.each([
    ['a missing from', { to: '2026-01-31' }],
    ['a missing to', { from: '2026-01-01' }],
    ['a malformed from', { from: '01/01/2026', to: '2026-01-31' }],
    ['an impossible to', { from: '2026-01-01', to: '2026-02-30' }],
    ['a from after UTC today + 1 day', { from: isoDay(2), to: isoDay(2) }],
    ['a to after UTC today + 1 day', { from: '2026-01-01', to: isoDay(2) }],
    ['include_sent=1', { from: '2026-01-01', to: '2026-01-31', include_sent: '1' }],
    ['include_sent=yes', { from: '2026-01-01', to: '2026-01-31', include_sent: 'yes' }],
    ['a repeated from', { from: ['2026-01-01', '2026-01-02'], to: '2026-01-31' }],
    ['a repeated include_sent', { from: '2026-01-01', to: '2026-01-31', include_sent: ['true', 'false'] }],
  ])('rejects %s', async (_label, query) => {
    await expect(parse(query)).rejects.toThrow(BadRequestException);
  });
});

describe('assertHandOffRange', () => {
  it.each([
    ['a single day', '2026-01-01', '2026-01-01'],
    ['a month', '2026-01-01', '2026-01-31'],
    ['exactly 366 days', '2026-01-01', '2027-01-02'],
    ['366 days over a leap day', '2028-01-01', '2029-01-01'],
  ])('accepts %s', (_label, from, to) => {
    expect(() => assertHandOffRange(from, to)).not.toThrow();
  });

  it.each([
    ['from after to', '2026-01-02', '2026-01-01'],
    ['367 days', '2026-01-01', '2027-01-03'],
  ])('rejects %s with VALIDATION_FAILED', (_label, from, to) => {
    try {
      assertHandOffRange(from, to);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
      return;
    }
    throw new Error('expected a rejection');
  });
});

describe('handOffValidationFailed', () => {
  it('builds a 400 with the VALIDATION_FAILED code and the message', () => {
    const error = handOffValidationFailed('nope');

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toEqual({ code: ErrorCodes.VALIDATION_FAILED, message: 'nope' });
  });
});

describe('MarkChargesDto', () => {
  const pipe = new StrictValidationPipe();
  const parse = (body: Record<string, unknown>): Promise<MarkChargesDto> =>
    pipe.transform(body, { type: 'body', metatype: MarkChargesDto });

  it('accepts 1 to 1000 positive ids, duplicates included', async () => {
    await expect(parse({ transaction_ids: [7, 7, 9] })).resolves.toMatchObject({ transaction_ids: [7, 7, 9] });
    await expect(parse({ transaction_ids: Array.from({ length: 1000 }, (_v, i) => i + 1) })).resolves.toBeInstanceOf(
      MarkChargesDto,
    );
    await expect(parse({ transaction_ids: [2147483647] })).resolves.toBeInstanceOf(MarkChargesDto);
  });

  it.each([
    ['a missing list', {}],
    ['a null list', { transaction_ids: null }],
    ['a non-array', { transaction_ids: 7 }],
    ['an empty list', { transaction_ids: [] }],
    ['1001 ids', { transaction_ids: Array.from({ length: 1001 }, (_v, i) => i + 1) }],
    ['a zero id', { transaction_ids: [0] }],
    ['a negative id', { transaction_ids: [-1] }],
    ['a fractional id', { transaction_ids: [1.5] }],
    ['a string id', { transaction_ids: ['7'] }],
    ['a null id', { transaction_ids: [null] }],
    ['an id over MAX_ID', { transaction_ids: [2147483648] }],
    ['an unknown field', { transaction_ids: [1], color: 'red' }],
    ['sent_to_accountant_at', { transaction_ids: [1], sent_to_accountant_at: '2026-01-01T00:00:00Z' }],
  ])('rejects %s', async (_label, body) => {
    await expect(parse(body)).rejects.toThrow(BadRequestException);
  });
});
