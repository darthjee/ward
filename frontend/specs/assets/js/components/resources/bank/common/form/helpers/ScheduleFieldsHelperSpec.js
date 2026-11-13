import ScheduleFieldsHelper, {
  NO_PAYING_ACCOUNT,
} from '../../../../../../../../../assets/js/components/resources/bank/common/form/helpers/ScheduleFieldsHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ACCOUNTS = [
  { id: 1, name: 'Main', currency: 'BRL', type: 'regular' },
  { id: 2, name: 'Travel', currency: 'USD', type: 'regular' },
];

function output(fields = {}, state = {}) {
  return renderedOutput(ScheduleFieldsHelper.render({
    fields: {
      currency: 'BRL', bills_from: '', show_in_calendar: true, paying_account_id: '', ...fields,
    },
    fieldErrors: {},
    idPrefix: 's-',
    payingAccounts: ACCOUNTS,
    ...state,
  }, { onFieldChange: () => undefined }));
}

describe('ScheduleFieldsHelper', () => {
  it('renders the three inputs in order', () => {
    expect(output().containsInOrder('Bills from', 'Show in Calendar', 'Default paying account')).toBeTrue();
  });

  it('renders Bills from as a date input', () => {
    expect(output({ bills_from: '2026-01-02' }).containsInOrder('id="s-bills_from"', 'type="date"', 'value="2026-01-02"'))
      .toBeTrue();
  });

  it('checks Show in Calendar by default', () => {
    expect(output().containsInOrder('id="s-show_in_calendar"', 'checked=""')).toBeTrue();
    expect(output({ show_in_calendar: false }).contains('checked=""')).toBeFalse();
  });

  it('lists only the accounts in the form currency, with an empty option', () => {
    const page = output();

    expect(page.containsElement('option', NO_PAYING_ACCOUNT)).toBeTrue();
    expect(page.containsElement('option', 'Main')).toBeTrue();
    expect(page.containsElement('option', 'Travel')).toBeFalse();
  });

  it('lists only the empty option while loading', () => {
    const page = output({}, { payingAccounts: null });

    expect(page.containsElement('option', NO_PAYING_ACCOUNT)).toBeTrue();
    expect(page.containsElement('option', 'Main')).toBeFalse();
  });

  it('escapes the paying account names', () => {
    const page = output({}, { payingAccounts: [{ id: 1, name: '<script>x</script>', currency: 'BRL', type: 'regular' }] });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.contains('&lt;script&gt;x&lt;/script&gt;')).toBeTrue();
  });

  it('shows the Bills from error', () => {
    expect(output({}, { fieldErrors: { bills_from: 'Enter a valid date' } }).contains('Enter a valid date')).toBeTrue();
  });
});
