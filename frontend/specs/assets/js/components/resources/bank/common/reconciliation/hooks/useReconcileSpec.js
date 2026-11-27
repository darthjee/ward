import React from 'react';
import useReconcile, {
  buildReconcileHandlers,
} from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/hooks/useReconcile.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

function probe(role) {
  let result;

  function Probe() {
    result = useReconcile({
      context: { kind: 'personal' }, accountId: 7, account: { id: 7 }, reload: () => undefined,
    });
    return null;
  }

  renderedOutput(React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, role } },
    React.createElement(Probe),
  ));

  return result;
}

describe('useReconcile', () => {
  it('starts off, with every handler', () => {
    const { reconcile, reconcileHandlers } = probe('owner');

    expect(reconcile).toEqual(jasmine.objectContaining({
      mode: 'off', statement: null, onlyUncleared: false, pending: false, error: null, historyVersion: 0,
    }));
    expect(Object.keys(reconcileHandlers)).toEqual([
      'onReconcile', 'onEditStatement', 'onCloseForm', 'onFieldChange', 'onSubmitStatement', 'onToggle',
      'onTickAll', 'onUntickAll', 'onToggleOnlyUncleared', 'onFinish', 'onCancel', 'onConfirmCancel',
      'onDismissCancel', 'onDismissError', 'onReset',
    ]);
  });

  it('lets a user write but not cancel', () => {
    const { reconcile } = probe('user');

    expect(reconcile.canWrite).toBeTrue();
    expect(reconcile.canCancel).toBeFalse();
  });

  ['admin', 'owner'].forEach((role) => {
    it(`lets ${role} write and cancel`, () => {
      const { reconcile } = probe(role);

      expect(reconcile.canWrite).toBeTrue();
      expect(reconcile.canCancel).toBeTrue();
    });
  });

  describe('buildReconcileHandlers', () => {
    const STATEMENT = { id: 4 };
    let controller;
    let handlers;

    beforeEach(() => {
      controller = jasmine.createSpyObj('controller', [
        'open', 'openEdit', 'closeForm', 'changeField', 'submitForm', 'toggle', 'tickAll', 'untickAll',
        'toggleOnlyUncleared', 'finish', 'requestCancel', 'confirmCancel', 'dismissCancel', 'dismissError', 'resetMode',
      ]);
      handlers = buildReconcileHandlers(controller, { statement: STATEMENT, fields: {} });
    });

    it('delegates to the controller', () => {
      const row = { id: 1 };

      handlers.onReconcile();
      handlers.onEditStatement();
      handlers.onCloseForm();
      handlers.onFieldChange({ target: { name: 'a', value: 'b' } });
      handlers.onToggle(row);
      handlers.onTickAll([row]);
      handlers.onUntickAll([row]);
      handlers.onToggleOnlyUncleared();
      handlers.onFinish();
      handlers.onCancel();
      handlers.onConfirmCancel();
      handlers.onDismissCancel();
      handlers.onDismissError();
      handlers.onReset();

      expect(controller.open).toHaveBeenCalled();
      expect(controller.openEdit).toHaveBeenCalledWith(STATEMENT);
      expect(controller.closeForm).toHaveBeenCalledWith(STATEMENT);
      expect(controller.changeField).toHaveBeenCalledWith('a', 'b');
      expect(controller.toggle).toHaveBeenCalledWith(row, jasmine.objectContaining({ statement: STATEMENT }));
      expect(controller.tickAll).toHaveBeenCalledWith([row], jasmine.any(Object));
      expect(controller.untickAll).toHaveBeenCalledWith([row], jasmine.any(Object));
      expect(controller.toggleOnlyUncleared).toHaveBeenCalled();
      expect(controller.finish).toHaveBeenCalledWith(STATEMENT);
      expect(controller.requestCancel).toHaveBeenCalled();
      expect(controller.confirmCancel).toHaveBeenCalledWith(STATEMENT);
      expect(controller.dismissCancel).toHaveBeenCalled();
      expect(controller.dismissError).toHaveBeenCalled();
      expect(controller.resetMode).toHaveBeenCalled();
    });

    it('prevents the default of a form submit and submits the state', () => {
      const event = { preventDefault: jasmine.createSpy('preventDefault') };

      handlers.onSubmitStatement(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(controller.submitForm).toHaveBeenCalledWith(jasmine.objectContaining({ statement: STATEMENT }));
    });

    it('submits without an event', () => {
      handlers.onSubmitStatement();

      expect(controller.submitForm).toHaveBeenCalled();
    });
  });
});
