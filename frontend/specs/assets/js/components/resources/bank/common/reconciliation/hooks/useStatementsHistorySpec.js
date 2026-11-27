import React from 'react';
import useStatementsHistory, {
  buildStatementsHistoryHandlers,
} from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/hooks/useStatementsHistory.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

describe('useStatementsHistory', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts on page 1, loading, with the current hash as the pagination href', () => {
    installFakeWindow({ location: { hash: '#/bank/accounts/7?page=3' } });
    let result;

    function Probe() {
      result = useStatementsHistory({
        context: { kind: 'personal' }, account: { id: 7 }, historyVersion: 0, onUndone: () => undefined,
      });
      return null;
    }

    renderedOutput(React.createElement(Probe));

    expect(result.state).toEqual({
      page: 1, data: null, error: null, pending: false, confirmation: null, selfHref: '#/bank/accounts/7?page=3',
    });
    expect(Object.keys(result.handlers)).toEqual([
      'onNavigate', 'onUndo', 'onConfirmUndo', 'onCancelUndo', 'onRetry', 'onDismiss',
    ]);
  });

  describe('buildStatementsHistoryHandlers', () => {
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

      buildStatementsHistoryHandlers(deps).onNavigate(2, event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(deps.setPage).toHaveBeenCalledWith(2);
    });

    it('tolerates a navigation without an event', () => {
      buildStatementsHistoryHandlers(deps).onNavigate(3);

      expect(deps.setPage).toHaveBeenCalledWith(3);
    });

    it('asks for confirmation before undoing', () => {
      const row = { id: 1 };

      buildStatementsHistoryHandlers(deps).onUndo(row);

      expect(deps.setConfirmation).toHaveBeenCalledWith(row);
      expect(deps.controller.undo).not.toHaveBeenCalled();
    });

    it('undoes the confirmed row', () => {
      const row = { id: 1 };

      buildStatementsHistoryHandlers({ ...deps, confirmation: row }).onConfirmUndo();

      expect(deps.controller.undo).toHaveBeenCalledWith(row);
    });

    it('ignores a confirm without a row', () => {
      expect(buildStatementsHistoryHandlers(deps).onConfirmUndo()).toBeUndefined();
      expect(deps.controller.undo).not.toHaveBeenCalled();
    });

    it('cancels the confirmation without a request', () => {
      buildStatementsHistoryHandlers(deps).onCancelUndo();

      expect(deps.setConfirmation).toHaveBeenCalledWith(null);
      expect(deps.controller.undo).not.toHaveBeenCalled();
    });

    it('retries through the error and dismisses it', () => {
      const retry = jasmine.createSpy('retry');
      const handlers = buildStatementsHistoryHandlers({ ...deps, error: { retry } });

      handlers.onRetry();
      handlers.onDismiss();

      expect(retry).toHaveBeenCalled();
      expect(deps.setError.calls.allArgs()).toEqual([[null], [null]]);
    });

    it('tolerates a retry without an error', () => {
      expect(() => buildStatementsHistoryHandlers(deps).onRetry()).not.toThrow();
    });
  });
});
