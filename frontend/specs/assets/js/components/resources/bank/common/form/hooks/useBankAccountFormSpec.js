import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useBankAccountForm, {
  buildFieldHandlers,
} from '../../../../../../../../../assets/js/components/resources/bank/common/form/hooks/useBankAccountForm.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';

describe('useBankAccountForm', () => {
  describe('buildFieldHandlers', () => {
    let fields;
    let setFields;
    let setSubmitError;

    beforeEach(() => {
      fields = { name: 'a', currency: '' };
      setFields = jasmine.createSpy('setFields').and.callFake((update) => {
        fields = update(fields);
      });
      setSubmitError = jasmine.createSpy('setSubmitError');
    });

    it('updates the field named by the input', () => {
      buildFieldHandlers(setFields, setSubmitError).onFieldChange({ target: { name: 'name', value: 'b' } });

      expect(fields).toEqual({ name: 'b', currency: '' });
    });

    it('updates the currency', () => {
      buildFieldHandlers(setFields, setSubmitError).onCurrencyChange('USD');

      expect(fields.currency).toBe('USD');
    });

    it('dismisses the submit error', () => {
      buildFieldHandlers(setFields, setSubmitError).onDismiss();

      expect(setSubmitError).toHaveBeenCalledWith(null);
    });
  });

  it('exposes the context and the initial state', () => {
    let result;
    const Probe = () => {
      result = useBankAccountForm({ name: '' });
      return null;
    };
    const context = { kind: 'organization', orgId: 5 };

    renderToStaticMarkup(React.createElement(
      OwnerContext.Provider,
      { value: { ...DEFAULT_OWNER_CONTEXT, context } },
      React.createElement(Probe),
    ));

    expect(result).toEqual(jasmine.objectContaining({
      context, fields: { name: '' }, fieldErrors: {}, submitError: null, pending: false, notFound: false,
    }));
  });
});
