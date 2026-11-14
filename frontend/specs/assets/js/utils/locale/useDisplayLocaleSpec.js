import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import DisplayLocale from '../../../../../assets/js/utils/locale/DisplayLocale.js';
import useDisplayLocale from '../../../../../assets/js/utils/locale/useDisplayLocale.js';

function probe() {
  let result;
  const Probe = () => {
    result = useDisplayLocale();
    return null;
  };

  renderToStaticMarkup(React.createElement(Probe));

  return result;
}

describe('useDisplayLocale', () => {
  afterEach(() => {
    DisplayLocale.set(null);
  });

  it('returns undefined by default', () => {
    expect(probe()).toBeUndefined();
  });

  it('returns the stored locale', () => {
    DisplayLocale.set('fr-FR');

    expect(probe()).toBe('fr-FR');
  });
});
