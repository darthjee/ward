import React from 'react';
import useProviderBills, {
  buildProviderBillsHandlers,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/common/hooks/useProviderBills.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

describe('useProviderBills', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts on page 1, loading', () => {
    installFakeWindow({ location: { hash: '#/bank/providers/7' } });
    let result;

    function Probe() {
      result = useProviderBills({ context: { kind: 'personal' }, account: { id: 7 } });
      return null;
    }

    renderedOutput(React.createElement(Probe));

    expect(result.state).toEqual({
      page: 1, data: null, error: null, pending: false, confirmation: null, selfHref: '#/bank/providers/7',
    });
  });

  describe('buildProviderBillsHandlers', () => {
    let deps;

    beforeEach(() => {
      deps = {
        controller: { delete: jasmine.createSpy('delete').and.resolveTo() },
        confirmation: null,
        setConfirmation: jasmine.createSpy('setConfirmation'),
        setPage: jasmine.createSpy('setPage'),
        error: null,
        setError: jasmine.createSpy('setError'),
      };
    });

    it('changes the page in state', () => {
      const event = { preventDefault: jasmine.createSpy('preventDefault') };

      buildProviderBillsHandlers(deps).onNavigate(2, event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(deps.setPage).toHaveBeenCalledWith(2);
    });

    it('navigates without an event', () => {
      buildProviderBillsHandlers(deps).onNavigate(3);

      expect(deps.setPage).toHaveBeenCalledWith(3);
    });

    it('opens and cancels the confirmation', () => {
      const handlers = buildProviderBillsHandlers(deps);

      handlers.onDelete({ id: 1 });
      handlers.onCancelDelete();

      expect(deps.setConfirmation.calls.allArgs()).toEqual([[{ id: 1 }], [null]]);
    });

    it('deletes the confirmed bill only', () => {
      buildProviderBillsHandlers(deps).onConfirmDelete();

      expect(deps.controller.delete).not.toHaveBeenCalled();

      buildProviderBillsHandlers({ ...deps, confirmation: { id: 1 } }).onConfirmDelete();

      expect(deps.controller.delete).toHaveBeenCalledWith({ id: 1 });
    });

    it('retries and dismisses', () => {
      const retry = jasmine.createSpy('retry');
      const handlers = buildProviderBillsHandlers({ ...deps, error: { retry } });

      handlers.onRetry();
      handlers.onDismiss();

      expect(retry).toHaveBeenCalled();
      expect(deps.setError).toHaveBeenCalledWith(null);
    });

    it('retries without a retry callback', () => {
      expect(() => buildProviderBillsHandlers(deps).onRetry()).not.toThrow();
    });
  });
});
