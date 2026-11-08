import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { StrictValidationPipe } from '../../core/strict-validation.pipe.js';
import { CreateAccountDto } from '../dto/create-account.dto.js';
import { DebtDetailsDto } from '../dto/debt-details.dto.js';
import { INVESTMENT_KINDS, InvestmentDetailsDto } from '../dto/investment-details.dto.js';
import { ListAccountsQueryDto } from '../dto/list-accounts-query.dto.js';
import { UpdateAccountDto } from '../dto/update-account.dto.js';

const pipe = new StrictValidationPipe();
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

function create(body: Record<string, unknown>): Promise<CreateAccountDto> {
  return pipe.transform(body, { type: 'body', metatype: CreateAccountDto });
}

function update(body: Record<string, unknown>): Promise<UpdateAccountDto> {
  return pipe.transform(body, { type: 'body', metatype: UpdateAccountDto });
}

describe('CreateAccountDto', () => {
  it('trims the name and blanks optional text to null', async () => {
    const dto = await create({ name: '  Nubank  ', bank_name: '  ', branch: ' 0001 ' });

    expect(dto).toMatchObject({ name: 'Nubank', bank_name: null, branch: '0001' });
  });

  it('accepts a full body', async () => {
    await expect(create({
      type: 'regular',
      name: 'Nubank',
      bank_name: 'Nu',
      branch: '0001',
      account_number: '123',
      currency: 'JPY',
      opening_date: isoDay(1),
      opening_balance: '500',
      notes: 'n'.repeat(2000),
    })).resolves.toBeInstanceOf(CreateAccountDto);
  });

  it('accepts a 255-character name', async () => {
    await expect(create({ name: 'a'.repeat(255) })).resolves.toBeDefined();
  });

  it.each([
    ['missing name', {}],
    ['blank name', { name: '' }],
    ['whitespace-only name', { name: '   ' }],
    ['256-character name', { name: 'a'.repeat(256) }],
    ['65-character bank_name', { name: 'a', bank_name: 'b'.repeat(65) }],
    ['65-character branch', { name: 'a', branch: 'b'.repeat(65) }],
    ['65-character account_number', { name: 'a', account_number: 'b'.repeat(65) }],
    ['2001-character notes', { name: 'a', notes: 'b'.repeat(2001) }],
    ['unsupported currency', { name: 'a', currency: 'XYZ' }],
    ['null currency', { name: 'a', currency: null }],
    ['opening date after tomorrow', { name: 'a', opening_date: isoDay(2) }],
    ['malformed opening date', { name: 'a', opening_date: '2026-02-30' }],
    ['numeric opening balance', { name: 'a', opening_balance: 10 }],
    ['null type', { name: 'a', type: null }],
    ['userId', { name: 'a', userId: 1 }],
    ['user_id', { name: 'a', user_id: 1 }],
    ['organizationId', { name: 'a', organizationId: 1 }],
    ['organization_id', { name: 'a', organization_id: 1 }],
    ['balance', { name: 'a', balance: '1.00' }],
    ['id', { name: 'a', id: 1 }],
    ['unknown field', { name: 'a', color: 'red' }],
  ])('rejects a %s with a 400', async (_label, body) => {
    await expect(create(body)).rejects.toThrow(BadRequestException);
  });
});

describe('UpdateAccountDto', () => {
  it('accepts an empty body and a partial one', async () => {
    await expect(update({})).resolves.toBeInstanceOf(UpdateAccountDto);
    await expect(update({ name: ' New ', notes: null })).resolves.toMatchObject({ name: 'New', notes: null });
  });

  it.each([
    ['type', { type: 'regular' }],
    ['null name', { name: null }],
    ['blank name', { name: ' ' }],
    ['accountId', { accountId: 1 }],
    ['organizationId', { organizationId: 1 }],
    ['over-long notes', { notes: 'x'.repeat(2001) }],
  ])('rejects %s with a 400', async (_label, body) => {
    await expect(update(body)).rejects.toThrow(BadRequestException);
  });
});

