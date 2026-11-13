import React from 'react';
import usePayingAccounts, {
  buildPayingAccountsLoadEffect,
} from '../../../../../../../../../assets/js/components/resources/bank/common/form/hooks/usePayingAccounts.js';
import BankClient from '../../../../../../../../../assets/js/client/BankClient.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';
import { flushMicrotasks } from '../../../../../../../../support/flushMicrotasks.js';

const CONTEXT = { kind: 'organization', orgId: 5 };

describe('usePayingAccounts', () => {
  it('starts with no accounts (loading)', () => {
    let accounts;

    function Probe() {
      accounts = usePayingAccounts(CONTEXT);
      return null;
    }

    renderedOutput(React.createElement(Probe));

    expect(accounts).toBeNull();
  });

  describe('buildPayingAccountsLoadEffect', () => {
    it('loads the non-archived regular accounts', async () => {
      const client = { listAccounts: jasmine.createSpy('listAccounts').and.resolveTo([{ id: 1 }]) };
      const setAccounts = jasmine.createSpy('setAccounts');

      buildPayingAccountsLoadEffect(CONTEXT, setAccounts, client)();
      await flushMicrotasks();

      expect(client.listAccounts).toHaveBeenCalledWith(CONTEXT, { type: 'regular' });
      expect(setAccounts).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('defaults to the bank client', async () => {
      spyOn(BankClient, 'listAccounts').and.resolveTo([]);

      buildPayingAccountsLoadEffect(CONTEXT, () => undefined)();
      await flushMicrotasks();

      expect(BankClient.listAccounts).toHaveBeenCalled();
    });

    [
      ['a failure', new ApiError(500, 'Boom')],
      ['a not-found', new ApiError(404, 'Not found')],
    ].forEach(([label, error]) => {
      it(`falls back to no accounts on ${label}`, async () => {
        const client = { listAccounts: jasmine.createSpy('listAccounts').and.rejectWith(error) };
        const setAccounts = jasmine.createSpy('setAccounts');

        buildPayingAccountsLoadEffect(CONTEXT, setAccounts, client)();
        await flushMicrotasks();

        expect(setAccounts).toHaveBeenCalledWith([]);
      });
    });

    it('drops a late answer', async () => {
      const client = { listAccounts: jasmine.createSpy('listAccounts').and.resolveTo([{ id: 1 }]) };
      const setAccounts = jasmine.createSpy('setAccounts');

      buildPayingAccountsLoadEffect(CONTEXT, setAccounts, client)()();
      await flushMicrotasks();

      expect(setAccounts).not.toHaveBeenCalled();
    });
  });
});
