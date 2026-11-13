import React from 'react';
import BankDebtNew from '../../../../../../../../assets/js/components/resources/bank/debts/pages/BankDebtNew.jsx';
import BankDebtEdit from '../../../../../../../../assets/js/components/resources/bank/debts/pages/BankDebtEdit.jsx';
import BankDebtFormHelper from '../../../../../../../../assets/js/components/resources/bank/debts/pages/helpers/BankDebtFormHelper.jsx';
import BankDebtNewController from '../../../../../../../../assets/js/components/resources/bank/debts/pages/controllers/BankDebtNewController.js';
import BankDebtEditController from '../../../../../../../../assets/js/components/resources/bank/debts/pages/controllers/BankDebtEditController.js';
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

  spyOn(BankDebtFormHelper, 'render').and.callFake((state, handlers, options) => {
    captured = { state, handlers, options };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

const fakeEvent = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

describe('bank debt form pages', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('BankDebtNew', () => {
    it('renders an idle debt create form in Personal', () => {
      const page = renderedOutput(React.createElement(inContext(BankDebtNew)));

      expect(page.containsElement('h1', 'New debt')).toBeTrue();
      expect(page.containsAttribute('href', '#/bank/debts')).toBeTrue();
      expect(page.containsInOrder('Creditor', 'Loan date', 'Amount owed', 'Interest rate')).toBeTrue();
      expect(page.contains('name="type"')).toBeFalse();
    });

    it('builds the cancel link under an organization, with the empty debt fields', () => {
      const { options, state } = capture(inContext(BankDebtNew, ORG));

      expect(options.cancelHref).toBe('#/orgs/5/bank/debts');
      expect(state.fields.instalment_frequency).toBe('monthly');
      expect(state.idPrefix).toBe('bank-debt-new-');
      expect(state.fields).toEqual(jasmine.objectContaining({ bills_from: '', show_in_calendar: true, paying_account_id: '' }));
      expect(state.payingAccounts).toBeNull();
    });

    it('renders the schedule inputs', () => {
      const page = renderedOutput(React.createElement(inContext(BankDebtNew)));

      expect(page.containsInOrder('Bills from', 'Show in Calendar', 'Default paying account')).toBeTrue();
    });

    it('submits the current fields through the debt controller', async () => {
      spyOn(BankDebtNewController.prototype, 'handleSubmit').and.resolveTo();
      const { handlers, state } = capture(inContext(BankDebtNew));
      const event = fakeEvent();

      await handlers.onSubmit(event);
      await handlers.onRetry();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(BankDebtNewController.prototype.handleSubmit).toHaveBeenCalledWith(state.fields);
      expect(BankDebtNewController.prototype.handleSubmit.calls.count()).toBe(2);
    });
  });

  describe('BankDebtEdit', () => {
    beforeEach(() => {
      installFakeWindow({ location: { hash: '#/orgs/5/bank/debts/7/edit' } });
    });

    it('renders the loading state', () => {
      const page = renderedOutput(React.createElement(inContext(BankDebtEdit, ORG)));

      expect(page.containsElement('h1', 'Edit debt')).toBeTrue();
      expect(page.contains('Loading')).toBeTrue();
    });

    it('reads the debt id from the hash for the cancel link', () => {
      const { options, state } = capture(inContext(BankDebtEdit, ORG));

      expect(options.cancelHref).toBe('#/orgs/5/bank/debts/7');
      expect(state.fields).toBeNull();
      expect(state.idPrefix).toBe('bank-debt-edit-');
      expect(state.payingAccounts).toBeNull();
    });

    it('does not submit before the debt is loaded, and wires retries', () => {
      spyOn(BankDebtEditController.prototype, 'handleSubmit');
      const { handlers } = capture(inContext(BankDebtEdit, ORG));

      handlers.onSubmit(fakeEvent());

      expect(BankDebtEditController.prototype.handleSubmit).not.toHaveBeenCalled();

      handlers.onRetry();
      handlers.onRetryLoad();

      expect(BankDebtEditController.prototype.handleSubmit).toHaveBeenCalledWith('7', null, null);
    });
  });
});
