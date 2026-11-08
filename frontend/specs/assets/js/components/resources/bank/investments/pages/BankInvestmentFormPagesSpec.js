import React from 'react';
import BankInvestmentNew from '../../../../../../../../assets/js/components/resources/bank/investments/pages/BankInvestmentNew.jsx';
import BankInvestmentEdit from '../../../../../../../../assets/js/components/resources/bank/investments/pages/BankInvestmentEdit.jsx';
import BankInvestmentFormHelper from '../../../../../../../../assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentFormHelper.jsx';
import BankInvestmentNewController from '../../../../../../../../assets/js/components/resources/bank/investments/pages/controllers/BankInvestmentNewController.js';
import BankInvestmentEditController from '../../../../../../../../assets/js/components/resources/bank/investments/pages/controllers/BankInvestmentEditController.js';
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

  spyOn(BankInvestmentFormHelper, 'render').and.callFake((state, handlers, options) => {
    captured = { state, handlers, options };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

const fakeEvent = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

describe('bank investment form pages', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('BankInvestmentNew', () => {
    it('renders an idle investment create form in Personal', () => {
      const page = renderedOutput(React.createElement(inContext(BankInvestmentNew)));

      expect(page.containsElement('h1', 'New investment')).toBeTrue();
      expect(page.containsAttribute('href', '#/bank/investments')).toBeTrue();
      expect(page.containsInOrder('Institution', 'Start date', 'Kind', 'Yield rate')).toBeTrue();
      expect(page.contains('Opening balance')).toBeFalse();
      expect(page.contains('name="type"')).toBeFalse();
    });

    it('builds the cancel link under an organization, with the empty investment fields', () => {
      const { options, state } = capture(inContext(BankInvestmentNew, ORG));

      expect(options.cancelHref).toBe('#/orgs/5/bank/investments');
      expect(state.fields.opening_balance).toBe('0');
      expect(state.fields.kind).toBe('');
      expect(state.idPrefix).toBe('bank-investment-new-');
    });

    it('submits the current fields through the investment controller', async () => {
      spyOn(BankInvestmentNewController.prototype, 'handleSubmit').and.resolveTo();
      const { handlers, state } = capture(inContext(BankInvestmentNew));
      const event = fakeEvent();

      await handlers.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(BankInvestmentNewController.prototype.handleSubmit).toHaveBeenCalledWith(state.fields);
    });
  });

  describe('BankInvestmentEdit', () => {
    it('renders the loading state', () => {
      installFakeWindow({ location: { hash: '#/bank/investments/3/edit' } });
      const page = renderedOutput(React.createElement(inContext(BankInvestmentEdit)));

      expect(page.containsElement('h1', 'Edit investment')).toBeTrue();
      expect(page.contains('Loading')).toBeTrue();
    });

    it('reads the investment id from the hash for the cancel link, under an organization', () => {
      installFakeWindow({ location: { hash: '#/orgs/5/bank/investments/3/edit' } });
      const { options, state } = capture(inContext(BankInvestmentEdit, ORG));

      expect(options.cancelHref).toBe('#/orgs/5/bank/investments/3');
      expect(state.fields).toBeNull();
      expect(state.idPrefix).toBe('bank-investment-edit-');
    });

    it('does not submit before the investment is loaded, and wires retries', () => {
      installFakeWindow({ location: { hash: '#/bank/investments/3/edit' } });
      spyOn(BankInvestmentEditController.prototype, 'handleSubmit');
      const { handlers } = capture(inContext(BankInvestmentEdit));

      handlers.onSubmit(fakeEvent());

      expect(BankInvestmentEditController.prototype.handleSubmit).not.toHaveBeenCalled();

      handlers.onRetry();

      expect(BankInvestmentEditController.prototype.handleSubmit).toHaveBeenCalledWith('3', null, null);
    });
  });
});
