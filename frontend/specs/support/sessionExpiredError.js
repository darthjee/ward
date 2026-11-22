import ApiError from '../../assets/js/client/ApiError.js';

/**
 * Build the error `ApiClient` rejects with when the session could not be recovered: the
 * original `401` `ApiError`, marked as `sessionExpired`.
 *
 * @returns {ApiError} A session-expired `ApiError`.
 */
export default function sessionExpiredError() {
  const error = new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');

  error.sessionExpired = true;

  return error;
}
