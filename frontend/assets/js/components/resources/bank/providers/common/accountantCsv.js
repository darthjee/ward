/** The CSV header row (decided in #55): English, seven columns. */
export const ACCOUNTANT_CSV_HEADER = [
  'Date', 'Account', 'Provider', 'Provider tax id', 'Description', 'Amount', 'Currency',
];

/** UTF-8 byte order mark, so spreadsheets read accents correctly. */
export const CSV_BOM = '\uFEFF';

/** Line ending of the CSV rows (RFC 4180). */
export const CSV_EOL = '\r\n';

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Quote one CSV field: wrap it in `"` and double every embedded `"`. `null` / `undefined`
 * become an empty quoted field.
 *
 * @param {*} value - The field value.
 * @returns {string} The quoted field.
 */
function quote(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

/**
 * Neutralise a text cell against formula injection: a value starting with `=`, `+`, `-`, `@`,
 * tab or carriage return gets a leading `'` (OWASP).
 *
 * @param {string|null} value - The text value.
 * @returns {string} The safe text.
 */
function safeText(value) {
  const textValue = String(value ?? '');

  return FORMULA_START.test(textValue) ? `'${textValue}` : textValue;
}

/**
 * Build the CSV row of one preview charge. Text cells are neutralised; the amount is the API
 * decimal string, unprefixed (a negative stays `-129.90`).
 *
 * @param {object} charge - The preview charge (with its `account`).
 * @returns {string} The row, without line ending.
 */
function chargeRow(charge) {
  const account = charge.account ?? {};

  return [
    charge.date,
    safeText(account.name),
    safeText(account.bank_name),
    safeText(account.provider_tax_id),
    safeText(charge.description),
    charge.amount,
    account.currency,
  ].map(quote).join(',');
}

/**
 * Build the accountant hand-off CSV from the loaded preview rows.
 *
 * @description UTF-8 BOM, then the header row, then one row per charge, in the given order:
 * date, account name, provider (`bank_name`), provider tax id, description, amount, currency.
 * Comma-separated, every field quoted with embedded quotes doubled, CRLF line endings (the
 * last row included); text cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading
 * `'`. An empty list gives the BOM and the header only.
 * @param {Array<object>} charges - The preview charges.
 * @returns {string} The CSV text.
 */
export function buildAccountantCsv(charges) {
  const rows = [ACCOUNTANT_CSV_HEADER.map(quote).join(','), ...(charges ?? []).map(chargeRow)];

  return `${CSV_BOM}${rows.map((row) => `${row}${CSV_EOL}`).join('')}`;
}

/**
 * Name the hand-off CSV file (no owner or organization name).
 *
 * @param {string} from - The range start, `YYYY-MM-DD`.
 * @param {string} to - The range end, `YYYY-MM-DD`.
 * @returns {string} `ward-accountant-<from>-<to>.csv`.
 */
export function accountantCsvFilename(from, to) {
  return `ward-accountant-${from}-${to}.csv`;
}
