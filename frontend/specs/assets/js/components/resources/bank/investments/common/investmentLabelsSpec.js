import {
  KIND_LABELS,
  KIND_OPTIONS,
  formatLiquidity,
  kindLabel,
} from '../../../../../../../../assets/js/components/resources/bank/investments/common/investmentLabels.js';

describe('investmentLabels', () => {
  it('labels every kind', () => {
    expect([...KIND_LABELS]).toEqual([
      ['fixed_income', 'Fixed income'],
      ['fund', 'Fund'],
      ['stocks', 'Stocks'],
      ['savings', 'Savings'],
      ['pension', 'Pension'],
      ['crypto', 'Crypto'],
      ['other', 'Other'],
    ]);
  });

  it('exposes the kinds as select options', () => {
    expect(KIND_OPTIONS[0]).toEqual(['fixed_income', 'Fixed income']);
    expect(KIND_OPTIONS.length).toBe(7);
  });

  describe('kindLabel', () => {
    it('reads the label', () => {
      expect(kindLabel('crypto')).toBe('Crypto');
    });

    it('is empty for an unset or unknown kind', () => {
      expect(kindLabel(null)).toBe('');
      expect(kindLabel('bonds')).toBe('');
    });
  });

  describe('formatLiquidity', () => {
    it('formats D+N', () => {
      expect(formatLiquidity(0)).toBe('D+0');
      expect(formatLiquidity(30)).toBe('D+30');
    });

    it('is empty when unset', () => {
      expect(formatLiquidity(null)).toBe('');
      expect(formatLiquidity(undefined)).toBe('');
    });
  });
});
