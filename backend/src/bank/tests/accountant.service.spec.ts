import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import type { AccountantChargeRow, ResolvedMarkRow } from '../accountant-charges.query.js';
import { AccountantService } from '../accountant.service.js';
import type { AccountantChargesQueryDto } from '../dto/accountant-charges-query.dto.js';
import { ORGANIZATION, PERSONAL } from './account.test-support.js';

const SENT_AT = new Date('2026-10-01T08:00:00Z');
const NOW = new Date('2026-11-09T12:00:00.789Z');
const NOW_SECOND = new Date('2026-11-09T12:00:00.000Z');

function charge(overrides: Partial<ResolvedMarkRow> = {}): ResolvedMarkRow {
  return { id: 7, amount: -100n, sentToAccountantAt: null, type: 'provider_expense', forAccountant: true, ...overrides };
}

function previewRow(overrides: Partial<AccountantChargeRow> = {}): AccountantChargeRow {
  return {
    id: 7,
    date: '2026-10-05',
    description: 'Charge',
    amount: -12990n,
    sentToAccountantAt: null,
    accountId: 12,
    accountName: 'Vivo Fibra',
    bankName: 'Vivo',
    providerTaxId: '02.558.157/0001-62',
    currency: 'BRL',
    ...overrides,
  };
}

function setup(resolved: ResolvedMarkRow[] = [], preview: AccountantChargeRow[] = []) {
  const manager = { name: 'tx-manager' };
  const events: string[] = [];
  const transaction = jest.fn(async <R>(work: (m: unknown) => Promise<R>): Promise<R> => {
    events.push('begin');
    const result = await work(manager);
    events.push('commit');
    return result;
  });
  const chargesQuery = {
    preview: jest.fn(async () => preview),
    resolveForUpdate: jest.fn(async () => {
      events.push('resolve');
      return resolved;
    }),
    stamp: jest.fn(async () => {
      events.push('stamp');
    }),
    clear: jest.fn(async () => {
      events.push('clear');
    }),
  };
  const service = new AccountantService({ manager: { transaction } } as never, chargesQuery as never);

  return { service, chargesQuery, manager, transaction, events };
}

const query = (fields: Partial<AccountantChargesQueryDto> = {}): AccountantChargesQueryDto =>
  ({ from: '2026-10-01', to: '2026-10-31', ...fields }) as AccountantChargesQueryDto;

async function rejection(promise: Promise<unknown>): Promise<{ error: unknown; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    const response = (error as BadRequestException).getResponse();
    return { error, body: (typeof response === 'object' ? response : { message: response }) as Record<string, unknown> };
  }
  throw new Error('expected a rejection');
}

