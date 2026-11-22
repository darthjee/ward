import React from 'react';
import useRecurringBills, {
  loadRecurringBills,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/common/hooks/useRecurringBills.js';
import ProviderBillsClient from '../../../../../../../../../assets/js/client/ProviderBillsClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';
import sessionExpiredError from '../../../../../../../../support/sessionExpiredError.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const PAGE = { provider_bills: [{ id: 1, kind: 'recurring', expected_amount: '200.00' }], pagination: { total_count: 1 } };

describe('useRecurringBills', () => {
  let setRecurring;

  beforeEach(() => {
    setRecurring = jasmine.createSpy('setRecurring');
  });

  it('starts empty, before the page is loaded', () => {
    spyOn(ProviderBillsClient, 'listProviderBills').and.resolveTo(PAGE);
    let result;

    function Probe() {
      result = useRecurringBills({ context: CONTEXT, account: { id: 7, archived_at: null } });
      return null;
    }

    renderedOutput(React.createElement(Probe));

    expect(result).toBeNull();
  });

  describe('loadRecurringBills', () => {
    it('fetches the first page of the recurring bills and stores it', async () => {
      spyOn(ProviderBillsClient, 'listProviderBills').and.resolveTo(PAGE);

      await loadRecurringBills({
        context: CONTEXT, providerId: 7, archived: false, setRecurring,
      });

      expect(ProviderBillsClient.listProviderBills).toHaveBeenCalledWith(CONTEXT, 7, 1, 'recurring');
      expect(setRecurring).toHaveBeenCalledWith(PAGE);
    });

    it('does not fetch for an archived provider', async () => {
      spyOn(ProviderBillsClient, 'listProviderBills');

      await loadRecurringBills({
        context: CONTEXT, providerId: 7, archived: true, setRecurring,
      });

      expect(ProviderBillsClient.listProviderBills).not.toHaveBeenCalled();
      expect(setRecurring).not.toHaveBeenCalled();
    });

    it('drops a late answer', async () => {
      spyOn(ProviderBillsClient, 'listProviderBills').and.resolveTo(PAGE);

      await loadRecurringBills({
        context: CONTEXT, providerId: 7, archived: false, setRecurring,
      }, () => false);

      expect(setRecurring).not.toHaveBeenCalled();
    });

    it('keeps the suggestion empty when the session expired', async () => {
      spyOn(ProviderBillsClient, 'listProviderBills').and.rejectWith(sessionExpiredError());

      await loadRecurringBills({
        context: CONTEXT, providerId: 7, archived: false, setRecurring,
      });

      expect(setRecurring).not.toHaveBeenCalled();
    });

    [
      ['a transient failure', new Error('boom')],
      ['a 404', new ApiError(404, 'Not found', 'NOT_FOUND')],
    ].forEach(([label, error]) => {
      it(`ignores ${label}`, async () => {
        spyOn(ProviderBillsClient, 'listProviderBills').and.rejectWith(error);

        await expectAsync(loadRecurringBills({
          context: CONTEXT, providerId: 7, archived: false, setRecurring,
        })).toBeResolved();

        expect(setRecurring).not.toHaveBeenCalled();
      });
    });
  });
});
