import React from 'react';
import BankProviderNew from '../../../../../../../../assets/js/components/resources/bank/providers/pages/BankProviderNew.jsx';
import BankProviderEdit from '../../../../../../../../assets/js/components/resources/bank/providers/pages/BankProviderEdit.jsx';
import BankProviderFormHelper from '../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/BankProviderFormHelper.jsx';
import BankProviderNewController from '../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/BankProviderNewController.js';
import BankProviderEditController from '../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/BankProviderEditController.js';
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

  spyOn(BankProviderFormHelper, 'render').and.callFake((state, handlers, options) => {
    captured = { state, handlers, options };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

const fakeEvent = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

describe('bank provider form pages', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('BankProviderNew', () => {
    it('renders an idle provider create form in Personal', () => {
      const page = renderedOutput(React.createElement(inContext(BankProviderNew)));

      expect(page.containsElement('h1', 'New provider')).toBeTrue();
      expect(page.containsAttribute('href', '#/bank/providers')).toBeTrue();
      expect(page.containsInOrder('Provider', 'Branch', 'Customer / contract number', 'Opening balance', 'For accountant', 'Provider tax id'))
        .toBeTrue();
      expect(page.contains('name="type"')).toBeFalse();
    });

    it('builds the cancel link under an organization, with the empty provider fields', () => {
      const { options, state } = capture(inContext(BankProviderNew, ORG));

      expect(options.cancelHref).toBe('#/orgs/5/bank/providers');
      expect(state.fields.charge_frequency).toBe('monthly');
      expect(state.fields.for_accountant).toBeTrue();
      expect(state.idPrefix).toBe('bank-provider-new-');
    });

    it('submits the current fields through the provider controller', async () => {
      spyOn(BankProviderNewController.prototype, 'handleSubmit').and.resolveTo();
      const { handlers, state } = capture(inContext(BankProviderNew));
      const event = fakeEvent();

      await handlers.onSubmit(event);
      await handlers.onRetry();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(BankProviderNewController.prototype.handleSubmit).toHaveBeenCalledWith(state.fields);
      expect(BankProviderNewController.prototype.handleSubmit.calls.count()).toBe(2);
    });
  });

  describe('BankProviderEdit', () => {
    beforeEach(() => {
      installFakeWindow({ location: { hash: '#/orgs/5/bank/providers/7/edit' } });
    });

    it('renders the loading state', () => {
      const page = renderedOutput(React.createElement(inContext(BankProviderEdit, ORG)));

      expect(page.containsElement('h1', 'Edit provider')).toBeTrue();
      expect(page.contains('Loading')).toBeTrue();
    });

    it('reads the provider id from the hash for the cancel link', () => {
      const { options, state } = capture(inContext(BankProviderEdit, ORG));

      expect(options.cancelHref).toBe('#/orgs/5/bank/providers/7');
      expect(state.fields).toBeNull();
      expect(state.idPrefix).toBe('bank-provider-edit-');
    });

    it('does not submit before the provider is loaded, and wires retries', () => {
      spyOn(BankProviderEditController.prototype, 'handleSubmit');
      const { handlers } = capture(inContext(BankProviderEdit, ORG));

      handlers.onSubmit(fakeEvent());

      expect(BankProviderEditController.prototype.handleSubmit).not.toHaveBeenCalled();

      handlers.onRetry();
      handlers.onRetryLoad();

      expect(BankProviderEditController.prototype.handleSubmit).toHaveBeenCalledWith('7', null, null);
    });
  });
});
