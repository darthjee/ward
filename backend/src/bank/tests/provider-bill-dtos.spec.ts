import { BadRequestException } from '@nestjs/common';
import { StrictValidationPipe } from '../../core/strict-validation.pipe.js';
import { CreateProviderBillDto } from '../dto/create-provider-bill.dto.js';
import { ListProviderBillsQueryDto } from '../dto/list-provider-bills-query.dto.js';
import { UpdateProviderBillDto } from '../dto/update-provider-bill.dto.js';
import type { ProviderBill } from '../entities/provider-bill.entity.js';
import { sameDescription } from '../provider-bill-conflicts.js';
import {
  defaultProviderBillFields,
  mergeProviderBillFields,
  providerBillFieldsOf,
  type ProviderBillInput,
} from '../provider-bill-fields.js';

const pipe = new StrictValidationPipe();

function create(body: Record<string, unknown>): Promise<CreateProviderBillDto> {
  return pipe.transform(body, { type: 'body', metatype: CreateProviderBillDto });
}

function update(body: Record<string, unknown>): Promise<UpdateProviderBillDto> {
  return pipe.transform(body, { type: 'body', metatype: UpdateProviderBillDto });
}

describe('CreateProviderBillDto', () => {
  it('trims the description and accepts both kinds', async () => {
    await expect(create({ kind: 'recurring', description: '  Rent ', due_day: 5 }))
      .resolves.toMatchObject({ description: 'Rent' });
    await expect(create({ kind: 'one_off', description: 'x', due_date: '2026-05-01', expected_amount: '1.00' }))
      .resolves.toBeInstanceOf(CreateProviderBillDto);
  });

  it.each([
    ['missing kind', { description: 'a' }],
    ['unknown kind', { kind: 'weekly', description: 'a' }],
    ['missing description', { kind: 'recurring' }],
    ['blank description', { kind: 'recurring', description: '  ' }],
    ['256-character description', { kind: 'recurring', description: 'a'.repeat(256) }],
    ['2001-character notes', { kind: 'recurring', description: 'a', notes: 'n'.repeat(2001) }],
    ['numeric expected_amount', { kind: 'recurring', description: 'a', expected_amount: 10 }],
    ['due_day 32', { kind: 'recurring', description: 'a', due_day: 32 }],
    ['due_month 13', { kind: 'recurring', description: 'a', due_month: 13 }],
    ['null charge_frequency', { kind: 'recurring', description: 'a', charge_frequency: null }],
    ['weekly frequency', { kind: 'recurring', description: 'a', charge_frequency: 'weekly' }],
    ['malformed bills_from', { kind: 'recurring', description: 'a', bills_from: '2026-02-30' }],
    ['malformed due_date', { kind: 'one_off', description: 'a', due_date: 'x' }],
    ['id', { kind: 'recurring', description: 'a', id: 1 }],
    ['timestamps', { kind: 'recurring', description: 'a', created_at: 'x' }],
    ['owner', { kind: 'recurring', description: 'a', user_id: 1 }],
    ['provider_account_id', { kind: 'recurring', description: 'a', provider_account_id: 1 }],
  ])('rejects a %s with a 400', async (_label, body) => {
    await expect(create(body)).rejects.toThrow(BadRequestException);
  });
});

describe('UpdateProviderBillDto', () => {
  it('accepts an empty body, a kind and a provider', async () => {
    await expect(update({})).resolves.toBeInstanceOf(UpdateProviderBillDto);
    await expect(update({ kind: 'one_off', provider_account_id: 3, notes: null })).resolves.toBeDefined();
  });

  it.each([
    ['null description', { description: null }],
    ['blank description', { description: ' ' }],
    ['null kind', { kind: null }],
    ['null provider', { provider_account_id: null }],
    ['null show_in_calendar', { show_in_calendar: null }],
    ['id', { id: 1 }],
    ['unknown field', { color: 'red' }],
  ])('rejects a %s with a 400', async (_label, body) => {
    await expect(update(body)).rejects.toThrow(BadRequestException);
  });
});

describe('ListProviderBillsQueryDto', () => {
  it('accepts a free kind string', async () => {
    await expect(pipe.transform({ kind: 'whatever' }, { type: 'query', metatype: ListProviderBillsQueryDto }))
      .resolves.toMatchObject({ kind: 'whatever' });
  });
});

