import buildForbiddenRefreshEffect from '../../../../../../../assets/js/components/common/ownerContext/controllers/forbiddenRefreshEffect.js';
import PermissionEvents from '../../../../../../../assets/js/client/PermissionEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

function fakeEvents() {
  const listeners = new Set();

  return {
    onForbidden(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    emit() {
      return Promise.all([...listeners].map((listener) => listener()));
    },
    get size() {
      return listeners.size;
    },
  };
}

describe('buildForbiddenRefreshEffect', () => {
  it('calls refresh on each forbidden event', async () => {
    const events = fakeEvents();
    const refresh = jasmine.createSpy('refresh').and.resolveTo();

    buildForbiddenRefreshEffect(refresh, events)();
    await events.emit();
    await events.emit();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('ignores events while a refresh is in flight', async () => {
    const events = fakeEvents();
    let finish;
    const refresh = jasmine.createSpy('refresh').and.callFake(() => new Promise((resolve) => {
      finish = resolve;
    }));

    buildForbiddenRefreshEffect(refresh, events)();
    const first = events.emit();

    await events.emit();
    finish();
    await first;

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('allows a new refresh after a failed one', async () => {
    const events = fakeEvents();
    const refresh = jasmine.createSpy('refresh').and.rejectWith(new Error('boom'));

    buildForbiddenRefreshEffect(refresh, events)();
    await expectAsync(events.emit()).toBeRejected();
    await expectAsync(events.emit()).toBeRejected();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes on cleanup', async () => {
    const events = fakeEvents();
    const refresh = jasmine.createSpy('refresh').and.resolveTo();
    const cleanup = buildForbiddenRefreshEffect(refresh, events)();

    cleanup();
    await events.emit();

    expect(events.size).toBe(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  describe('with the default bus', () => {
    beforeEach(() => {
      installFakeWindow(new EventTarget());
    });

    afterEach(() => {
      uninstallFakeWindow();
    });

    it('refreshes on a PermissionEvents forbidden event', () => {
      const refresh = jasmine.createSpy('refresh').and.resolveTo();
      const cleanup = buildForbiddenRefreshEffect(refresh)();

      try {
        PermissionEvents.emitForbidden();

        expect(refresh).toHaveBeenCalledTimes(1);
      } finally {
        cleanup();
      }
    });
  });
});
