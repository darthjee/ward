# Accountant CSV builder and download helper

`providers/common/accountantCsv.js` is a pure module with JSDoc:

- `ACCOUNTANT_CSV_HEADER = ['Date','Account','Provider','Provider tax id','Description',
  'Amount','Currency']`.
- `buildAccountantCsv(charges)` returns a string. It starts with `'\uFEFF'` (BOM) and the
  header row, then one row per preview charge:
  `date, account.name, account.bank_name, account.provider_tax_id, description, amount,
  account.currency`.
  - Every field is quoted and embedded `"` is doubled.
  - `null` or empty becomes `""`.
  - Text cells (account name, `bank_name`, `provider_tax_id`, description) starting with
    `=`, `+`, `-`, `@`, tab or CR get a leading `'`.
  - `amount` is written as the API string, unprefixed, so a negative stays `-129.90`.
  - Comma separator and CRLF (or LF; pick one and assert it in the spec) line endings.
  - An empty list gives just the BOM and the header.
- `accountantCsvFilename(from, to)` → `ward-accountant-<from>-<to>.csv`.

`common/download.js` (or `providers/common/downloadFile.js`) holds `downloadText(filename,
text, { mimeType, win })`. It creates a `Blob` and an object URL, clicks a temporary anchor
and revokes the URL. Because the window is injectable, specs can fake it.

The spec `accountantCsvSpec.js` covers: the header; the BOM; quoting and quote-doubling; commas
and newlines inside a description; each formula prefix on each text column; negative amounts
untouched; empty `bank_name` / `provider_tax_id`; mixed currencies; the empty list; and the
filename. A small spec covers the download helper with a fake window.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/common/accountantCsv.js` (new)
- `frontend/assets/js/components/resources/bank/common/download.js` (new)
- `frontend/specs/assets/js/components/resources/bank/providers/common/accountantCsvSpec.js`, `frontend/specs/assets/js/components/resources/bank/common/downloadSpec.js` (new)