describe('nested debt object', () => {
  const FULL_DEBT = {
    interest_rate: '1.99',
    interest_period: 'monthly',
    instalment_amount: '500.00',
    instalment_frequency: 'yearly',
    due_day: 31,
    due_month: 12,
    instalment_count: 1,
  };

  it('transforms debt into a DebtDetailsDto on create and update', async () => {
    const created = await create({ name: 'Loan', type: 'debt', debt: FULL_DEBT });
    const updated = await update({ debt: { due_day: 1 } });

    expect(created.debt).toBeInstanceOf(DebtDetailsDto);
    expect(created.debt).toMatchObject(FULL_DEBT);
    expect(updated.debt).toBeInstanceOf(DebtDetailsDto);
    expect(updated.debt?.instalment_amount).toBeUndefined();
  });

  it.each([
    ['an empty object', {}],
    ['every nullable field cleared', {
      interest_rate: null,
      interest_period: null,
      instalment_amount: null,
      due_day: null,
      due_month: null,
      instalment_count: null,
    }],
    ['a zero rate', { interest_rate: '0' }],
    ['a 100% rate', { interest_rate: '100' }],
    ['a 4-decimal rate', { interest_rate: '99.9999' }],
    ['a 100.0000 rate', { interest_rate: '100.0000' }],
    ['a yearly interest period', { interest_period: 'yearly' }],
    ['due_day 1', { due_day: 1 }],
    ['due_month 1', { due_month: 1 }],
    ['instalment_count at the int column bound', { instalment_count: 2147483647 }],
  ])('accepts %s', async (_label, debt) => {
    await expect(update({ debt })).resolves.toBeInstanceOf(UpdateAccountDto);
    await expect(create({ name: 'a', debt })).resolves.toBeInstanceOf(CreateAccountDto);
  });

  it.each([
    ['null debt', null],
    ['a non-object debt', 'loan'],
    ['an unknown nested key', { color: 'red' }],
    ['an owner key inside debt', { account_id: 1 }],
    ['a numeric rate', { interest_rate: 1.99 }],
    ['a negative rate', { interest_rate: '-1' }],
    ['a rate above 100', { interest_rate: '100.0001' }],
    ['a 5-decimal rate', { interest_rate: '1.00001' }],
    ['a rate with a trailing dot', { interest_rate: '1.' }],
    ['an exponent rate', { interest_rate: '1e2' }],
    ['an unknown interest period', { interest_period: 'weekly' }],
    ['a numeric instalment amount', { instalment_amount: 500 }],
    ['a null instalment frequency', { instalment_frequency: null }],
    ['an unknown instalment frequency', { instalment_frequency: 'daily' }],
    ['due_day 0', { due_day: 0 }],
    ['due_day 32', { due_day: 32 }],
    ['a fractional due_day', { due_day: 1.5 }],
    ['a string due_day', { due_day: '5' }],
    ['due_month 0', { due_month: 0 }],
    ['due_month 13', { due_month: 13 }],
    ['instalment_count 0', { instalment_count: 0 }],
    ['a fractional instalment_count', { instalment_count: 2.5 }],
    ['instalment_count over the int column bound', { instalment_count: 2147483648 }],
  ])('rejects %s with a 400', async (_label, debt) => {
    await expect(update({ debt })).rejects.toThrow(BadRequestException);
    await expect(create({ name: 'a', debt })).rejects.toThrow(BadRequestException);
  });
});

