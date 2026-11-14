import DisplayLocale from '../../../../../assets/js/utils/locale/DisplayLocale.js';
import { DISPLAY_LOCALES, isDisplayLocale } from '../../../../../assets/js/utils/locale/locales.js';

describe('DisplayLocale', () => {
  afterEach(() => {
    DisplayLocale.set(null);
  });

  it('is undefined by default', () => {
    expect(DisplayLocale.get()).toBeUndefined();
  });

  it('stores an allowlisted locale', () => {
    DisplayLocale.set('pt-BR');

    expect(DisplayLocale.get()).toBe('pt-BR');
  });

  it('clears on null', () => {
    DisplayLocale.set('pt-BR');
    DisplayLocale.set(null);

    expect(DisplayLocale.get()).toBeUndefined();
  });

  it('clears on an unknown value', () => {
    DisplayLocale.set('pt-BR');
    DisplayLocale.set('xx-XX');

    expect(DisplayLocale.get()).toBeUndefined();
  });

  it('notifies only when the value changes', () => {
    const fn = jasmine.createSpy('fn');
    DisplayLocale.subscribe(fn);
    DisplayLocale.set('en-GB');
    DisplayLocale.set('en-GB');
    DisplayLocale.unsubscribe(fn);
    DisplayLocale.set('de-DE');

    expect(fn.calls.allArgs()).toEqual([['en-GB']]);
  });
});

describe('locales', () => {
  it('starts with browser default', () => {
    expect(DISPLAY_LOCALES[0]).toEqual({ value: null, label: 'Browser default' });
  });

  it('recognises allowlisted tags only', () => {
    expect([isDisplayLocale('fr-FR'), isDisplayLocale('pt-br'), isDisplayLocale(null)])
      .toEqual([true, false, false]);
  });
});