describe('mergeProviderBillFields', () => {
  const TODAY = '2026-05-10';
  const merge = (kind: 'recurring' | 'one_off', input: ProviderBillInput, base = defaultProviderBillFields(kind, TODAY)) =>
    mergeProviderBillFields(kind, base, { description: 'd', ...input }, 'BRL');

  it('defaults a recurring bill', () => {
    expect(merge('recurring', { due_day: 5 })).toMatchObject({
      chargeFrequency: 'monthly', billsFrom: TODAY, showInCalendar: true, dueDay: 5, dueMonth: null, dueDate: null, expectedAmount: null,
    });
  });

  it('parses the expected amount in minor units', () => {
    expect(merge('recurring', { due_day: 5, expected_amount: '12.50' }).expectedAmount).toBe(1250n);
  });

  it('builds a one-off', () => {
    expect(merge('one_off', { due_date: '2026-06-01', expected_amount: '9' })).toMatchObject({
      dueDate: '2026-06-01', expectedAmount: 900n, chargeFrequency: null, billsFrom: null, showInCalendar: null,
    });
  });

  it('accepts a yearly bill with a month', () => {
    expect(merge('recurring', { due_day: 5, charge_frequency: 'yearly', due_month: 3 }).dueMonth).toBe(3);
  });

  it.each([
    ['recurring without due_day', 'recurring', {}],
    ['recurring with due_date', 'recurring', { due_day: 1, due_date: '2026-06-01' }],
    ['yearly without due_month', 'recurring', { due_day: 1, charge_frequency: 'yearly' }],
    ['monthly with due_month', 'recurring', { due_day: 1, due_month: 2 }],
    ['recurring zero amount', 'recurring', { due_day: 1, expected_amount: '0' }],
    ['recurring bad amount', 'recurring', { due_day: 1, expected_amount: 'abc' }],
    ['recurring too many decimals', 'recurring', { due_day: 1, expected_amount: '1.001' }],
    ['one-off without due_date', 'one_off', { expected_amount: '1' }],
    ['one-off without amount', 'one_off', { due_date: '2026-06-01' }],
    ['one-off zero amount', 'one_off', { due_date: '2026-06-01', expected_amount: '0' }],
    ['one-off null amount', 'one_off', { due_date: '2026-06-01', expected_amount: null }],
    ['one-off with due_day', 'one_off', { due_date: '2026-06-01', expected_amount: '1', due_day: 3 }],
    ['one-off with frequency', 'one_off', { due_date: '2026-06-01', expected_amount: '1', charge_frequency: 'yearly' }],
    ['one-off with show_in_calendar', 'one_off', { due_date: '2026-06-01', expected_amount: '1', show_in_calendar: true }],
  ] as const)('rejects %s with a 400', (_label, kind, input) => {
    expect(() => merge(kind, input)).toThrow(BadRequestException);
  });

  it('checks the merged state of a PATCH', () => {
    const stored = { ...providerBillFieldsOf(Object.assign({} as ProviderBill, {
      description: 'Rent', notes: null, payingAccountId: null, expectedAmount: null, dueDate: null,
      chargeFrequency: 'monthly', dueDay: 5, dueMonth: null, billsFrom: TODAY, showInCalendar: true,
    })) };

    expect(mergeProviderBillFields('recurring', stored, { due_day: 9 }, 'BRL').dueDay).toBe(9);
    expect(mergeProviderBillFields('recurring', stored, { charge_frequency: 'yearly', due_month: 4 }, 'BRL').dueMonth).toBe(4);
    expect(() => mergeProviderBillFields('recurring', stored, { charge_frequency: 'yearly' }, 'BRL')).toThrow(BadRequestException);
    expect(() => mergeProviderBillFields('recurring', stored, { due_date: '2026-06-01' }, 'BRL')).toThrow(BadRequestException);
  });

  it('clears due_month when a yearly bill turns monthly', () => {
    const yearly = { ...defaultProviderBillFields('recurring', TODAY), dueDay: 1, chargeFrequency: 'yearly', dueMonth: 4 };

    expect(mergeProviderBillFields('recurring', yearly, { charge_frequency: 'monthly' }, 'BRL').dueMonth).toBeNull();
  });
});

describe('sameDescription', () => {
  it('ignores case, accents and surrounding spaces', () => {
    expect(sameDescription(' Água ', 'agua')).toBe(true);
    expect(sameDescription('Rent', 'Rent 2')).toBe(false);
  });
});
