import React from 'react';
import AccountFormHelper, {
  ARCHIVED_NOTICE,
} from '../../../../../../../../../assets/js/components/resources/bank/common/form/helpers/AccountFormHelper.jsx';
import { emptyAccountFields } from '../../../../../../../../../assets/js/components/resources/bank/common/form/controllers/accountFormFields.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const HANDLERS = {
  onSubmit: noop, onFieldChange: noop, onCurrencyChange: noop, onRetry: noop, onDismiss: noop, onRetryLoad: noop,
};
const OPTIONS = { heading: 'New debt', submitLabel: 'Create', cancelHref: '#/bank/debts' };

function output(state = {}, options = {}) {
  return renderedOutput(AccountFormHelper.render({
    fields: emptyAccountFields('BRL'),
    fieldErrors: {},
    submitError: null,
    loadError: null,
    pending: false,
    defaultCurrency: 'BRL',
    settingsFailed: false,
    currencyLocked: false,
    archived: false,
    idPrefix: 'debt-',
    ...state,
  }, HANDLERS, { ...OPTIONS, ...options }));
}

describe('AccountFormHelper', () => {
  it('renders the common fields with the default labels and no slots', () => {
    const page = output();

    expect(page.containsInOrder('Name', 'Bank', 'Currency', 'Opening date', 'Opening balance', 'Notes')).toBeTrue();
    expect(page.contains('Branch')).toBeFalse();
    expect(page.contains('name="type"')).toBeFalse();
  });

  it('applies label overrides', () => {
    const page = output({}, {
      labels: { bank_name: 'Creditor', opening_date: 'Loan date', opening_balance: 'Amount owed' },
    });

    expect(page.containsInOrder('Name', 'Creditor', 'Currency', 'Loan date', 'Amount owed', 'Notes')).toBeTrue();
    expect(page.contains('>Bank<')).toBeFalse();
    expect(page.contains('Opening date')).toBeFalse();
  });

  it('renders the bank extras after the bank and the extra fields before the notes', () => {
    const renderBankExtras = jasmine.createSpy('renderBankExtras').and.returnValue(React.createElement('p', null, 'BANK-EXTRA'));
    const renderExtraFields = jasmine.createSpy('renderExtraFields').and.returnValue(React.createElement('p', null, 'DEBT-FIELDS'));
    const page = output({}, { renderBankExtras, renderExtraFields });

    expect(page.containsInOrder('Bank', 'BANK-EXTRA', 'Currency', 'Opening balance', 'DEBT-FIELDS', 'Notes')).toBeTrue();
    expect(renderBankExtras).toHaveBeenCalledWith(jasmine.objectContaining({ idPrefix: 'debt-' }), HANDLERS);
    expect(renderExtraFields).toHaveBeenCalledWith(jasmine.objectContaining({ idPrefix: 'debt-' }), HANDLERS);
  });

  it('renders the name only, with its label override, on an archived account', () => {
    const renderExtraFields = jasmine.createSpy('renderExtraFields');
    const page = output({ archived: true }, { labels: { name: 'Debt name' }, renderExtraFields });

    expect(page.contains(ARCHIVED_NOTICE)).toBeTrue();
    expect(page.contains('Debt name')).toBeTrue();
    expect(page.contains('Currency')).toBeFalse();
    expect(renderExtraFields).not.toHaveBeenCalled();
  });

  it('shows the heading, submit label and cancel link', () => {
    const page = output();

    expect(page.containsElement('h1', 'New debt')).toBeTrue();
    expect(page.containsElement('button', 'Create')).toBeTrue();
    expect(page.containsAttribute('href', '#/bank/debts')).toBeTrue();
  });
});
