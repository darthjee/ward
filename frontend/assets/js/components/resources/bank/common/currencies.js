/**
 * Build the label of a currency.
 *
 * @param {string} code - ISO 4217 code.
 * @param {object|null} names - An `Intl.DisplayNames`-like `{ of(code) }`, or `null`.
 * @returns {{code: string, name: string, label: string}} The option; the name falls back to the
 *   code when none is available.
 */
function buildOption(code, names) {
  let name = null;

  try {
    name = names?.of(code) ?? null;
  } catch {
    name = null;
  }

  if (!name || name === code) {
    return { code, name: code, label: code };
  }

  return { code, name, label: `${code} — ${name}` };
}

/**
 * Build the currency display names, tolerating an `Intl` without `DisplayNames`.
 *
 * @param {object} intl - The `Intl` source.
 * @returns {object|null} The display names, or `null` when unavailable.
 */
function displayNames(intl) {
  return intl.DisplayNames ? new intl.DisplayNames(undefined, { type: 'currency' }) : null;
}

/**
 * Build the ordered currency options for the currency select.
 *
 * @description Codes come from `Intl.supportedValuesOf('currency')`; labels read
 * `BRL — Brazilian Real`, falling back to the bare code. The default currency comes first,
 * then every other code A–Z.
 * @param {string|null} defaultCode - The default currency (from `settings.json`), if any.
 * @param {object} [intl] - The `Intl` source (injectable for specs).
 * @returns {Array<{code: string, name: string, label: string}>} The options.
 */
export function currencyOptions(defaultCode, intl = Intl) {
  const names = displayNames(intl);
  const codes = [...intl.supportedValuesOf('currency')].sort();
  const ordered = codes.includes(defaultCode)
    ? [defaultCode, ...codes.filter((code) => code !== defaultCode)]
    : codes;

  return ordered.map((code) => buildOption(code, names));
}

/**
 * Filter currency options by code and name, case-insensitively.
 *
 * @param {Array<{code: string, name: string}>} options - The options.
 * @param {string} text - The filter text.
 * @returns {Array<object>} The matching options, in their original order.
 */
export function filterCurrencies(options, text) {
  const needle = String(text ?? '').trim().toLowerCase();

  if (!needle) {
    return options;
  }

  return options.filter(({ code, name }) => (
    code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle)
  ));
}
