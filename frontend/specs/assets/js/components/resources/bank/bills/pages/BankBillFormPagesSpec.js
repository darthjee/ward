import React from 'react';
import BankBillNew from '../../../../../../../../assets/js/components/resources/bank/bills/pages/BankBillNew.jsx';
import BankBillEdit from '../../../../../../../../assets/js/components/resources/bank/bills/pages/BankBillEdit.jsx';
import BankBillFormHelper from '../../../../../../../../assets/js/components/resources/bank/bills/pages/helpers/BankBillFormHelper.jsx';
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

  spyOn(BankBillFormHelper, 'render').and.callFake((state, handlers, options) => {
    captured = { state, handlers, options };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

describe('bank bill pages', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  describe('BankBillNew', () => {
    it('renders the loading new bill page', () => {
      installFakeWindow({ location: { hash: '#/bank/bills/new' } });
      const page = renderedOutput(React.createElement(inContext(BankBillNew)));

      expect(page.containsElement('h1', 'New bill')).toBeTrue();
      expect(page.contains('Loading')).toBeTrue();
    });

    it('pre-selects ?provider= and cancels back to that provider', () => {
      installFakeWindow({ location: { hash: '#/orgs/5/bank/bills/new?provider=3' } });
      const { state, options } = capture(inContext(BankBillNew, ORG));

      expect(options).toEqual({ heading: 'New bill', submitLabel: 'Create', cancelHref: '#/orgs/5/bank/providers/3' });
      expect(state.fields).toBeNull();
      expect(state.canDelete).toBeFalse();
      expect(state.idPrefix).toBe('bank-bill-new-');
    });

    it('cancels to the providers list without a provider', () => {
      installFakeWindow({ location: { hash: '#/bank/bills/new' } });

      expect(capture(inContext(BankBillNew)).options.cancelHref).toBe('#/bank/providers');
    });
  });

  describe('BankBillEdit', () => {
    it('renders the loading edit page, with Delete enabled once loaded', () => {
      installFakeWindow({ location: { hash: '#/orgs/5/bank/bills/9/edit' } });
      const { state, options } = capture(inContext(BankBillEdit, ORG));

      expect(options.heading).toBe('Edit bill');
      expect(options.submitLabel).toBe('Save');
      expect(options.cancelHref).toBe('#/orgs/5/bank/providers');
      expect(state.canDelete).toBeTrue();
      expect(state.idPrefix).toBe('bank-bill-edit-');
    });
  });
});
