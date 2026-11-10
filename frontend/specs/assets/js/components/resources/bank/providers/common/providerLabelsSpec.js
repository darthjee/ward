import {
  EMPTY_MARK, FREQUENCY_OPTIONS, PROVIDER_FIELD_LABELS, forAccountantLabel, formatExpected,
} from '../../../../../../../../assets/js/components/resources/bank/providers/common/providerLabels.js';
import { formatMoney } from '../../../../../../../../assets/js/components/resources/bank/common/amounts.js';

describe('providerLabels', () => {
  describe('formatExpected', () => {
    it('adds "/ month" for a monthly charge', () => {
      expect(formatExpected('200.00', 'monthly', 'BRL')).toBe(`${formatMoney('200.00', 'BRL')} / month`);
    });

    it('adds "/ year" for a yearly charge', () => {
      expect(formatExpected('1200', 'yearly', 'JPY')).toBe(`${formatMoney('1200', 'JPY')} / year`);
    });

    it('shows "—" without an expected amount', () => {
      expect(formatExpected(null, 'monthly', 'BRL')).toBe('—');
      expect(formatExpected(undefined, undefined, 'BRL')).toBe(EMPTY_MARK);
    });
  });

  describe('forAccountantLabel', () => {
    it('reads "Yes" for a business expense and "—" otherwise', () => {
      expect(forAccountantLabel(true)).toBe('Yes');
      expect(forAccountantLabel(false)).toBe('—');
      expect(forAccountantLabel(null)).toBe('—');
    });
  });

  it('lists the frequencies, monthly first', () => {
    expect(FREQUENCY_OPTIONS).toEqual([['monthly', 'Monthly'], ['yearly', 'Yearly']]);
  });

  it('renames the shared bank fields', () => {
    expect(PROVIDER_FIELD_LABELS).toEqual({
      bankName: 'Provider', branch: 'Branch', accountNumber: 'Customer / contract number',
    });
  });
});
