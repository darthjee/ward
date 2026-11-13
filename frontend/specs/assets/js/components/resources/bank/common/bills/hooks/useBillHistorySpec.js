import React from 'react';
import useBillHistory, {
  buildBillHistoryHandlers,
} from '../../../../../../../../../assets/js/components/resources/bank/common/bills/hooks/useBillHistory.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

describe('useBillHistory', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts on page 1, loading, with the current hash as the pagination href', () => {
    installFakeWindow({ location: { hash: '#/bank/debts/7?page=3' } });
    let result;

    function Probe() {
      result = useBillHistory({ context: { kind: 'personal' }, account: { id: 7 }, onUndone: () => undefined });
      return null;
    }

    renderedOutput(React.createElement(Probe));

    expect(result.state).toEqual({
      page: 1, data: null, error: null, pending: false, confirmation: null, selfHref: '#/bank/debts/7?page=3',
    });
    expect(Object.keys(result.handlers)).toEqual([
      'onNavigate', 'onUndo', 'onConfirmUndo', 'onCancelUndo', 'onRetry', 'onDismiss',
    ]);
  });

  describe('buildBillHistoryHandlers', () => {
    let deps;

    beforeEach(() => {
      deps = {
        controller: { undo: jasmine.createSpy('undo').and.resolveTo() },
        confirmation: null,
        setConfirmation: jasmine.createSpy('setConfirmation'),
        setPage: jasmine.createSpy('setPage'),
        error: null,
        setError: jasmine.createSpy('setError'),
      };
    });

    it('changes the page in state, not in the hash', () => {
      const event = { preventDefault: jasmine.createSpy('preventDefault') };

      buildBillHistoryHandlers(deps).onNavigate(2, event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(deps.setPage).toHaveBeenCalledWith(2);
    });

    it('tolerates a navigation without an event', () => {
      buildBillHistoryHandlers(deps).onNavigate(3);

      expect(deps.setPage).toHaveBeenCalledWith(3);
    });

    it('asks for confirmation before undoing', () => {
      const row = { id: 1 };

      buildBillHistoryHandlers(deps).onUndo(row);

      expect(deps.setConfirmation).toHaveBeenCalledWith(row);
      expect(deps.controller.undo).not.toHaveBeenCalled();
    });

    it('undoes the confirmed row', () => {
      const row = { id: 1 };

      buildBillHistoryHandlers({ ...deps, confirmation: row }).onConfirmUndo();

      expect(deps.controller.undo).toHaveBeenCalledWith(row);
    });

    it('ignores a confirm without a row', () => {
      expect(buildBillHistoryHandlers(deps).onConfirmUndo()).toBeUndefined();
      expect(deps.controller.undo).not.toHaveBeenCalled();
    });

    it('cancels the confirmation', () => {
      buildBillHistoryHandlers(deps).onCancelUndo();

      expect(deps.setConfirmation).toHaveBeenCalledWith(null);
    });

    it('retries through the error and dismisses it', () => {
      const retry = jasmine.createSpy('retry');
      const handlers = buildBillHistoryHandlers({ ...deps, error: { retry } });

      handlers.onRetry();
      handlers.onDismiss();

      expect(retry).toHaveBeenCalled();
      expect(deps.setError.calls.allArgs()).toEqual([[null], [null]]);
    });

    it('tolerates a retry without an error', () => {
      expect(() => buildBillHistoryHandlers(deps).onRetry()).not.toThrow();
    });
  });
});
