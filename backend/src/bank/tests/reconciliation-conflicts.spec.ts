import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import {
  accountReconciled,
  concurrentUpdate,
  mapDeadlock,
  mapOpenClash,
  reconciliationFinished,
  reconciliationNotFinished,
  reconciliationNotLatest,
  reconciliationOpen,
  reconciliationOutOfOrder,
  reconciliationUnbalanced,
  transactionCleared,
  transactionNotEligible,
} from '../reconciliation-conflicts.js';

describe('reconciliation conflicts', () => {
  it.each([
    [reconciliationOpen, ErrorCodes.RECONCILIATION_OPEN, 'This account already has an open reconciliation.'],
    [reconciliationFinished, ErrorCodes.RECONCILIATION_FINISHED, 'This reconciliation is already finished.'],
    [reconciliationNotFinished, ErrorCodes.RECONCILIATION_NOT_FINISHED, 'This reconciliation is not finished.'],
    [reconciliationNotLatest, ErrorCodes.RECONCILIATION_NOT_LATEST, 'Only the latest finished reconciliation can be undone.'],
    [
      reconciliationOutOfOrder,
      ErrorCodes.RECONCILIATION_OUT_OF_ORDER,
      'The statement date must be after the latest finished reconciliation.',
    ],
    [reconciliationUnbalanced, ErrorCodes.RECONCILIATION_UNBALANCED, 'The reconciliation is not balanced.'],
    [
      transactionNotEligible,
      ErrorCodes.TRANSACTION_NOT_ELIGIBLE,
      'A selected transaction cannot be part of this reconciliation.',
    ],
    [transactionCleared, ErrorCodes.TRANSACTION_CLEARED, 'This transaction is part of a finished reconciliation.'],
    [
      accountReconciled,
      ErrorCodes.ACCOUNT_RECONCILED,
      'The opening date and balance cannot change once the account has a reconciliation.',
    ],
    [concurrentUpdate, ErrorCodes.CONCURRENT_UPDATE, 'The request conflicted with another change; please retry.'],
  ])('builds a 409 with its code and fixed message', (build, code, message) => {
    const exception = build();

    expect(exception).toBeInstanceOf(ConflictException);
    expect(exception.getResponse()).toEqual({ code, message });
  });

  describe('mapOpenClash', () => {
    const duplicate = new QueryFailedError('q', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));

    it('passes a successful result through', async () => {
      await expect(mapOpenClash(async () => 'ok')).resolves.toBe('ok');
    });

    it('maps a duplicate entry to 409 RECONCILIATION_OPEN', async () => {
      const failure = await mapOpenClash(async () => { throw duplicate; }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ConflictException);
      expect((failure as ConflictException).getResponse()).toEqual({
        code: ErrorCodes.RECONCILIATION_OPEN,
        message: 'This account already has an open reconciliation.',
      });
    });

    it('rethrows any other error', async () => {
      await expect(mapOpenClash(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    });
  });

  describe('mapDeadlock', () => {
    const deadlock = new QueryFailedError('q', [], Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' }));
    const duplicate = new QueryFailedError('q', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));

    it('passes a successful result through', async () => {
      await expect(mapDeadlock(async () => 'ok')).resolves.toBe('ok');
    });

    it('maps a deadlock to 409 CONCURRENT_UPDATE with fixed text', async () => {
      const failure = await mapDeadlock(async () => { throw deadlock; }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ConflictException);
      expect((failure as ConflictException).getResponse()).toEqual({
        code: ErrorCodes.CONCURRENT_UPDATE,
        message: 'The request conflicted with another change; please retry.',
      });
    });

    it('maps a lock wait timeout to 409 CONCURRENT_UPDATE with the same fixed text', async () => {
      const timeout = new QueryFailedError('q', [], Object.assign(new Error('timeout'), { code: 'ER_LOCK_WAIT_TIMEOUT' }));
      const failure = await mapDeadlock(async () => { throw timeout; }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ConflictException);
      expect((failure as ConflictException).getResponse()).toEqual({
        code: ErrorCodes.CONCURRENT_UPDATE,
        message: 'The request conflicted with another change; please retry.',
      });
    });

    it('passes other MySQL errors through unchanged', async () => {
      await expect(mapDeadlock(async () => { throw duplicate; })).rejects.toBe(duplicate);
    });

    it('rethrows any other error', async () => {
      await expect(mapDeadlock(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    });
  });
});
