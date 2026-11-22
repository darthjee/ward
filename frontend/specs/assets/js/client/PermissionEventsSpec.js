import PermissionEvents from '../../../../assets/js/client/PermissionEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../support/fakeWindow.js';

describe('PermissionEvents', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('with an event-capable window', () => {
    beforeEach(() => {
      installFakeWindow(new EventTarget());
    });

    it('notifies a subscriber on emitForbidden', () => {
      const listener = jasmine.createSpy('listener');
      const unsubscribe = PermissionEvents.onForbidden(listener);

      try {
        PermissionEvents.emitForbidden();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.calls.mostRecent().args[0].type).toBe('permission:forbidden');
      } finally {
        unsubscribe();
      }
    });

    it('stops notifying after unsubscribing', () => {
      const listener = jasmine.createSpy('listener');
      const unsubscribe = PermissionEvents.onForbidden(listener);

      unsubscribe();
      PermissionEvents.emitForbidden();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('.emitForbidden without an event-capable window', () => {
    it('is a no-op when window is undefined', () => {
      expect(() => PermissionEvents.emitForbidden()).not.toThrow();
    });

    it('is a no-op when window has no dispatchEvent', () => {
      installFakeWindow({ location: { hash: '' } });

      expect(() => PermissionEvents.emitForbidden()).not.toThrow();
    });
  });
});
