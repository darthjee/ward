import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { StrictValidationPipe } from '../../core/strict-validation.pipe.js';
import { CreateAccountDto } from '../dto/create-account.dto.js';
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
