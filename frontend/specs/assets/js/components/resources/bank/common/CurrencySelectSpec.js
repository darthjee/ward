import React from 'react';
import CurrencySelect from '../../../../../../../assets/js/components/resources/bank/common/CurrencySelect.jsx';
import CurrencySelectHelper from '../../../../../../../assets/js/components/resources/bank/common/helpers/CurrencySelectHelper.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';

describe('CurrencySelect', () => {
  it('renders the default currency first and selected', () => {
    const page = renderedOutput(React.createElement(CurrencySelect, {
      value: 'BRL', defaultCode: 'BRL', onChange: () => undefined,
    }));

    expect(page.containsInOrder('<option value="BRL" selected="">BRL — Brazilian Real', 'value="AED"')).toBeTrue();
  });

  it('renders no selection without a value', () => {
    const page = renderedOutput(React.createElement(CurrencySelect, { value: '', onChange: () => undefined }));

    expect(page.contains('selected')).toBeFalse();
  });

  it('reports the picked code', () => {
    const onChange = jasmine.createSpy('onChange');
    const handlers = renderCapturingHandlers(
      () => React.createElement(CurrencySelect, { value: '', onChange }),
      CurrencySelectHelper,
    );

    handlers.onSelect({ target: { value: 'USD' } });

    expect(onChange).toHaveBeenCalledWith('USD');
  });

  it('passes a filter change handler', () => {
    const handlers = renderCapturingHandlers(
      () => React.createElement(CurrencySelect, { value: '', onChange: () => undefined }),
      CurrencySelectHelper,
    );

    expect(() => handlers.onFilterChange({ target: { value: 'real' } })).not.toThrow();
  });
});
