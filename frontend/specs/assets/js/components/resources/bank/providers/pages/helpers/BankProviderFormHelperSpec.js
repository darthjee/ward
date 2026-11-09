import BankProviderFormHelper, {
  ARCHIVED_NOTICE,
  SETTINGS_WARNING,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/BankProviderFormHelper.jsx';
import { emptyProviderFields } from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/providerFormFields.js';
import { monthName } from '../../../../../../../../../assets/js/components/resources/bank/common/dates.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const HANDLERS = {
  onSubmit: noop, onFieldChange: noop, onCurrencyChange: noop, onRetry: noop, onDismiss: noop, onRetryLoad: noop,
};
const OPTIONS = { heading: 'New provider', submitLabel: 'Create', cancelHref: '#/bank/providers' };

function output(state = {}, fields = {}) {
  return renderedOutput(BankProviderFormHelper.render({
    fields: { ...emptyProviderFields('BRL', '2026-05-01'), ...fields },
    fieldErrors: {},
    submitError: null,
    loadError: null,
    pending: false,
    defaultCurrency: 'BRL',
    settingsFailed: false,
    currencyLocked: false,
    archived: false,
    idPrefix: 'prov-',
    ...state,
  }, HANDLERS, OPTIONS));
}

describe('BankProviderFormHelper', () => {
  it('re-exports the shared notices', () => {
    expect(ARCHIVED_NOTICE).toContain('archived');
    expect(SETTINGS_WARNING).toContain('default currency');
  });

  it('renders the provider labels and fields in order, without a type field', () => {
    const page = output();

    expect(page.containsElement('h1', 'New provider')).toBeTrue();
    expect(page.containsInOrder(
      'Name', 'Provider', 'Branch', 'Customer / contract number', 'Currency', 'Opening date', 'Opening balance',
      'For accountant', 'Provider tax id', 'Expected amount', 'Frequency', 'Due day', 'Notes',
    )).toBeTrue();
    expect(page.contains('>Bank<')).toBeFalse();
    expect(page.contains('Account number')).toBeFalse();
    expect(page.contains('name="type"')).toBeFalse();
  });

  it('checks For accountant by default', () => {
    expect(output().containsInOrder('id="prov-for_accountant"', 'checked=""')).toBeTrue();
    expect(output({}, { for_accountant: false }).containsInOrder('id="prov-for_accountant"', 'checked=""', 'Provider tax id'))
      .toBeFalse();
  });

  it('offers the monthly and yearly frequencies', () => {
    expect(output().containsInOrder('<option value="monthly" selected="">Monthly', 'Yearly')).toBeTrue();
  });

  it('shows Due month only for a yearly frequency', () => {
    expect(output().contains('Due month')).toBeFalse();
    expect(output({}, { charge_frequency: 'yearly' }).containsInOrder('Due day', 'Due month', monthName(1), monthName(12)))
      .toBeTrue();
  });

  it('shows the provider field errors inline', () => {
    const page = output({ fieldErrors: { provider_tax_id: 'Use at most 32 characters', due_month: 'Choose the due month' } }, { charge_frequency: 'yearly' });

    expect(page.containsElement('div', 'Use at most 32 characters')).toBeTrue();
    expect(page.containsElement('div', 'Choose the due month')).toBeTrue();
  });

  it('renders only the name of an archived provider', () => {
    const page = output({ archived: true });

    expect(page.contains(ARCHIVED_NOTICE)).toBeTrue();
    expect(page.contains('Provider tax id')).toBeFalse();
  });
});
