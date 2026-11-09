import AccountantHandoffController, {
  initialHandoff,
  rangeError,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/AccountantHandoffController.js';
import AccountantClient from '../../../../../../../../../assets/js/client/AccountantClient.js';
import Download from '../../../../../../../../../assets/js/components/resources/bank/common/download.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const ORG = { kind: 'organization', orgId: 5 };
const QUERY = { from: '2026-02-01', to: '2026-02-28', unsentOnly: true };
const CHARGES = [
  {
    id: 7, date: '2026-02-05', description: 'Internet', amount: '-129.90', sent_to_accountant_at: null,
    account: { id: 4, name: 'ISP', bank_name: 'Fiber', provider_tax_id: null, currency: 'BRL' },
  },
  {
    id: 9, date: '2026-02-10', description: 'Hosting', amount: '-20.00', sent_to_accountant_at: null,
    account: { id: 5, name: 'Host', bank_name: null, provider_tax_id: '1', currency: 'USD' },
  },
];

describe('AccountantHandoffController', () => {
  let deps;
  let patches;

  function merged() {
    return Object.assign({}, ...patches);
  }

  beforeEach(() => {
    patches = [];
    deps = {
      context: ORG,
      update: jasmine.createSpy('update').and.callFake((patch) => patches.push(patch)),
      reload: jasmine.createSpy('reload'),
      client: jasmine.createSpyObj('client', ['listCharges', 'markSent']),
      download: jasmine.createSpyObj('download', ['text']),
    };
  });

  describe('initialHandoff', () => {
    it('defaults to the last full month, unsent only, loading', () => {
      expect(initialHandoff(new Date(2026, 2, 15))).toEqual({
        from: '2026-02-01',
        to: '2026-02-28',
        unsentOnly: true,
        charges: null,
        loadedRange: null,
        loading: true,
        error: null,
        notFound: false,
        confirming: false,
        marking: false,
        success: null,
      });
    });

    it('defaults to now', () => {
      expect(initialHandoff().from).toMatch(/^\d{4}-\d{2}-01$/);
    });
  });

  describe('rangeError', () => {
    it('requires both dates', () => {
      expect(rangeError({ from: '', to: '2026-02-28' })).toBe('Choose both dates.');
      expect(rangeError({ from: '2026-02-01', to: '' })).toBe('Choose both dates.');
    });

    it('rejects a start after the end', () => {
      expect(rangeError({ from: '2026-03-01', to: '2026-02-28' })).toBe('The start date must not be after the end date.');
    });

    it('accepts a one-day range', () => {
      expect(rangeError({ from: '2026-02-01', to: '2026-02-01' })).toBeNull();
    });
  });

  describe('#load', () => {
    it('asks for the unsent charges of the range, then shows them', async () => {
      deps.client.listCharges.and.resolveTo({ charges: CHARGES });

      await new AccountantHandoffController(deps).load(QUERY);

      expect(deps.client.listCharges).toHaveBeenCalledWith(ORG, { from: '2026-02-01', to: '2026-02-28', includeSent: false });
      expect(patches[0]).toEqual({ loading: true, error: null });
      expect(merged()).toEqual(jasmine.objectContaining({
        charges: CHARGES, loadedRange: { from: '2026-02-01', to: '2026-02-28' }, loading: false,
      }));
    });

    it('includes the sent charges when Unsent only is off', async () => {
      deps.client.listCharges.and.resolveTo({ charges: [] });

      await new AccountantHandoffController(deps).load({ ...QUERY, unsentOnly: false });

      expect(deps.client.listCharges).toHaveBeenCalledWith(ORG, jasmine.objectContaining({ includeSent: true }));
      expect(merged().charges).toEqual([]);
    });

    it('sends nothing on an invalid range and clears the preview', async () => {
      await new AccountantHandoffController(deps).load({ ...QUERY, from: '2026-03-01' });

      expect(deps.client.listCharges).not.toHaveBeenCalled();
      expect(merged()).toEqual({ charges: null, loadedRange: null, loading: false });
    });

    it('drops a stale answer', async () => {
      deps.client.listCharges.and.resolveTo({ charges: CHARGES });

      await new AccountantHandoffController(deps).load(QUERY, () => false);

      expect(merged().charges).toBeUndefined();
    });

    it('shows the API 400 in the page alert', async () => {
      deps.client.listCharges.and.rejectWith(new ApiError(400, 'The range must not exceed 366 days', 'VALIDATION_FAILED'));

      await new AccountantHandoffController(deps).load(QUERY);

      expect(merged()).toEqual(jasmine.objectContaining({ loading: false, charges: null }));
      expect(merged().error).toEqual(jasmine.objectContaining({ kind: 'validation', messages: ['The range must not exceed 366 days'] }));
      expect(merged().error.retry).toBeUndefined();
    });

    it('offers Retry on a network failure', async () => {
      deps.client.listCharges.and.rejectWith(new Error('offline'));

      await new AccountantHandoffController(deps).load(QUERY);
      merged().error.retry();

      expect(merged().error.kind).toBe('transient');
      expect(deps.reload).toHaveBeenCalled();
    });

    it('reports Not-found on a 404', async () => {
      deps.client.listCharges.and.rejectWith(new ApiError(404, 'Not found'));

      await new AccountantHandoffController(deps).load(QUERY);

      expect(merged()).toEqual(jasmine.objectContaining({ notFound: true, loading: false }));
    });

    it('stops loading when the session expired', async () => {
      deps.client.listCharges.and.resolveTo(undefined);

      await new AccountantHandoffController(deps).load(QUERY);

      expect(merged().loading).toBeFalse();
      expect(merged().charges).toBeUndefined();
    });

    it('reads a reply without charges as empty', async () => {
      deps.client.listCharges.and.resolveTo({});

      await new AccountantHandoffController(deps).load(QUERY);

      expect(merged().charges).toEqual([]);
    });
  });

  describe('#downloadCsv', () => {
    it('downloads exactly the loaded rows, named after the loaded range', () => {
      new AccountantHandoffController(deps).downloadCsv({ charges: CHARGES, loadedRange: { from: '2026-02-01', to: '2026-02-28' } });

      const [filename, text, options] = deps.download.text.calls.mostRecent().args;

      expect(filename).toBe('ward-accountant-2026-02-01-2026-02-28.csv');
      expect(text).toContain('"2026-02-05","ISP","Fiber","","Internet","-129.90","BRL"');
      expect(text).toContain('"2026-02-10","Host","","1","Hosting","-20.00","USD"');
      expect(text.split('\r\n').length).toBe(4);
      expect(options).toEqual({ mimeType: 'text/csv;charset=utf-8' });
    });

    it('downloads a header-only CSV for an empty preview', () => {
      new AccountantHandoffController(deps).downloadCsv({ charges: [], loadedRange: { from: '2026-02-01', to: '2026-02-28' } });

      expect(deps.download.text.calls.mostRecent().args[1].split('\r\n')).toEqual([
        '\uFEFF"Date","Account","Provider","Provider tax id","Description","Amount","Currency"', '',
      ]);
    });

    it('downloads nothing before a preview is loaded', () => {
      new AccountantHandoffController(deps).downloadCsv({ charges: null, loadedRange: null });

      expect(deps.download.text).not.toHaveBeenCalled();
    });
  });

  describe('#markSent', () => {
    it('posts exactly the loaded ids, then reloads and reports the count', async () => {
      deps.client.markSent.and.resolveTo({ charges: [] });

      await new AccountantHandoffController(deps).markSent({ charges: CHARGES });

      expect(deps.client.markSent).toHaveBeenCalledWith(ORG, [7, 9]);
      expect(patches[0]).toEqual({ marking: true, error: null, success: null });
      expect(merged()).toEqual(jasmine.objectContaining({ marking: false, confirming: false, success: '2 charges marked as sent' }));
      expect(deps.reload).toHaveBeenCalled();
    });

    it('posts nothing for an empty preview', async () => {
      await new AccountantHandoffController(deps).markSent({ charges: [] });

      expect(deps.client.markSent).not.toHaveBeenCalled();
      expect(merged()).toEqual({ confirming: false });
    });

    it('neither reloads nor reports when the session expired', async () => {
      deps.client.markSent.and.resolveTo(undefined);

      await new AccountantHandoffController(deps).markSent({ charges: CHARGES });

      expect(merged().success).toBeNull();
      expect(deps.reload).not.toHaveBeenCalled();
    });

    it('offers Retry on a network failure', async () => {
      deps.client.markSent.and.rejectWith(new Error('offline'));

      await new AccountantHandoffController(deps).markSent({ charges: CHARGES });

      expect(merged()).toEqual(jasmine.objectContaining({ marking: false, confirming: false }));

      deps.client.markSent.and.resolveTo({ charges: [] });
      await merged().error.retry();

      expect(deps.client.markSent).toHaveBeenCalledTimes(2);
      expect(deps.reload).toHaveBeenCalled();
    });

    it('shows a 404 with its message instead of Not-found', async () => {
      deps.client.markSent.and.rejectWith(new ApiError(404, 'Transaction not found'));

      await new AccountantHandoffController(deps).markSent({ charges: CHARGES });

      expect(merged().error).toEqual(jasmine.objectContaining({ kind: 'conflict', messages: ['Transaction not found'] }));
    });

    it('shows a 400 as a validation error', async () => {
      deps.client.markSent.and.rejectWith(new ApiError(400, 'Not a charge'));

      await new AccountantHandoffController(deps).markSent({ charges: CHARGES });

      expect(merged().error.kind).toBe('validation');
    });
  });

  it('defaults to the AccountantClient and the Download module', () => {
    const controller = new AccountantHandoffController({ context: ORG, update: () => undefined, reload: () => undefined });

    expect(controller.client).toBe(AccountantClient);
    expect(controller.download).toBe(Download);
  });
});
