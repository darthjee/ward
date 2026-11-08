import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useAccountLedger from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/hooks/useAccountLedger.js';

describe('useAccountLedger', () => {
  it('starts loading, with a reload function', () => {
    let result;
    const Probe = () => {
      result = useAccountLedger({ kind: 'personal' }, '12', 1);
      return null;
    };

    renderToStaticMarkup(React.createElement(Probe));

    expect(result).toEqual(jasmine.objectContaining({ data: null, loadError: null, notFound: false }));
    expect(() => result.reload()).not.toThrow();
  });
});
