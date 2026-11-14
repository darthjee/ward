import React from 'react';
import useCalendarMonth, { buildCalendarMonthLoadEffect } from '../../../../../../../../../assets/js/components/resources/bank/calendar/pages/hooks/useCalendarMonth.js';
import { localToday } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../../support/fakeWindow.js';

function probe(hash) {
  let result;

  installFakeWindow({ location: { hash } });
  renderedOutput(React.createElement(() => {
    result = useCalendarMonth();
    return null;
  }));

  return result;
}

describe('useCalendarMonth', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('defaults to the current month', () => {
    expect(probe('#/bank/calendar/month').month).toEqual(localToday().slice(0, 7));
  });

  it('falls back to the current month for an invalid m', () => {
    expect(probe('#/bank/calendar/month?m=2026-13').month).toEqual(localToday().slice(0, 7));
  });

  it('reads a valid m', () => {
    const result = probe('#/bank/calendar/month?m=2020-05');

    expect(result.month).toEqual('2020-05');
    expect(result.data).toBeNull();
  });

  it('clamps an m later than the current month + 12', () => {
    const year = Number(localToday().slice(0, 4));

    expect(probe('#/bank/calendar/month?m=' + (year + 5) + '-01').month >= localToday().slice(0, 7)).toBeTrue();
    expect(probe('#/bank/calendar/month?m=' + (year + 5) + '-01').month < String(year + 2)).toBeTrue();
  });

  it('builds a load effect running the controller for the month', () => {
    const controller = { load: jasmine.createSpy('load').and.resolveTo() };
    const cleanup = buildCalendarMonthLoadEffect(controller, '2026-11')();
    const [month, isActive] = controller.load.calls.mostRecent().args;

    expect(month).toEqual('2026-11');
    cleanup();

    expect(isActive()).toBeFalse();
  });
});
