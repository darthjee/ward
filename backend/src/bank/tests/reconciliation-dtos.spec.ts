import { BadRequestException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import { StrictValidationPipe } from '../../core/strict-validation.pipe.js';
import {
  CreateReconciliationDto,
  EmptyReconciliationBodyDto,
  RECONCILIATION_TICK_MAX_IDS,
  ReconciliationTicksDto,
  UpdateReconciliationDto,
} from '../dto/reconciliation.dto.js';
import { normalizeTicks } from '../reconciliation-ticks.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const pipe = new StrictValidationPipe();
const parse = <T>(metatype: new () => T, body: unknown): Promise<T> =>
  pipe.transform(body, { type: 'body', metatype });
const ids = (count: number): number[] => Array.from({ length: count }, (_v, i) => i + 1);

describe('CreateReconciliationDto', () => {
  it('accepts a date up to UTC today + 1 day and a balance string', async () => {
    await expect(parse(CreateReconciliationDto, { statement_date: isoDay(1), statement_balance: '10.50' })).resolves
      .toBeInstanceOf(CreateReconciliationDto);
  });

  it.each([
    ['a missing date', { statement_balance: '1' }],
    ['a missing balance', { statement_date: '2026-01-01' }],
    ['a date after today + 1 day', { statement_date: isoDay(2), statement_balance: '1' }],
    ['an impossible date', { statement_date: '2026-02-30', statement_balance: '1' }],
    ['a numeric balance', { statement_date: '2026-01-01', statement_balance: 1 }],
    ['a null balance', { statement_date: '2026-01-01', statement_balance: null }],
    ['an unknown field', { statement_date: '2026-01-01', statement_balance: '1', color: 'red' }],
    ['account_id', { statement_date: '2026-01-01', statement_balance: '1', account_id: 1 }],
    ['status', { statement_date: '2026-01-01', statement_balance: '1', status: 'finished' }],
    ['reconciled_at', { statement_date: '2026-01-01', statement_balance: '1', reconciled_at: '2026-01-01' }],
    ['reconciliation_id', { statement_date: '2026-01-01', statement_balance: '1', reconciliation_id: 1 }],
    ['reconciliation', { statement_date: '2026-01-01', statement_balance: '1', reconciliation: {} }],
  ])('rejects %s', async (_label, body) => {
    await expect(parse(CreateReconciliationDto, body)).rejects.toThrow(BadRequestException);
  });
});

describe('UpdateReconciliationDto', () => {
  it.each([{}, { statement_date: '2026-01-01' }, { statement_balance: '5' }])('accepts %j', async (body) => {
    await expect(parse(UpdateReconciliationDto, body)).resolves.toBeInstanceOf(UpdateReconciliationDto);
  });

  it.each([
    ['a date after today + 1 day', { statement_date: isoDay(2) }],
    ['a null date', { statement_date: null }],
    ['a null balance', { statement_balance: null }],
    ['a numeric balance', { statement_balance: 5 }],
    ['an unknown field', { color: 'red' }],
    ['status', { status: 'finished' }],
  ])('rejects %s', async (_label, body) => {
    await expect(parse(UpdateReconciliationDto, body)).rejects.toThrow(BadRequestException);
  });
});

describe('ReconciliationTicksDto', () => {
  it('caps each array at 50 raw ids, duplicates included', async () => {
    expect(RECONCILIATION_TICK_MAX_IDS).toBe(50);
    await expect(parse(ReconciliationTicksDto, { tick: ids(50) })).resolves.toBeInstanceOf(ReconciliationTicksDto);
    await expect(parse(ReconciliationTicksDto, { tick: Array(50).fill(7) })).resolves.toBeInstanceOf(
      ReconciliationTicksDto,
    );
    await expect(parse(ReconciliationTicksDto, { untick: [2147483647] })).resolves.toBeInstanceOf(
      ReconciliationTicksDto,
    );
  });

  it('defaults a missing array to []', async () => {
    await expect(parse(ReconciliationTicksDto, { tick: [1] })).resolves.toMatchObject({ tick: [1], untick: [] });
    await expect(parse(ReconciliationTicksDto, { untick: [1] })).resolves.toMatchObject({ tick: [], untick: [1] });
  });

  it.each([
    ['51 raw ids in tick', { tick: ids(51) }],
    ['51 raw ids in untick', { untick: ids(51) }],
    ['51 duplicate ids', { tick: Array(51).fill(7) }],
    ['a non-array', { tick: 7 }],
    ['a null array', { tick: null }],
    ['a fractional id', { tick: [1.5] }],
    ['a string id', { tick: ['7'] }],
    ['a zero id', { untick: [0] }],
    ['a negative id', { untick: [-1] }],
    ['an id over MAX_ID', { tick: [2147483648] }],
    ['an unknown field', { tick: [1], color: 'red' }],
    ['a transaction_ids field', { tick: [1], transaction_ids: [1] }],
  ])('rejects %s', async (_label, body) => {
    await expect(parse(ReconciliationTicksDto, body)).rejects.toThrow(BadRequestException);
  });
});

describe('EmptyReconciliationBodyDto', () => {
  it('accepts {}', async () => {
    await expect(parse(EmptyReconciliationBodyDto, {})).resolves.toBeInstanceOf(EmptyReconciliationBodyDto);
  });

  it.each([{ status: 'finished' }, { color: 'red' }, { statement_balance: '1' }])('rejects %j', async (body) => {
    await expect(parse(EmptyReconciliationBodyDto, body)).rejects.toThrow(BadRequestException);
  });
});

describe('normalizeTicks', () => {
  const dto = (tick: number[], untick: number[]): ReconciliationTicksDto =>
    Object.assign(new ReconciliationTicksDto(), { tick, untick });

  const failureOf = (body: ReconciliationTicksDto): BadRequestException => {
    try {
      normalizeTicks(body);
    } catch (error) {
      return error as BadRequestException;
    }
    throw new Error('expected a rejection');
  };

  it('de-duplicates each array', () => {
    expect(normalizeTicks(dto([3, 1, 3], [2, 2]))).toEqual({ tick: [3, 1], untick: [2] });
  });

  it('accepts a single non-empty array', () => {
    expect(normalizeTicks(dto([1], []))).toEqual({ tick: [1], untick: [] });
    expect(normalizeTicks(dto([], [1]))).toEqual({ tick: [], untick: [1] });
  });

  it('rejects two empty arrays with a fixed 400', () => {
    const error = failureOf(dto([], []));

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual({
      code: ErrorCodes.VALIDATION_FAILED,
      message: 'At least one transaction must be ticked or unticked.',
    });
  });

  it('rejects overlapping arrays with a fixed 400 that does not echo the ids', () => {
    const error = failureOf(dto([41, 42], [42]));

    expect(error.getResponse()).toEqual({
      code: ErrorCodes.VALIDATION_FAILED,
      message: 'A transaction cannot be ticked and unticked in the same request.',
    });
    expect(JSON.stringify(error.getResponse())).not.toContain('42');
  });

  it('tolerates missing arrays', () => {
    expect(normalizeTicks({ tick: [5] } as ReconciliationTicksDto)).toEqual({ tick: [5], untick: [] });
  });
});
