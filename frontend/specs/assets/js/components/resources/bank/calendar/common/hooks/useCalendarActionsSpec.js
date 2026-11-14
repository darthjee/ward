import React from 'react';
import useCalendarActions, { buildCalendarActionsHandlers } from '../../../../../../../../../assets/js/components/resources/bank/calendar/common/hooks/useCalendarActions.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

describe('useCalendarActions', () => {
  it('starts with no dialog and loading accounts', () => {
    let result;

    function Probe() {
      result = useCalendarActions({ context: { kind: 'personal' }, onChanged: () => undefined });
      return null;
    }

    renderedOutput(React.createElement(Probe));

    expect(result.state).toEqual({
      dialog: null, fields: {}, fieldErrors: {}, pending: false, error: null, accounts: null,
    });
    expect(Object.keys(result.handlers)).toEqual([
      'onPay', 'onSkip', 'onUndo', 'onFieldChange', 'onConfirm', 'onCancel', 'onRetry', 'onDismiss',
    ]);
  });

  describe('buildCalendarActionsHandlers', () => {
    const occ = { id: 1 };
    let controller;
    let setFields;
    let setError;

    function build(state) {
      return buildCalendarActionsHandlers({
        controller, state: { fields: { a: 1 }, accounts: [], error: null, dialog: null, ...state }, setFields, setError,
      });
    }

    beforeEach(() => {
      controller = jasmine.createSpyObj('controller', [
        'openPay', 'openConfirm', 'close', 'confirmPay', 'confirmSkip', 'confirmUndo',
      ]);
      setFields = jasmine.createSpy('setFields');
      setError = jasmine.createSpy('setError');
    });

    it('opens the dialogs', () => {
      const handlers = build({});

      handlers.onPay(occ);
      handlers.onSkip(occ);
      handlers.onUndo(occ);

      expect(controller.openPay).toHaveBeenCalledWith(occ, []);
      expect(controller.openConfirm).toHaveBeenCalledWith('skip', occ);
      expect(controller.openConfirm).toHaveBeenCalledWith('undo', occ);
    });

    it('confirms by dialog type', () => {
      build({ dialog: { type: 'pay', occurrence: occ } }).onConfirm();
      build({ dialog: { type: 'skip', occurrence: occ } }).onConfirm();
      build({ dialog: { type: 'undo', occurrence: occ } }).onConfirm();

      expect(controller.confirmPay).toHaveBeenCalledWith(occ, { a: 1 });
      expect(controller.confirmSkip).toHaveBeenCalledWith(occ);
      expect(controller.confirmUndo).toHaveBeenCalledWith(occ);
    });

    it('does nothing on confirm without a dialog', () => {
      build({}).onConfirm();

      expect(controller.confirmPay).not.toHaveBeenCalled();
    });

    it('updates a field through a functional setter', () => {
      build({}).onFieldChange({ target: { name: 'b', value: 2 } });

      expect(setFields.calls.mostRecent().args[0]({ a: 1 })).toEqual({ a: 1, b: 2 });
    });

    it('cancels, retries and dismisses', () => {
      const retry = jasmine.createSpy('retry');
      const handlers = build({ error: { retry } });

      handlers.onCancel();
      handlers.onRetry();
      handlers.onDismiss();

      expect(controller.close).toHaveBeenCalled();
      expect(retry).toHaveBeenCalled();
      expect(setError).toHaveBeenCalledWith(null);
    });
  });
});
