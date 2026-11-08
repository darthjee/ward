import BankInvestmentFormHelper, {
  ARCHIVED_NOTICE,
} from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentFormHelper.jsx';
import { emptyInvestmentFields } from '../../../../../../../../../assets/js/components/resources/bank/investments/pages/controllers/investmentFormFields.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const HANDLERS = {
  onSubmit: noop, onFieldChange: noop, onCurrencyChange: noop, onRetry: noop, onDismiss: noop, onRetryLoad: noop,
};
const OPTIONS = { heading: 'New investment', submitLabel: 'Create', cancelHref: '#/bank/investments' };

function output(fields = {}, state = {}) {
  return renderedOutput(BankInvestmentFormHelper.render({
    fields: { ...emptyInvestmentFields('BRL', '2026-01-01'), ...fields },
    fieldErrors: {},
    submitError: null,
    loadError: null,
    pending: false,
    defaultCurrency: 'BRL',
    settingsFailed: false,
    currencyLocked: false,
    archived: false,
    idPrefix: 'inv-',
    ...state,
  }, HANDLERS, OPTIONS));
}

describe('BankInvestmentFormHelper', () => {
  it('relabels the common fields: Institution and Start date', () => {
    const page = output();

    expect(page.containsInOrder('Name', 'Institution', 'Currency', 'Start date', 'Notes')).toBeTrue();
    expect(page.contains('>Bank<')).toBeFalse();
    expect(page.contains('Opening date')).toBeFalse();
  });

  it('shows no opening-balance field', () => {
    const page = output();

    expect(page.contains('Opening balance')).toBeFalse();
    expect(page.contains('name="opening_balance"')).toBeFalse();
  });

  it('shows no type, branch or account number field', () => {
    const page = output();

    expect(page.contains('name="type"')).toBeFalse();
    expect(page.contains('Branch')).toBeFalse();
    expect(page.contains('Account number')).toBeFalse();
  });

  it('renders the optional investment fields before the notes', () => {
    expect(output().containsInOrder('Start date', 'Kind', 'Yield rate (%)', 'Maturity date', 'Liquidity (D+N)', 'Notes'))
      .toBeTrue();
  });

  it('offers every kind with an empty first option', () => {
    const page = output({ kind: 'crypto' });

    expect(page.containsInOrder('name="kind"', '<option value="">', 'Fixed income', 'Fund', 'Stocks', 'Savings', 'Pension'))
      .toBeTrue();
    expect(page.contains('<option value="crypto" selected="">Crypto')).toBeTrue();
  });

  it('shows the yield period only once a rate is entered', () => {
    expect(output().contains('Yield period')).toBeFalse();
    expect(output({ yield_rate: ' ' }).contains('Yield period')).toBeFalse();
    expect(output({ yield_rate: '1.1' }).containsInOrder('Yield rate (%)', 'Yield period', 'Maturity date')).toBeTrue();
  });

  it('shows the investment field errors', () => {
    const page = output({ yield_rate: '3' }, {
      fieldErrors: { yield_period: 'Choose the yield period', liquidity_days: 'Enter a whole number of days (0 or more)' },
    });

    expect(page.contains('Choose the yield period')).toBeTrue();
    expect(page.contains('Enter a whole number of days (0 or more)')).toBeTrue();
  });

  it('shows the Start date errors', () => {
    expect(output({}, { fieldErrors: { opening_date: 'Start date is required' } }).contains('Start date is required')).toBeTrue();
  });

  it('renders the name only on an archived investment', () => {
    const page = output({}, { archived: true });

    expect(page.contains(ARCHIVED_NOTICE)).toBeTrue();
    expect(page.contains('Kind')).toBeFalse();
    expect(page.contains('Institution')).toBeFalse();
  });
});
