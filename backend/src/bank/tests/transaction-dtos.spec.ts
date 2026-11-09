import { BadRequestException } from '@nestjs/common';
import { StrictValidationPipe } from '../../core/strict-validation.pipe.js';
import { CreateTransactionDto } from '../dto/create-transaction.dto.js';
import { UpdateTransactionDto } from '../dto/update-transaction.dto.js';

const pipe = new StrictValidationPipe();
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const valid = { date: isoDay(0), amount: '-12.50', description: 'Coffee' };

function create(body: Record<string, unknown>): Promise<CreateTransactionDto> {
  return pipe.transform(body, { type: 'body', metatype: CreateTransactionDto });
}

function update(body: Record<string, unknown>): Promise<UpdateTransactionDto> {
  return pipe.transform(body, { type: 'body', metatype: UpdateTransactionDto });
}

describe('CreateTransactionDto', () => {
  it('accepts a valid body and trims the description', async () => {
    await expect(create({ ...valid, description: '  Coffee ', notes: 'n'.repeat(2000) })).resolves.toMatchObject({
      description: 'Coffee',
    });
  });

  it('accepts UTC today + 1 day and a 255-character description', async () => {
    await expect(create({ ...valid, date: isoDay(1), description: 'd'.repeat(255) })).resolves.toBeDefined();
  });

  it.each([
    ['date after UTC today + 1 day', { date: isoDay(2) }],
    ['missing date', { date: undefined }],
    ['malformed date', { date: '10/01/2026' }],
    ['missing amount', { amount: undefined }],
    ['numeric amount', { amount: 12.5 }],
    ['missing description', { description: undefined }],
    ['blank description', { description: '   ' }],
    ['256-character description', { description: 'd'.repeat(256) }],
    ['2001-character notes', { notes: 'n'.repeat(2001) }],
    ['account_id', { account_id: 2 }],
    ['accountId', { accountId: 2 }],
    ['userId', { userId: 2 }],
    ['organizationId', { organizationId: 2 }],
    ['sent_to_accountant_at', { sent_to_accountant_at: '2026-01-01' }],
    ['sentToAccountantAt', { sentToAccountantAt: '2026-01-01' }],
    ['balance', { balance: '1.00' }],
    ['unknown field', { color: 'red' }],
  ])('rejects a %s with a 400', async (_label, fields) => {
    await expect(create({ ...valid, ...fields })).rejects.toThrow(BadRequestException);
  });
});

describe('UpdateTransactionDto', () => {
  it('accepts a partial body', async () => {
    await expect(update({ notes: null })).resolves.toBeInstanceOf(UpdateTransactionDto);
    await expect(update({ amount: '1' })).resolves.toMatchObject({ amount: '1' });
  });

  it.each([
    ['null amount', { amount: null }],
    ['null date', { date: null }],
    ['future date', { date: isoDay(2) }],
    ['blank description', { description: '' }],
    ['accountId', { accountId: 3 }],
    ['sent_to_accountant_at', { sent_to_accountant_at: '2026-01-01T00:00:00Z' }],
    ['sentToAccountantAt', { sentToAccountantAt: null }],
  ])('rejects a %s with a 400', async (_label, body) => {
    await expect(update(body)).rejects.toThrow(BadRequestException);
  });
});