describe('AccountantService', () => {
  describe('preview', () => {
    it('serializes the charges with the nested provider account', async () => {
      const { service, chargesQuery } = setup([], [previewRow(), previewRow({ id: 8, currency: 'JPY', amount: -500n, sentToAccountantAt: SENT_AT })]);

      await expect(service.preview(PERSONAL, query())).resolves.toEqual({
        charges: [
          {
            id: 7,
            date: '2026-10-05',
            description: 'Charge',
            amount: '-129.90',
            sent_to_accountant_at: null,
            account: { id: 12, name: 'Vivo Fibra', bank_name: 'Vivo', provider_tax_id: '02.558.157/0001-62', currency: 'BRL' },
          },
          expect.objectContaining({ id: 8, amount: '-500', sent_to_accountant_at: SENT_AT, account: expect.objectContaining({ currency: 'JPY' }) }),
        ],
      });
      expect(chargesQuery.preview).toHaveBeenCalledWith(PERSONAL, '2026-10-01', '2026-10-31', false);
    });

    it('includes sent charges only with include_sent=true', async () => {
      const { service, chargesQuery } = setup();

      await service.preview(ORGANIZATION, query({ include_sent: 'true' }));
      await service.preview(ORGANIZATION, query({ include_sent: 'false' }));

      expect(chargesQuery.preview.mock.calls.map((call) => (call as unknown[])[3])).toEqual([true, false]);
    });

    it('answers an empty list for an empty range', async () => {
      const { service } = setup();

      await expect(service.preview(PERSONAL, query())).resolves.toEqual({ charges: [] });
    });

    it('accepts exactly 1000 charges', async () => {
      const rows = Array.from({ length: 1000 }, (_v, i) => previewRow({ id: i + 1 }));
      const { service } = setup([], rows);

      await expect(service.preview(PERSONAL, query())).resolves.toMatchObject({ charges: expect.any(Array) });
    });

    it('answers 400 VALIDATION_FAILED above 1000 charges', async () => {
      const rows = Array.from({ length: 1001 }, (_v, i) => previewRow({ id: i + 1 }));
      const { service } = setup([], rows);

      const { error, body } = await rejection(service.preview(PERSONAL, query()));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(body).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, message: expect.stringContaining('narrow the range') });
    });

    it.each([
      ['from after to', { from: '2026-10-02', to: '2026-10-01' }],
      ['a range over 366 days', { from: '2025-01-01', to: '2026-01-03' }],
    ])('answers 400 on %s without querying', async (_label, fields) => {
      const { service, chargesQuery } = setup();

      const { error } = await rejection(service.preview(PERSONAL, query(fields)));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(chargesQuery.preview).not.toHaveBeenCalled();
    });
  });

  describe('markSent', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('resolves the de-duplicated ids under the row lock, then stamps them, all in one DB transaction', async () => {
      const { service, chargesQuery, manager, events } = setup([charge({ id: 7 }), charge({ id: 9 })]);

      const result = await service.markSent(PERSONAL, { transaction_ids: [9, 7, 9] });

      expect(chargesQuery.resolveForUpdate).toHaveBeenCalledWith(manager, PERSONAL, [9, 7]);
      expect(chargesQuery.stamp).toHaveBeenCalledWith(manager, [9, 7], NOW_SECOND);
      expect(events).toEqual(['begin', 'resolve', 'stamp', 'commit']);
      expect(result).toEqual({
        charges: [
          { id: 9, sent_to_accountant_at: NOW_SECOND },
          { id: 7, sent_to_accountant_at: NOW_SECOND },
        ],
      });
    });

    it('keeps the original timestamp of an already-sent charge', async () => {
      const { service } = setup([charge({ id: 7, sentToAccountantAt: SENT_AT }), charge({ id: 8 })]);

      await expect(service.markSent(PERSONAL, { transaction_ids: [7, 8] })).resolves.toEqual({
        charges: [
          { id: 7, sent_to_accountant_at: SENT_AT },
          { id: 8, sent_to_accountant_at: NOW_SECOND },
        ],
      });
    });

    it('stamps a charge of an archived account (no archived check)', async () => {
      const { service, chargesQuery } = setup([charge()]);

      await service.markSent(ORGANIZATION, { transaction_ids: [7] });

      expect(chargesQuery.stamp).toHaveBeenCalled();
    });

    it('answers 404 when any id is unresolved, writing nothing', async () => {
      const { service, chargesQuery } = setup([charge({ id: 7 })]);

      await expect(service.markSent(PERSONAL, { transaction_ids: [7, 99] })).rejects.toThrow(NotFoundException);
      expect(chargesQuery.stamp).not.toHaveBeenCalled();
    });

    it('answers 404 before 400 when the request mixes both', async () => {
      const { service, chargesQuery } = setup([charge({ id: 7, amount: 100n })]);

      await expect(service.markSent(PERSONAL, { transaction_ids: [7, 99] })).rejects.toThrow(NotFoundException);
      expect(chargesQuery.stamp).not.toHaveBeenCalled();
    });

    it.each([
      ['a payment', charge({ id: 8, amount: 100n })],
      ['an unflagged charge', charge({ id: 8, forAccountant: false })],
      ['a regular charge', charge({ id: 8, type: 'regular', forAccountant: null })],
      ['a debt charge', charge({ id: 8, type: 'debt', forAccountant: null })],
      ['an investment charge', charge({ id: 8, type: 'investment', forAccountant: null })],
    ])('answers 400 for %s, naming it, writing nothing', async (_label, rejected) => {
      const { service, chargesQuery } = setup([charge({ id: 7 }), rejected]);

      const { error, body } = await rejection(service.markSent(PERSONAL, { transaction_ids: [7, 8] }));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(body).toEqual({ code: ErrorCodes.VALIDATION_FAILED, message: 'transaction 8 is not a hand-off charge' });
      expect(chargesQuery.stamp).not.toHaveBeenCalled();
    });

    it('names every rejected id, sorted', async () => {
      const { service } = setup([charge({ id: 9, amount: 1n }), charge({ id: 5 }), charge({ id: 7, forAccountant: false })]);

      const { body } = await rejection(service.markSent(PERSONAL, { transaction_ids: [9, 5, 7] }));

      expect(body.message).toBe('transactions 7, 9 are not hand-off charges');
    });
  });

  describe('markUnsent', () => {
    it('clears the de-duplicated ids under the row lock and returns null marks', async () => {
      const { service, chargesQuery, manager, events } = setup([charge({ id: 7, sentToAccountantAt: SENT_AT }), charge({ id: 8 })]);

      const result = await service.markUnsent(PERSONAL, { transaction_ids: [7, 8, 7] });

      expect(chargesQuery.resolveForUpdate).toHaveBeenCalledWith(manager, PERSONAL, [7, 8]);
      expect(chargesQuery.clear).toHaveBeenCalledWith(manager, [7, 8]);
      expect(chargesQuery.stamp).not.toHaveBeenCalled();
      expect(events).toEqual(['begin', 'resolve', 'clear', 'commit']);
      expect(result).toEqual({
        charges: [
          { id: 7, sent_to_accountant_at: null },
          { id: 8, sent_to_accountant_at: null },
        ],
      });
    });

    it('un-marks a charge of an unflagged provider account', async () => {
      const { service, chargesQuery } = setup([charge({ forAccountant: false, sentToAccountantAt: SENT_AT })]);

      await expect(service.markUnsent(PERSONAL, { transaction_ids: [7] })).resolves.toEqual({
        charges: [{ id: 7, sent_to_accountant_at: null }],
      });
      expect(chargesQuery.clear).toHaveBeenCalled();
    });

    it.each([
      ['a payment', charge({ amount: 100n })],
      ['a regular charge', charge({ type: 'regular', forAccountant: null })],
    ])('answers 400 for %s, writing nothing', async (_label, rejected) => {
      const { service, chargesQuery } = setup([rejected]);

      await expect(service.markUnsent(PERSONAL, { transaction_ids: [7] })).rejects.toThrow(BadRequestException);
      expect(chargesQuery.clear).not.toHaveBeenCalled();
    });

    it('answers 404 for an unresolved id, writing nothing', async () => {
      const { service, chargesQuery } = setup([]);

      await expect(service.markUnsent(PERSONAL, { transaction_ids: [7] })).rejects.toThrow(NotFoundException);
      expect(chargesQuery.clear).not.toHaveBeenCalled();
    });
  });
});
