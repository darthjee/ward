import ProviderBillsController, {
  EMPTY_BILLS, RECURRING_PAID_MESSAGE,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/common/controllers/ProviderBillsController.js';
import { BILL_PAID_MESSAGE } from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/controllers/BillFormController.js';
import ProviderBillsClient from '../../../../../../../../../assets/js/client/ProviderBillsClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const CONTEXT = { kind: 'personal' };
const RECURRING = { id: 4, kind: 'recurring' };
const ONE_OFF = { id: 5, kind: 'one_off' };

describe('ProviderBillsController', () => {
  let client;
  let deps;

  function build() {
    return new ProviderBillsController({ ...deps, client });
  }

  beforeEach(() => {
    client = {
      listProviderBills: jasmine.createSpy('listProviderBills').and.resolveTo({ provider_bills: [RECURRING], pagination: {} }),
      deleteProviderBill: jasmine.createSpy('deleteProviderBill').and.resolveTo({}),
    };
    deps = {
      context: CONTEXT,
      providerId: 7,
      setData: jasmine.createSpy('setData'),
      setError: jasmine.createSpy('setError'),
      setPending: jasmine.createSpy('setPending'),
      setConfirmation: jasmine.createSpy('setConfirmation'),
      reload: jasmine.createSpy('reload'),
    };
  });

  it('defaults to the provider bills client', () => {
    expect(new ProviderBillsController(deps).client).toBe(ProviderBillsClient);
  });

  describe('load', () => {
    it('loads the requested page', async () => {
      await build().load(2);

      expect(client.listProviderBills).toHaveBeenCalledWith(CONTEXT, 7, 2);
      expect(deps.setData).toHaveBeenCalled();
    });

    it('shows an empty page on a not-found', async () => {
      client.listProviderBills.and.rejectWith(new ApiError(404, 'Not found'));
      await build().load(1);

      expect(deps.setData).toHaveBeenCalledWith(EMPTY_BILLS);
    });

    it('reports a failure with a retry that reloads', async () => {
      client.listProviderBills.and.rejectWith(new ApiError(503, 'Down'));
      await build().load(1);
      deps.setError.calls.mostRecent().args[0].retry();

      expect(deps.reload).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes, closes the confirmation and reloads', async () => {
      await build().delete(RECURRING);

      expect(client.deleteProviderBill).toHaveBeenCalledWith(CONTEXT, 4);
      expect(deps.setConfirmation).toHaveBeenCalledWith(null);
      expect(deps.reload).toHaveBeenCalled();
    });

    it('does not reload when the session expired', async () => {
      client.deleteProviderBill.and.resolveTo(undefined);
      await build().delete(RECURRING);

      expect(deps.reload).not.toHaveBeenCalled();
    });

    it('explains a recurring bill with payments', async () => {
      client.deleteProviderBill.and.rejectWith(new ApiError(409, 'x', 'PROVIDER_BILL_PAID'));
      await build().delete(RECURRING);

      expect(deps.setError.calls.mostRecent().args[0].message).toBe(RECURRING_PAID_MESSAGE);
    });

    it('explains a paid one-off bill', async () => {
      client.deleteProviderBill.and.rejectWith(new ApiError(409, 'x', 'PROVIDER_BILL_PAID'));
      await build().delete(ONE_OFF);

      expect(deps.setError.calls.mostRecent().args[0].message).toBe(BILL_PAID_MESSAGE);
    });

    it('offers a retry on a transient failure', async () => {
      client.deleteProviderBill.and.rejectWith(new ApiError(500, 'Down'));
      await build().delete(RECURRING);
      client.deleteProviderBill.and.resolveTo({});
      await deps.setError.calls.mostRecent().args[0].retry();

      expect(client.deleteProviderBill).toHaveBeenCalledTimes(2);
    });

    it('shows a not-found like a conflict and reloads', async () => {
      client.deleteProviderBill.and.rejectWith(new ApiError(404, 'Gone'));
      await build().delete(RECURRING);

      expect(deps.setError.calls.mostRecent().args[0].kind).toBe('conflict');
      expect(deps.reload).toHaveBeenCalled();
    });

    it('shows other failures with the server message', async () => {
      client.deleteProviderBill.and.rejectWith(new ApiError(409, 'Nope', 'OTHER'));
      await build().delete(RECURRING);

      expect(deps.setError.calls.mostRecent().args[0].message).toBe('Nope');
    });
  });
});
