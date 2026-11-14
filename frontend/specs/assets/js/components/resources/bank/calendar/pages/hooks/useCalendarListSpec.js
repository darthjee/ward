import React from 'react';
import useCalendarList, { buildCalendarListLoadEffect } from '../../../../../../../../../assets/js/components/resources/bank/calendar/pages/hooks/useCalendarList.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

describe('useCalendarList', () => {
  it('starts loading, with no error, in the default context', () => {
    let result;

    function Probe() {
      result = useCalendarList();
      return null;
    }

    renderedOutput(React.createElement(Probe));

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
    expect(result.notFound).toBeFalse();
    expect(result.context.kind).toEqual('personal');
    expect(Object.keys(result.handlers)).toEqual(['onRetry', 'onDismiss']);
    expect(result.actions.state.dialog).toBeNull();
  });

  it('builds a load effect running the controller and dropping late answers', async () => {
    const controller = { load: jasmine.createSpy('load').and.resolveTo() };
    const cleanup = buildCalendarListLoadEffect(controller)();
    const isActive = controller.load.calls.mostRecent().args[0];

    expect(isActive()).toBeTrue();
    cleanup();

    expect(isActive()).toBeFalse();
  });
});
