import OrgListController, {
  EMPTY_ORG_STATE,
  buildOrgListEffect,
} from '../../../../../../../assets/js/components/common/ownerContext/controllers/OrgListController.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import OrganizationsClient from '../../../../../../../assets/js/client/OrganizationsClient.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

const ORGS = [{ id: 5, name: 'Acme', role: 'owner' }];
const loggedIn = (userId = 1) => ({ detail: { loggedIn: true, isAdmin: false, userId } });
const loggedOut = () => ({ detail: { loggedIn: false, isAdmin: false, userId: null } });

describe('OrgListController', () => {
  let client;
  let setState;
  let onSessionLoaded;
  let controller;

  const lastState = () => setState.calls.mostRecent().args[0];

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['list']);
    client.list.and.resolveTo(ORGS);
    setState = jasmine.createSpy('setState');
    onSessionLoaded = jasmine.createSpy('onSessionLoaded');
    controller = new OrgListController(setState, { client, onSessionLoaded });
  });

  describe('on a logged-in event', () => {
    it('fetches the list and publishes it', async () => {
      await controller.handleAuthChanged(loggedIn());

      expect(client.list).toHaveBeenCalledTimes(1);
      expect(lastState()).toEqual({
        userId: 1, orgs: ORGS, orgsLoaded: true, orgsError: null,
      });
    });

    it('publishes the user id before the list arrives', async () => {
      await controller.handleAuthChanged(loggedIn());

      expect(setState.calls.argsFor(0)[0]).toEqual({ ...EMPTY_ORG_STATE, userId: 1 });
    });

    it('reports the first load of the session', async () => {
      await controller.handleAuthChanged(loggedIn());

      expect(onSessionLoaded).toHaveBeenCalledOnceWith({
        userId: 1, orgs: ORGS, orgsLoaded: true, orgsError: null,
      });
    });

    it('fetches only once per session', async () => {
      await controller.handleAuthChanged(loggedIn());
      await controller.handleAuthChanged(loggedIn());

      expect(client.list).toHaveBeenCalledTimes(1);
      expect(onSessionLoaded).toHaveBeenCalledTimes(1);
    });

    it('refetches for a different user', async () => {
      await controller.handleAuthChanged(loggedIn(1));
      await controller.handleAuthChanged(loggedIn(2));

      expect(client.list).toHaveBeenCalledTimes(2);
      expect(lastState().userId).toBe(2);
    });

    it('defaults to OrganizationsClient', async () => {
      spyOn(OrganizationsClient, 'list').and.resolveTo([]);
      const defaultController = new OrgListController(setState);

      await defaultController.handleAuthChanged(loggedIn());

      expect(OrganizationsClient.list).toHaveBeenCalled();
    });
  });

  describe('on a failed load', () => {
    beforeEach(() => {
      client.list.and.rejectWith(new Error('boom'));
    });

    it('sets the error and keeps the list empty', async () => {
      await controller.handleAuthChanged(loggedIn());

      expect(lastState()).toEqual({
        userId: 1, orgs: [], orgsLoaded: true, orgsError: 'boom',
      });
    });

    it('falls back to a generic message', async () => {
      client.list.and.rejectWith(new Error(''));

      await controller.handleAuthChanged(loggedIn());

      expect(lastState().orgsError).toBe('Request failed');
    });

    it('still reports the session load', async () => {
      await controller.handleAuthChanged(loggedIn());

      expect(onSessionLoaded).toHaveBeenCalledWith(jasmine.objectContaining({ orgsError: 'boom' }));
    });
  });

  describe('on an expired session (undefined result)', () => {
    beforeEach(() => {
      client.list.and.resolveTo(undefined);
    });

    it('leaves the list unloaded and does not report a session load', async () => {
      await controller.handleAuthChanged(loggedIn());

      expect(lastState().orgsLoaded).toBe(false);
      expect(onSessionLoaded).not.toHaveBeenCalled();
    });

    it('reloads on the next login', async () => {
      await controller.handleAuthChanged(loggedIn());
      client.list.and.resolveTo(ORGS);
      await controller.handleAuthChanged(loggedIn());

      expect(client.list).toHaveBeenCalledTimes(2);
      expect(lastState().orgs).toEqual(ORGS);
    });
  });

  describe('on a logged-out event', () => {
    it('clears the list, user id and error', async () => {
      await controller.handleAuthChanged(loggedIn());
      await controller.handleAuthChanged(loggedOut());

      expect(lastState()).toEqual(EMPTY_ORG_STATE);
    });

    it('treats an event without detail as logged out', async () => {
      await controller.handleAuthChanged({});

      expect(lastState()).toEqual(EMPTY_ORG_STATE);
    });

    it('refetches on the next login', async () => {
      await controller.handleAuthChanged(loggedIn());
      await controller.handleAuthChanged(loggedOut());
      await controller.handleAuthChanged(loggedIn());

      expect(client.list).toHaveBeenCalledTimes(2);
    });

    it('ignores a late answer from the previous session', async () => {
      let resolveList;

      client.list.and.returnValue(new Promise((resolve) => {
        resolveList = resolve;
      }));
      const loading = controller.handleAuthChanged(loggedIn());

      controller.clear();
      resolveList(ORGS);
      await loading;

      expect(lastState()).toEqual(EMPTY_ORG_STATE);
      expect(onSessionLoaded).not.toHaveBeenCalled();
    });
  });

  describe('.refresh', () => {
    it('refetches the list', async () => {
      await controller.handleAuthChanged(loggedIn());
      client.list.and.resolveTo([...ORGS, { id: 6, name: 'New', role: 'owner' }]);

      await controller.refresh();

      expect(client.list).toHaveBeenCalledTimes(2);
      expect(lastState().orgs.length).toBe(2);
      expect(onSessionLoaded).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when logged out', async () => {
      await controller.refresh();

      expect(client.list).not.toHaveBeenCalled();
    });
  });

  describe('buildOrgListEffect', () => {
    beforeEach(() => {
      installFakeWindow(new EventTarget());
    });

    afterEach(() => {
      uninstallFakeWindow();
    });

    it('loads the list on a logged-in AuthEvents event', () => {
      spyOn(controller, 'handleAuthChanged');
      buildOrgListEffect(controller)();

      AuthEvents.emit(true, false, false, 1);

      expect(controller.handleAuthChanged).toHaveBeenCalledWith(jasmine.objectContaining({
        detail: jasmine.objectContaining({ loggedIn: true, userId: 1 }),
      }));
    });

    it('unsubscribes on cleanup', () => {
      spyOn(controller, 'handleAuthChanged');
      const cleanup = buildOrgListEffect(controller)();

      cleanup();
      AuthEvents.emit(true, false, false, 1);

      expect(controller.handleAuthChanged).not.toHaveBeenCalled();
    });

    it('accepts an injected event bus', () => {
      const events = jasmine.createSpyObj('events', ['subscribe', 'unsubscribe']);
      const cleanup = buildOrgListEffect(controller, events)();

      cleanup();

      expect(events.subscribe).toHaveBeenCalledWith(jasmine.any(Function));
      expect(events.unsubscribe).toHaveBeenCalledWith(events.subscribe.calls.argsFor(0)[0]);
    });
  });
});
