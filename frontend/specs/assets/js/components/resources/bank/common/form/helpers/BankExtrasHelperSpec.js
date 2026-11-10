import BankExtrasHelper from '../../../../../../../../../assets/js/components/resources/bank/common/form/helpers/BankExtrasHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const STATE = {
  fields: { branch: '0001', account_number: '12345-6' }, fieldErrors: {}, idPrefix: 'acc-',
};
const HANDLERS = { onFieldChange: () => undefined };

describe('BankExtrasHelper', () => {
  it('renders branch and account number with the default labels', () => {
    const page = renderedOutput(BankExtrasHelper.render(STATE, HANDLERS));

    expect(page.containsInOrder('Branch', 'value="0001"', 'Account number', 'value="12345-6"')).toBeTrue();
  });

  it('renames the fields with the given labels', () => {
    const page = renderedOutput(BankExtrasHelper.render(STATE, HANDLERS, {
      labels: { accountNumber: 'Customer / contract number' },
    }));

    expect(page.containsInOrder('Branch', 'Customer / contract number')).toBeTrue();
    expect(page.contains('Account number')).toBeFalse();
  });
});
