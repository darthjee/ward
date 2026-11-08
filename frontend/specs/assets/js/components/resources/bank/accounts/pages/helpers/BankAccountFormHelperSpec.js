import BankAccountFormHelper, {
  ARCHIVED_NOTICE,
  SETTINGS_WARNING,
} from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/helpers/BankAccountFormHelper.jsx';
import { emptyAccountFields } from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/controllers/accountFormFields.js';
import { localToday } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { classifyError } from '../../../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const HANDLERS = {
  onSubmit: noop, onFieldChange: noop, onCurrencyChange: noop, onRetry: noop, onDismiss: noop, onRetryLoad: noop,
};
const OPTIONS = { heading: 'New account', submitLabel: 'Create', cancelHref: '#/bank/accounts' };

function output(state = {}) {
  return renderedOutput(BankAccountFormHelper.render({
    fields: emptyAccountFields('BRL'),
    fieldErrors: {},
    submitError: null,
    loadError: null,
    pending: false,
    defaultCurrency: 'BRL',
    settingsFailed: false,
    currencyLocked: false,
    archived: false,
    idPrefix: 'acc-',
    ...state,
  }, HANDLERS, OPTIONS));
}

describe('BankAccountFormHelper', () => {
  it('renders every field in order, without a type field', () => {
    const page = output();

    expect(page.containsInOrder(
      'Name', 'Bank', 'Branch', 'Account number', 'Currency', 'Opening date', 'Opening balance', 'Notes',
    )).toBeTrue();
    expect(page.contains('name="type"')).toBeFalse();
    expect(page.contains('Type')).toBeFalse();
  });

  it('defaults the opening date to today, capped at today, and the balance to 0', () => {
    const page = output();

    expect(page.containsAttribute('value', localToday())).toBeTrue();
    expect(page.containsAttribute('max', localToday())).toBeTrue();
    expect(page.containsInOrder('id="acc-opening_balance"', 'value="0"')).toBeTrue();
  });

  it('renders the currency select with the default selected first', () => {
    expect(output().containsInOrder('Search currency', '<option value="BRL" selected=""')).toBeTrue();
  });

  it('locks the currency select', () => {
    const page = output({ currencyLocked: true });

    expect(page.contains('once the account has transactions')).toBeTrue();
  });

  it('warns when the settings failed', () => {
    const page = output({ settingsFailed: true, defaultCurrency: null, fields: emptyAccountFields() });

    expect(page.contains(SETTINGS_WARNING)).toBeTrue();
    expect(page.contains('selected')).toBeFalse();
  });

  it('shows field errors', () => {
    const page = output({ fieldErrors: { name: 'Name taken', currency: 'Choose a currency' } });

    expect(page.containsInOrder('is-invalid', 'Name taken')).toBeTrue();
    expect(page.contains('Choose a currency')).toBeTrue();
  });

  it('keeps the typed values', () => {
    expect(output({ fields: { ...emptyAccountFields('BRL'), name: 'Typed' } }).containsAttribute('value', 'Typed')).toBeTrue();
  });

  it('lists 400 details above the fields', () => {
    const submitError = classifyError(new ApiError(400, 'x', 'VALIDATION_FAILED', ['a bad', 'b bad']));

    expect(output({ submitError }).containsInOrder('a bad', 'b bad', 'Name')).toBeTrue();
  });

  it('disables Save while pending', () => {
    expect(output({ pending: true }).containsInOrder('type="submit"', 'disabled=""', 'Create')).toBeTrue();
    expect(output().contains('disabled=""')).toBeFalse();
  });

  it('renders only the name for an archived account', () => {
    const page = output({ archived: true });

    expect(page.contains(ARCHIVED_NOTICE)).toBeTrue();
    expect(page.contains('Opening balance')).toBeFalse();
    expect(page.contains('Search currency')).toBeFalse();
  });

  it('renders a loading notice until the fields are loaded', () => {
    expect(output({ fields: null }).contains('Loading')).toBeTrue();
  });

  it('renders the load error with Retry instead of the form', () => {
    const page = output({ fields: null, loadError: classifyError(new TypeError('x')) });

    expect(page.contains('Retry')).toBeTrue();
    expect(page.containsTag('form')).toBeFalse();
    expect(page.contains('Loading')).toBeFalse();
  });

  it('renders the heading and the cancel link', () => {
    const page = output();

    expect(page.containsElement('h1', 'New account')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/accounts"', 'Cancel')).toBeTrue();
  });
});
