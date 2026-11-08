import React from 'react';
import BankAccountNew from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/BankAccountNew.jsx';
import BankAccountEdit, { mergeLoadedAccount } from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/BankAccountEdit.jsx';
import BankAccountFormHelper from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/helpers/BankAccountFormHelper.jsx';
import BankAccountNewController from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/controllers/BankAccountNewController.js';
import BankAccountEditController from '../../../../../../../../assets/js/components/resources/bank/accounts/pages/controllers/BankAccountEditController.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

function inContext(Page, context = PERSONAL) {
  return () => React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context, userId: 1 } },
    React.createElement(Page),
  );
}

function capture(Page) {
  let captured;

  spyOn(BankAccountFormHelper, 'render').and.callFake((state, handlers, options) => {
    captured = { state, handlers, options };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

const fakeEvent = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

describe('bank account form pages', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('BankAccountNew', () => {
    it('renders an idle create form in Personal', () => {
      const page = renderedOutput(React.createElement(inContext(BankAccountNew)));

      expect(page.containsElement('h1', 'New account')).toBeTrue();
      expect(page.containsAttribute('href', '#/bank/accounts')).toBeTrue();
      expect(page.contains('Opening balance')).toBeTrue();
    });

    it('builds the cancel link under an organization', () => {
      const { options, state } = capture(inContext(BankAccountNew, ORG));

      expect(options.cancelHref).toBe('#/orgs/5/bank/accounts');
      expect(state.fields.opening_balance).toBe('0');
      expect(state.currencyLocked).toBeFalse();
      expect(state.settingsFailed).toBeFalse();
    });

    it('submits the current fields through the controller', async () => {
      spyOn(BankAccountNewController.prototype, 'handleSubmit').and.resolveTo();
      const { handlers, state } = capture(inContext(BankAccountNew));
      const event = fakeEvent();

      await handlers.onSubmit(event);
      await handlers.onRetry();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(BankAccountNewController.prototype.handleSubmit).toHaveBeenCalledWith(state.fields);
      expect(BankAccountNewController.prototype.handleSubmit.calls.count()).toBe(2);
    });
  });

  describe('BankAccountEdit', () => {
    beforeEach(() => {
      installFakeWindow({ location: { hash: '#/orgs/5/bank/accounts/12/edit' } });
    });

    it('renders the loading state', () => {
      const page = renderedOutput(React.createElement(inContext(BankAccountEdit, ORG)));

      expect(page.containsElement('h1', 'Edit account')).toBeTrue();
      expect(page.contains('Loading')).toBeTrue();
    });

    it('reads the account id from the hash for the cancel link', () => {
      const { options, state } = capture(inContext(BankAccountEdit, ORG));

      expect(options.cancelHref).toBe('#/orgs/5/bank/accounts/12');
      expect(state.fields).toBeNull();
      expect(state.archived).toBeFalse();
    });

    it('does not submit before the account is loaded', () => {
      spyOn(BankAccountEditController.prototype, 'handleSubmit');
      const { handlers } = capture(inContext(BankAccountEdit, ORG));

      handlers.onSubmit(fakeEvent());

      expect(BankAccountEditController.prototype.handleSubmit).not.toHaveBeenCalled();
    });

    it('wires retry handlers', () => {
      spyOn(BankAccountEditController.prototype, 'handleSubmit');
      const { handlers } = capture(inContext(BankAccountEdit, ORG));

      handlers.onRetry();
      handlers.onRetryLoad();

      expect(BankAccountEditController.prototype.handleSubmit).toHaveBeenCalledWith('12', null, null);
    });
  });

  describe('mergeLoadedAccount', () => {
    const account = {
      name: 'Main', currency: 'BRL', opening_date: '2026-01-01', opening_balance: '0.00',
    };

    it('fills the form on the first load', () => {
      expect(mergeLoadedAccount(null, account, false).name).toBe('Main');
    });

    it('keeps the user values on a reload', () => {
      const fields = { name: 'Typed', currency: 'USD' };

      expect(mergeLoadedAccount(fields, account, false)).toBe(fields);
    });

    it('resets a now-locked currency, keeping the other values', () => {
      expect(mergeLoadedAccount({ name: 'Typed', currency: 'USD' }, account, true))
        .toEqual({ name: 'Typed', currency: 'BRL' });
    });
  });
});
