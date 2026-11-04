// Env var toggling TLS on the MySQL connection (`true`/`false`; blank means off).
const SSL_VAR = 'WARD_MYSQL_SSL';
// Env var holding an optional PEM CA bundle (literal `\n` sequences allowed).
const SSL_CA_VAR = 'WARD_MYSQL_SSL_CA';
// Env var naming the runtime environment; TLS is mandatory in production.
const NODE_ENV_VAR = 'NODE_ENV';

/**
 * Reads a raw env var value by name — `(key) => process.env[key]` for the
 * TypeORM CLI, or `(key) => configService.get<string>(key)` inside Nest.
 */
export type EnvReader = (key: string) => string | undefined;

/**
 * The mysql2 `ssl` options Ward hands to TypeORM. Certificate verification
 * is always on; `ca` is only present when a custom CA bundle is configured
 * (otherwise Node's default trusted CAs apply).
 */
export interface MysqlSslOptions {
  ca?: string;
  rejectUnauthorized: true;
}

/**
 * Resolves the MySQL connection's TLS options once, from `WARD_MYSQL_SSL`
 * and `WARD_MYSQL_SSL_CA`. Shared by `data-source.ts` (TypeORM CLI) and
 * `AppModule`'s `TypeOrmModule.forRootAsync` factory, so both connections
 * are configured identically.
 * @param {EnvReader} read - Supplies `WARD_MYSQL_SSL`, `WARD_MYSQL_SSL_CA`
 *   and `NODE_ENV`.
 * @returns {MysqlSslOptions | undefined} The `ssl` options when TLS is on,
 *   or `undefined` (plaintext) when it is off.
 * @throws {Error} When `WARD_MYSQL_SSL` is neither `true`, `false` nor blank,
 *   or when TLS is off while `NODE_ENV=production`.
 */
export function buildMysqlSslOptions(read: EnvReader): MysqlSslOptions | undefined {
  if (!isSslEnabled(read)) {
    assertNotProduction(read);

    return undefined;
  }

  const ca = readTrimmed(read, SSL_CA_VAR);

  if (ca === '') {
    return { rejectUnauthorized: true };
  }

  return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
}

/**
 * Parses the `WARD_MYSQL_SSL` toggle.
 * @param {EnvReader} read - Source of the raw value.
 * @returns {boolean} `true` for `"true"`, `false` for unset/blank/`"false"`
 *   (case-insensitive).
 * @throws {Error} Naming the variable, on any other value.
 */
function isSslEnabled(read: EnvReader): boolean {
  const raw = readTrimmed(read, SSL_VAR).toLowerCase();

  if (raw === 'true') {
    return true;
  }

  if (raw === '' || raw === 'false') {
    return false;
  }

  throw new Error(`Invalid ${SSL_VAR} "${raw}": must be "true" or "false"`);
}

/**
 * Refuses a plaintext MySQL connection in production.
 * @param {EnvReader} read - Supplies `NODE_ENV`.
 * @returns {void} Returns normally outside production.
 * @throws {Error} When `NODE_ENV` is `production`.
 */
function assertNotProduction(read: EnvReader): void {
  if (readTrimmed(read, NODE_ENV_VAR) === 'production') {
    throw new Error(`${SSL_VAR} must be "true" when ${NODE_ENV_VAR}=production`);
  }
}

/**
 * Reads an env var and trims it.
 * @param {EnvReader} read - Source of the raw value.
 * @param {string} name - The env var name.
 * @returns {string} The trimmed value, or `''` when unset.
 */
function readTrimmed(read: EnvReader, name: string): string {
  return (read(name) ?? '').trim();
}
