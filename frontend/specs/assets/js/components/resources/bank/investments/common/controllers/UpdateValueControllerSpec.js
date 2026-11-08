import UpdateValueController, {
  VALUE_UNCHANGED,
  initialUpdateValue,
  validateUpdateValue,
} from '../../../../../../../../../assets/js/components/resources/bank/investments/common/controllers/UpdateValueController.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const NOW = new Date(2026, 4, 10, 12);
const ACCOUNT = { id: 3, balance: '1000.00', currency: 'BRL' };
const ORG = { kind: 'organization', orgId: 5 };

describe('UpdateValueController', () => {
  describe('initialUpdateValue', () => {
    it('starts empty, dated today', () => {
      expect(initialUpdateValue('2026-05-10')).toEqual({
        values: { value: '', date: '2026-05-10' }, errors: {}, pending: false, notice: null, error: null,
      });
    });

    it('defaults to local today', () => {
      expect(initialUpdateValue().values.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('validateUpdateValue', () => {
    it('computes current value − balance exactly', () => {
      expect(validateUpdateValue({ value: '1050,10', date: '2026-05-10' }, ACCOUNT, NOW))
        .toEqual({ errors: {}, amount: '50.10' });
      expect(validateUpdateValue({ value: '999.99', date: '2026-05-10' }, ACCOUNT, NOW).amount).toBe('-0.01');
    });

    it('accepts a zero current value', () => {
      expect(validateUpdateValue({ value: '0', date: '2026-05-10' }, ACCOUNT, NOW).amount).toBe('-1000.00');
    });

    it('rejects a negative, malformed or over-precise value', () => {
      ['-1', 'abc', '1.234', ''].forEach((value) => {
        expect(validateUpdateValue({ value, date: '2026-05-10' }, ACCOUNT, NOW).errors.value).toEqual(jasmine.any(String));
      });
    });

    it('requires a date not after local today', () => {
      expect(validateUpdateValue({ value: '1', date: '' }, ACCOUNT, NOW).errors.date).toBe('Date is required');
      expect(validateUpdateValue({ value: '1', date: '2026-05-11' }, ACCOUNT, NOW))
        .toEqual({ errors: { date: 'Date cannot be in the future' }, amount: null });
    });

    it('uses the current date by default', () => {
      expect(validateUpdateValue({ value: '1', date: '2000-01-01' }, ACCOUNT).errors).toEqual({});
    });
  });

  describe('submit', () => {
    let deps;

    beforeEach(() => {
      deps = {
        context: ORG,
        accountId: 3,
        update: jasmine.createSpy('update'),
        reload: jasmine.createSpy('reload'),
        canDiscard: jasmine.createSpy('canDiscard').and.returnValue(true),
        resetLedgerForm: jasmine.createSpy('resetLedgerForm'),
        client: jasmine.createSpyObj('client', ['createTransaction']),
      };
      deps.client.createTransaction.and.resolveTo({ id: 99 });
    });

    function submit(value, account = ACCOUNT, date = '2026-05-09') {
      return new UpdateValueController(deps).submit({ value, date }, account, NOW);
    }

    it('posts a positive Yield for a gain, then resets and reloads', async () => {
      await submit('1200');

      expect(deps.client.createTransaction).toHaveBeenCalledWith(ORG, 3, { date: '2026-05-09', amount: '200.00', description: 'Yield' });
      expect(deps.update).toHaveBeenCalledWith(jasmine.objectContaining({ pending: true }));
      expect(deps.update).toHaveBeenCalledWith(initialUpdateValue());
      expect(deps.reload).toHaveBeenCalled();
    });

    it('posts a negative Yield for a loss', async () => {
      await submit('950.5');

      expect(deps.client.createTransaction).toHaveBeenCalledWith(ORG, 3, { date: '2026-05-09', amount: '-49.50', description: 'Yield' });
    });

    it('posts against a negative balance', async () => {
      await submit('0', { ...ACCOUNT, balance: '-10.00' });

      expect(deps.client.createTransaction.calls.mostRecent().args[2].amount).toBe('10.00');
    });

    it('posts nothing and shows "Value unchanged" for a zero difference', async () => {
      await submit('1000');

      expect(deps.client.createTransaction).not.toHaveBeenCalled();
      expect(deps.reload).not.toHaveBeenCalled();
      expect(deps.update).toHaveBeenCalledWith({ errors: {}, notice: VALUE_UNCHANGED, error: null });
      expect(VALUE_UNCHANGED).toBe('Value unchanged');
    });

    it('shows the field errors and posts nothing when invalid', async () => {
      await submit('-5');

      expect(deps.client.createTransaction).not.toHaveBeenCalled();
      expect(deps.update).toHaveBeenCalledWith({ errors: { value: jasmine.any(String) }, notice: null });
    });

    it('asks before discarding the inline form, and stops when declined', async () => {
      deps.canDiscard.and.returnValue(false);
      await submit('1200');

      expect(deps.client.createTransaction).not.toHaveBeenCalled();
      expect(deps.resetLedgerForm).not.toHaveBeenCalled();
    });

    it('resets the inline form before posting once confirmed', async () => {
      await submit('1200');

      expect(deps.resetLedgerForm).toHaveBeenCalled();
    });

    it('works with the default discard / reset dependencies', async () => {
      const { canDiscard, resetLedgerForm, ...rest } = deps;

      await new UpdateValueController(rest).submit({ value: '1200', date: '2026-05-09' }, ACCOUNT, NOW);

      expect(canDiscard).not.toHaveBeenCalled();
      expect(resetLedgerForm).not.toHaveBeenCalled();
      expect(deps.client.createTransaction).toHaveBeenCalled();
    });

    it('stops quietly when the session expired', async () => {
      deps.client.createTransaction.and.resolveTo(undefined);
      await submit('1200');

      expect(deps.update).toHaveBeenCalledWith({ pending: false });
      expect(deps.reload).not.toHaveBeenCalled();
    });

    it('shows a transient error with Retry', async () => {
      deps.client.createTransaction.and.rejectWith(new Error('network'));
      await submit('1200');

      const patch = deps.update.calls.mostRecent().args[0];

      expect(patch).toEqual(jasmine.objectContaining({ pending: false, error: jasmine.objectContaining({ kind: 'transient' }) }));
      expect(deps.reload).not.toHaveBeenCalled();

      deps.client.createTransaction.and.resolveTo({ id: 100 });
      await patch.error.retry();

      expect(deps.client.createTransaction).toHaveBeenCalledTimes(2);
      expect(deps.reload).toHaveBeenCalled();
    });

    it('shows a validation error without reloading', async () => {
      deps.client.createTransaction.and.rejectWith(new ApiError(400, 'Bad', 'VALIDATION_FAILED', ['amount is too large']));
      await submit('1200');

      expect(deps.update).toHaveBeenCalledWith({ pending: false, error: jasmine.objectContaining({ kind: 'validation' }) });
      expect(deps.reload).not.toHaveBeenCalled();
    });

    it('shows a conflict and reloads (e.g. archived meanwhile)', async () => {
      deps.client.createTransaction.and.rejectWith(new ApiError(409, 'Archived', 'ACCOUNT_ARCHIVED'));
      await submit('1200');

      expect(deps.update).toHaveBeenCalledWith({ pending: false, error: jasmine.objectContaining({ kind: 'conflict' }) });
      expect(deps.reload).toHaveBeenCalled();
    });
  });
});
