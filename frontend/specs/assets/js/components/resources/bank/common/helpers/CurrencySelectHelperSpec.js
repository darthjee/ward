import CurrencySelectHelper, { LOCKED_HINT } from '../../../../../../../../assets/js/components/resources/bank/common/helpers/CurrencySelectHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const OPTIONS = [
  { code: 'BRL', name: 'Brazilian Real', label: 'BRL — Brazilian Real' },
  { code: 'EUR', name: 'Euro', label: 'EUR — Euro' },
  { code: 'USD', name: 'US Dollar', label: 'USD — US Dollar' },
];

function helperOutput(state = {}) {
  return renderedOutput(CurrencySelectHelper.render(
    {
      options: OPTIONS, filter: '', value: '', locked: false, error: null, idPrefix: 'acc-', ...state,
    },
    { onFilterChange: () => undefined, onSelect: () => undefined },
  ));
}

describe('CurrencySelectHelper', () => {
  it('renders a labelled filter input above a native select', () => {
    const page = helperOutput();

    expect(page.containsInOrder('for="acc-currency"', 'type="search"', '<select', 'size="8"')).toBeTrue();
  });

  it('filters by code', () => {
    const page = helperOutput({ filter: 'usd' });

    expect(page.contains('USD — US Dollar')).toBeTrue();
    expect(page.contains('EUR — Euro')).toBeFalse();
  });

  it('filters by name', () => {
    const page = helperOutput({ filter: 'euro' });

    expect(page.contains('EUR — Euro')).toBeTrue();
    expect(page.contains('BRL')).toBeFalse();
  });

  it('keeps the selected option visible when filtered out', () => {
    const page = helperOutput({ filter: 'euro', value: 'BRL' });

    expect(page.containsInOrder('BRL — Brazilian Real', 'EUR — Euro')).toBeTrue();
    expect(page.contains('USD')).toBeFalse();
  });

  it('ignores an unknown selected value', () => {
    const page = helperOutput({ filter: 'euro', value: 'ZZZ' });

    expect(page.contains('ZZZ')).toBeFalse();
  });

  it('locks both controls with a hint', () => {
    const page = helperOutput({ locked: true, value: 'BRL' });

    expect(page.contains('disabled')).toBeTrue();
    expect(page.contains(LOCKED_HINT.replace("'", '&#x27;'))).toBeTrue();
  });

  it('uses a custom locked hint', () => {
    expect(helperOutput({ locked: true, lockedHint: 'Nope' }).contains('Nope')).toBeTrue();
  });

  it('shows a field error', () => {
    const page = helperOutput({ error: 'Choose a currency' });

    expect(page.contains('is-invalid')).toBeTrue();
    expect(page.contains('Choose a currency')).toBeTrue();
  });
});
