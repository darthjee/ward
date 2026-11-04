import { buildMysqlSslOptions } from '../mysql-ssl.js';

/**
 * Runs `buildMysqlSslOptions` against a fake env.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {ReturnType<typeof buildMysqlSslOptions>} The resolved options.
 */
function build(env: Record<string, string | undefined>): ReturnType<typeof buildMysqlSslOptions> {
  return buildMysqlSslOptions((key) => env[key]);
}

describe('buildMysqlSslOptions', () => {
  describe('when TLS is off', () => {
    it('returns undefined when WARD_MYSQL_SSL is unset', () => {
      expect(build({})).toBeUndefined();
    });

    it('returns undefined when WARD_MYSQL_SSL is blank', () => {
      expect(build({ WARD_MYSQL_SSL: '  ' })).toBeUndefined();
    });

    it('returns undefined when WARD_MYSQL_SSL is "false"', () => {
      expect(build({ WARD_MYSQL_SSL: 'false' })).toBeUndefined();
    });

    it('accepts "FALSE" case-insensitively', () => {
      expect(build({ WARD_MYSQL_SSL: ' FALSE ' })).toBeUndefined();
    });

    it('ignores WARD_MYSQL_SSL_CA', () => {
      expect(build({ WARD_MYSQL_SSL: 'false', WARD_MYSQL_SSL_CA: 'pem' })).toBeUndefined();
    });

    it('succeeds outside production', () => {
      expect(build({ NODE_ENV: 'development' })).toBeUndefined();
    });

    it('throws when NODE_ENV=production', () => {
      expect(() => build({ NODE_ENV: 'production' })).toThrow(
        'WARD_MYSQL_SSL must be "true" when NODE_ENV=production',
      );
    });

    it('throws when NODE_ENV=production (trimmed) and WARD_MYSQL_SSL is "false"', () => {
      expect(() => build({ NODE_ENV: ' production ', WARD_MYSQL_SSL: 'false' })).toThrow(
        'WARD_MYSQL_SSL must be "true" when NODE_ENV=production',
      );
    });
  });

  describe('when TLS is on', () => {
    it('verifies against the system CAs when WARD_MYSQL_SSL_CA is unset', () => {
      const options = build({ WARD_MYSQL_SSL: 'true' });

      expect(options).toEqual({ rejectUnauthorized: true });
      expect(options).not.toHaveProperty('ca');
    });

    it('accepts " TRUE " case-insensitively', () => {
      expect(build({ WARD_MYSQL_SSL: ' TRUE ' })).toEqual({ rejectUnauthorized: true });
    });

    it('omits ca when WARD_MYSQL_SSL_CA is blank', () => {
      expect(build({ WARD_MYSQL_SSL: 'true', WARD_MYSQL_SSL_CA: '   ' })).toEqual({ rejectUnauthorized: true });
    });

    it('uses a custom CA, unescaping literal \\n sequences', () => {
      const ca = '-----BEGIN CERTIFICATE-----\\nABC\\nDEF\\n-----END CERTIFICATE-----';

      expect(build({ WARD_MYSQL_SSL: 'true', WARD_MYSQL_SSL_CA: ca })).toEqual({
        ca: '-----BEGIN CERTIFICATE-----\nABC\nDEF\n-----END CERTIFICATE-----',
        rejectUnauthorized: true,
      });
    });

    it('keeps a CA that already has real newlines', () => {
      const ca = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----';

      expect(build({ WARD_MYSQL_SSL: 'true', WARD_MYSQL_SSL_CA: ca })).toEqual({ ca, rejectUnauthorized: true });
    });

    it('succeeds when NODE_ENV=production', () => {
      expect(build({ NODE_ENV: 'production', WARD_MYSQL_SSL: 'true' })).toEqual({ rejectUnauthorized: true });
    });
  });

  describe('with an invalid WARD_MYSQL_SSL', () => {
    it.each(['yes', '1', 'on', 'ture'])('throws naming the variable for "%s"', (value) => {
      expect(() => build({ WARD_MYSQL_SSL: value })).toThrow(/WARD_MYSQL_SSL/);
    });

    it('throws even outside production', () => {
      expect(() => build({ NODE_ENV: 'development', WARD_MYSQL_SSL: 'yes' })).toThrow(
        'Invalid WARD_MYSQL_SSL "yes": must be "true" or "false"',
      );
    });
  });
});
