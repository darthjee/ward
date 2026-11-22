import ApiError from '../../../../assets/js/client/ApiError.js';
import isSessionExpired from '../../../../assets/js/client/isSessionExpired.js';

describe('isSessionExpired', () => {
  it('is true for an ApiError marked as session expired', () => {
    const error = new ApiError(401, 'Unauthorized');

    error.sessionExpired = true;

    expect(isSessionExpired(error)).toBe(true);
  });

  it('is false for an unmarked ApiError', () => {
    expect(isSessionExpired(new ApiError(401, 'Invalid username or password'))).toBe(false);
  });

  it('is false for a plain Error', () => {
    const error = new Error('boom');

    error.sessionExpired = true;

    expect(isSessionExpired(error)).toBe(false);
  });

  it('is false for undefined', () => {
    expect(isSessionExpired(undefined)).toBe(false);
  });
});
