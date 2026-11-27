import BankProviderFormHelper, {
  ARCHIVED_NOTICE,
  SETTINGS_WARNING,
} from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/helpers/BankProviderFormHelper.jsx';
import { emptyProviderFields } from '../../../../../../../../../assets/js/components/resources/bank/providers/pages/controllers/providerFormFields.js';
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
    openingLocked: false,
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
      'For accountant', 'Provider tax id', 'Notes',
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

  it('renders no schedule inputs', () => {
    const page = output();

    ['Expected amount', 'Frequency', 'Due day', 'Due month', 'Bills from', 'Show in Calendar', 'Default paying account']
      .forEach((label) => expect(page.contains(label)).toBeFalse());
  });

  it('shows the tax id error inline', () => {
    expect(output({ fieldErrors: { provider_tax_id: 'Use at most 32 characters' } }).containsElement('div', 'Use at most 32 characters'))
      .toBeTrue();
  });

  it('renders only the name of an archived provider', () => {
    const page = output({ archived: true });

    expect(page.contains(ARCHIVED_NOTICE)).toBeTrue();
    expect(page.contains('Provider tax id')).toBeFalse();
    expect(page.contains('Default paying account')).toBeFalse();
  });
});
