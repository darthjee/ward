import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useAccountantHandoff, {
  buildHandoffHandlers,
  buildHandoffLoadEffect,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/hooks/useAccountantHandoff.js';
import AccountantHandoffController from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/AccountantHandoffController.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { lastFullMonth } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { flushMicrotasks } from '../../../../../../../../support/flushMicrotasks.js';

const ORG = { kind: 'organization', orgId: 5 };

function probe(context = DEFAULT_OWNER_CONTEXT.context) {
  let result;
  const Probe = () => {
    result = useAccountantHandoff();
    return null;
  };

  renderToStaticMarkup(React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1 } },
    React.createElement(Probe),
  ));

  return result;
}

describe('useAccountantHandoff', () => {
  it('starts on the last full month, unsent only, loading, in the route context', () => {
    const { context, state } = probe(ORG);

    expect(context).toEqual(ORG);
    expect(state).toEqual(jasmine.objectContaining({
      ...lastFullMonth(), unsentOnly: true, charges: null, loading: true, rangeError: null, notFound: false,
    }));
  });

  it('exposes every handler', () => {
    expect(Object.keys(probe().handlers)).toEqual(jasmine.arrayContaining([
      'onRangeChange', 'onUnsentOnlyChange', 'onDownload', 'onMarkSent', 'onConfirmMarkSent', 'onCancelMarkSent',
      'onRetry', 'onDismiss', 'onDismissSuccess',
    ]));
  });

  describe('buildHandoffHandlers', () => {
    let update;
    let controller;
    const state = { from: '2026-02-01', to: '2026-02-28', charges: [{ id: 1 }], error: null };

    beforeEach(() => {
      update = jasmine.createSpy('update');
      controller = jasmine.createSpyObj('controller', ['downloadCsv', 'markSent']);
    });

    it('changes a date and clears the success alert', () => {
      buildHandoffHandlers(state, update, controller).onRangeChange({ target: { name: 'to', value: '2026-02-15' } });

      expect(update).toHaveBeenCalledWith({ to: '2026-02-15', success: null });
    });

    it('ignores unknown inputs', () => {
      buildHandoffHandlers(state, update, controller).onRangeChange({ target: { name: 'charges', value: 'x' } });

      expect(update).not.toHaveBeenCalled();
    });

    it('toggles Unsent only', () => {
      buildHandoffHandlers(state, update, controller).onUnsentOnlyChange({ target: { checked: false } });

      expect(update).toHaveBeenCalledWith({ unsentOnly: false, success: null });
    });

    it('downloads and marks the loaded state', () => {
      const handlers = buildHandoffHandlers(state, update, controller);

      handlers.onDownload();
      handlers.onConfirmMarkSent();

      expect(controller.downloadCsv).toHaveBeenCalledWith(state);
      expect(controller.markSent).toHaveBeenCalledWith(state);
    });

    it('opens and cancels the confirmation', () => {
      const handlers = buildHandoffHandlers(state, update, controller);

      handlers.onMarkSent();
      handlers.onCancelMarkSent();

      expect(update.calls.allArgs()).toEqual([[{ confirming: true }], [{ confirming: false }]]);
    });

    it('retries and dismisses the alerts', () => {
      const retry = jasmine.createSpy('retry');

      buildHandoffHandlers({ ...state, error: { retry } }, update, controller).onRetry();
      buildHandoffHandlers(state, update, controller).onRetry();
      buildHandoffHandlers(state, update, controller).onDismiss();
      buildHandoffHandlers(state, update, controller).onDismissSuccess();

      expect(retry).toHaveBeenCalledTimes(1);
      expect(update.calls.allArgs()).toEqual([[{ error: null }], [{ success: null }]]);
    });
  });

  describe('buildHandoffLoadEffect', () => {
    let client;
    let state;
    let controller;

    beforeEach(() => {
      client = jasmine.createSpyObj('client', ['listCharges']);
      client.listCharges.and.resolveTo({ charges: [] });
      state = { from: '2026-02-01', to: '2026-02-28', unsentOnly: true };
      controller = new AccountantHandoffController({
        context: ORG, update: (patch) => Object.assign(state, patch), reload: () => undefined, client,
      });
    });

    it('loads the default range with include_sent=false on open', async () => {
      buildHandoffLoadEffect(controller, state)();
      await flushMicrotasks();

      expect(client.listCharges).toHaveBeenCalledWith(ORG, { from: '2026-02-01', to: '2026-02-28', includeSent: false });
    });

    it('reloads with the new date after a date change', async () => {
      buildHandoffHandlers(state, (patch) => Object.assign(state, patch), controller)
        .onRangeChange({ target: { name: 'from', value: '2026-02-10' } });
      buildHandoffLoadEffect(controller, state)();
      await flushMicrotasks();

      expect(client.listCharges).toHaveBeenCalledWith(ORG, { from: '2026-02-10', to: '2026-02-28', includeSent: false });
    });

    it('reloads including the sent charges after the toggle changes', async () => {
      buildHandoffHandlers(state, (patch) => Object.assign(state, patch), controller)
        .onUnsentOnlyChange({ target: { checked: false } });
      buildHandoffLoadEffect(controller, state)();
      await flushMicrotasks();

      expect(client.listCharges).toHaveBeenCalledWith(ORG, jasmine.objectContaining({ includeSent: true }));
    });

    it('sends nothing for an invalid range', async () => {
      buildHandoffLoadEffect(controller, { ...state, to: '' })();
      await flushMicrotasks();

      expect(client.listCharges).not.toHaveBeenCalled();
    });

    it('drops the answer of a range changed meanwhile', async () => {
      const cleanup = buildHandoffLoadEffect(controller, state)();

      cleanup();
      await flushMicrotasks();

      expect(state.charges).toBeUndefined();
    });
  });
});
