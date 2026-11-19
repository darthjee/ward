import {
  EMPTY_MARK, FREQUENCY_OPTIONS, PROVIDER_FIELD_LABELS, billsSummaryParts, forAccountantLabel,
  formatBillsSummary, formatExpected,
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

  describe('billsSummaryParts', () => {
    const monthly = `${formatMoney('250.00', 'BRL')} / month`;
    const yearly = `${formatMoney('1200.00', 'BRL')} / year`;

    it('adds the monthly sum only', () => {
      expect(billsSummaryParts({ count: 1, monthly: '250.00', yearly: null }, 'BRL'))
        .toEqual(['1 bill', monthly]);
    });

    it('adds the yearly sum only', () => {
      expect(billsSummaryParts({ count: 1, monthly: '0.00', yearly: '1200.00' }, 'BRL'))
        .toEqual(['1 bill', yearly]);
    });

    it('adds both sums, monthly first', () => {
      expect(billsSummaryParts({ count: 3, monthly: '250.00', yearly: '1200.00' }, 'BRL'))
        .toEqual(['3 bills', monthly, yearly]);
    });

    it('shows the count only for recurring bills without an expected amount', () => {
      expect(billsSummaryParts({ count: 2, monthly: null, yearly: null }, 'BRL')).toEqual(['2 bills']);
    });

    it('shows the count only for one-off bills', () => {
      expect(billsSummaryParts({ count: 2, monthly: '0.00', yearly: '0.00' }, 'BRL')).toEqual(['2 bills']);
    });

    it('omits both null and zero sums', () => {
      expect(billsSummaryParts({ count: 1, monthly: null, yearly: '0.00' }, 'BRL')).toEqual(['1 bill']);
      expect(billsSummaryParts({ count: 1, monthly: '', yearly: 0 }, 'BRL')).toEqual(['1 bill']);
    });

    it('shows "—" without bills', () => {
      expect(billsSummaryParts({ count: 0, monthly: null, yearly: null }, 'BRL')).toEqual([EMPTY_MARK]);
    });

    it('pluralises the count', () => {
      expect(billsSummaryParts({ count: 1 }, 'BRL')).toEqual(['1 bill']);
      expect(billsSummaryParts({ count: 2 }, 'BRL')).toEqual(['2 bills']);
    });

    it('returns null for a missing summary', () => {
      expect(billsSummaryParts(undefined, 'BRL')).toBeNull();
      expect(billsSummaryParts(null, 'BRL')).toBeNull();
    });
  });

  describe('formatBillsSummary', () => {
    it('joins the count and the sums', () => {
      expect(formatBillsSummary({ count: 3, monthly: '250.00', yearly: '1200.00' }, 'BRL')).toBe(
        `3 bills · ${formatMoney('250.00', 'BRL')} / month + ${formatMoney('1200.00', 'BRL')} / year`,
      );
    });

    it('shows a single sum after the count', () => {
      expect(formatBillsSummary({ count: 1, monthly: '250.00', yearly: null }, 'BRL'))
        .toBe(`1 bill · ${formatMoney('250.00', 'BRL')} / month`);
    });

    it('shows the count alone without sums', () => {
      expect(formatBillsSummary({ count: 2, monthly: null, yearly: '0.00' }, 'BRL')).toBe('2 bills');
    });

    it('shows "—" without bills and nothing for a missing summary', () => {
      expect(formatBillsSummary({ count: 0 }, 'BRL')).toBe('—');
      expect(formatBillsSummary(undefined, 'BRL')).toBe('');
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
