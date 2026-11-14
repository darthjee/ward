import { USER_LOCALES, isUserLocale } from '../user-locale.js';

describe('isUserLocale', () => {
  it.each([...USER_LOCALES])('accepts %s', (value) => {
    expect(isUserLocale(value)).toBe(true);
  });

  it.each(['pt-br', '', 'xx-XX', null, 1, {}])('rejects %p', (value) => {
    expect(isUserLocale(value)).toBe(false);
  });
});