describe('nested investment object', () => {
  const FULL_INVESTMENT = {
    kind: 'fixed_income',
    yield_rate: '12.5',
    yield_period: 'yearly',
    maturity_date: '2030-01-15',
    liquidity_days: 30,
  };

  it('transforms investment into an InvestmentDetailsDto on create and update', async () => {
    const created = await create({ name: 'CDB', type: 'investment', investment: FULL_INVESTMENT });
    const updated = await update({ investment: { liquidity_days: 1 } });

    expect(created.investment).toBeInstanceOf(InvestmentDetailsDto);
    expect(created.investment).toMatchObject(FULL_INVESTMENT);
    expect(updated.investment).toBeInstanceOf(InvestmentDetailsDto);
    expect(updated.investment?.kind).toBeUndefined();
  });

  it('lists the seven kinds', () => {
    expect(INVESTMENT_KINDS).toEqual(['fixed_income', 'fund', 'stocks', 'savings', 'pension', 'crypto', 'other']);
  });

  it.each([
    ['an empty object', {}],
    ['every field cleared', { kind: null, yield_rate: null, yield_period: null, maturity_date: null, liquidity_days: null }],
    ...INVESTMENT_KINDS.map((kind): [string, object] => [`kind ${kind}`, { kind }]),
    ['a zero rate', { yield_rate: '0' }],
    ['a 100% rate', { yield_rate: '100' }],
    ['a 4-decimal rate', { yield_rate: '12.3456' }],
    ['a monthly period', { yield_period: 'monthly' }],
    ['a yearly period', { yield_period: 'yearly' }],
    ['liquidity_days 0', { liquidity_days: 0 }],
    ['liquidity_days at the int column bound', { liquidity_days: 2147483647 }],
    ['a past maturity date', { maturity_date: '2001-01-01' }],
    ['a far-future maturity date', { maturity_date: '2099-12-31' }],
    ['a leap-day maturity date', { maturity_date: '2028-02-29' }],
    ['a maturity date after tomorrow', { maturity_date: isoDay(30) }],
  ])('accepts %s', async (_label, investment) => {
    await expect(update({ investment })).resolves.toBeInstanceOf(UpdateAccountDto);
    await expect(create({ name: 'a', investment })).resolves.toBeInstanceOf(CreateAccountDto);
  });

  it.each([
    ['null investment', null],
    ['a non-object investment', 'cdb'],
    ['an unknown nested key', { color: 'red' }],
    ['an owner key inside investment', { account_id: 1 }],
    ['an unknown kind', { kind: 'bonds' }],
    ['an upper-case kind', { kind: 'FUND' }],
    ['a numeric rate', { yield_rate: 12.5 }],
    ['a negative rate', { yield_rate: '-1' }],
    ['a rate above 100', { yield_rate: '100.0001' }],
    ['a 5-decimal rate', { yield_rate: '1.00001' }],
    ['an unknown yield period', { yield_period: 'daily' }],
    ['a negative liquidity_days', { liquidity_days: -1 }],
    ['a fractional liquidity_days', { liquidity_days: 1.5 }],
    ['a string liquidity_days', { liquidity_days: '1' }],
    ['liquidity_days over the int column bound', { liquidity_days: 2147483648 }],
    ['an impossible maturity date', { maturity_date: '2026-02-30' }],
    ['a malformed maturity date', { maturity_date: '15/01/2030' }],
    ['a maturity datetime', { maturity_date: '2030-01-15T00:00:00Z' }],
    ['a numeric maturity date', { maturity_date: 20300115 }],
  ])('rejects %s with a 400', async (_label, investment) => {
    await expect(update({ investment })).rejects.toThrow(BadRequestException);
    await expect(create({ name: 'a', investment })).rejects.toThrow(BadRequestException);
  });
});

describe('ListAccountsQueryDto', () => {
  const queryPipe = new ValidationPipe({ whitelist: true, transform: true });
  const parse = (query: Record<string, unknown>) =>
    queryPipe.transform(query, { type: 'query', metatype: ListAccountsQueryDto });

  it('accepts type and archived', async () => {
    await expect(parse({ type: 'regular', archived: 'true' })).resolves.toMatchObject({ archived: 'true' });
  });

  it.each([{ archived: 'yes' }, { archived: ['true', 'false'] }, { type: ['a', 'b'] }])('rejects %p', async (query) => {
    await expect(parse(query)).rejects.toThrow(BadRequestException);
  });
});
