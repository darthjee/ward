import BankDebtFormHelper, {
  ARCHIVED_NOTICE,
} from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/helpers/BankDebtFormHelper.jsx';
import { emptyDebtFields } from '../../../../../../../../../assets/js/components/resources/bank/debts/pages/controllers/debtFormFields.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const noop = () => undefined;
const HANDLERS = {
  onSubmit: noop, onFieldChange: noop, onCurrencyChange: noop, onRetry: noop, onDismiss: noop, onRetryLoad: noop,
};
const OPTIONS = { heading: 'New debt', submitLabel: 'Create', cancelHref: '#/bank/debts' };

function output(fields = {}, state = {}) {
  return renderedOutput(BankDebtFormHelper.render({
    fields: { ...emptyDebtFields('BRL', '2026-01-01'), ...fields },
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
  }, HANDLERS, OPTIONS));
}

describe('BankDebtFormHelper', () => {
  it('relabels the common fields: Creditor, Loan date and Amount owed', () => {
    const page = output();

    expect(page.containsInOrder('Name', 'Creditor', 'Currency', 'Loan date', 'Amount owed', 'Notes')).toBeTrue();
    expect(page.contains('>Bank<')).toBeFalse();
    expect(page.contains('Opening date')).toBeFalse();
    expect(page.contains('Opening balance')).toBeFalse();
  });

  it('shows no type, branch or account number field', () => {
    const page = output();

    expect(page.contains('name="type"')).toBeFalse();
    expect(page.contains('Type')).toBeFalse();
    expect(page.contains('Branch')).toBeFalse();
    expect(page.contains('Account number')).toBeFalse();
  });

  it('renders the debt fields before the notes', () => {
    expect(output().containsInOrder(
      'Amount owed', 'Interest rate', 'Instalment amount', 'Frequency', 'Due day', 'Instalment count', 'Notes',
    )).toBeTrue();
  });

  it('shows the interest period only once a rate is entered', () => {
    expect(output().contains('Interest period')).toBeFalse();
    expect(output({ interest_rate: ' ' }).contains('Interest period')).toBeFalse();
    expect(output({ interest_rate: '1.99' }).containsInOrder('Interest rate', 'Interest period', 'Instalment amount')).toBeTrue();
  });

  it('shows the due month only for a yearly frequency', () => {
    expect(output().contains('Due month')).toBeFalse();
    expect(output({ instalment_frequency: 'yearly' }).containsInOrder('Due day', 'Due month', 'Instalment count')).toBeTrue();
  });

  it('shows the amount owed as typed', () => {
    expect(output({ opening_balance: '10000.00' }).containsInOrder('id="debt-opening_balance"', 'value="10000.00"')).toBeTrue();
  });

  it('shows the debt field errors', () => {
    const page = output({ interest_rate: '3' }, { fieldErrors: { interest_period: 'Choose the interest period' } });

    expect(page.contains('Choose the interest period')).toBeTrue();
  });

  it('renders the name only on an archived debt', () => {
    const page = output({}, { archived: true });

    expect(page.contains(ARCHIVED_NOTICE)).toBeTrue();
    expect(page.contains('Interest rate')).toBeFalse();
    expect(page.contains('Creditor')).toBeFalse();
  });
});
