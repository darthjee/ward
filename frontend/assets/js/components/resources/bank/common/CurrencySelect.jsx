import { useMemo, useState } from 'react';
import CurrencySelectHelper from './helpers/CurrencySelectHelper.jsx';
import { currencyOptions } from './currencies.js';

/**
 * Searchable ISO 4217 currency select: a text filter (by code and name) above a native list.
 *
 * @description Only codes from the list can be chosen — the filter text is never submitted.
 * The default currency is listed first, then every other code A–Z. When `locked`, both
 * controls are disabled and a short hint explains why.
 * @param {object} props - Component props.
 * @param {string} props.value - The selected code (`''` for none).
 * @param {string|null} [props.defaultCode] - The default currency, listed first.
 * @param {Function} props.onChange - Called with the picked code.
 * @param {boolean} [props.locked] - Whether the currency can no longer change.
 * @param {string} [props.lockedHint] - The hint shown while locked.
 * @param {string|null} [props.error] - A field error.
 * @param {string} [props.idPrefix] - Prefix for the element ids.
 * @returns {React.ReactElement} The rendered select.
 */
export default function CurrencySelect({
  value, defaultCode = null, onChange, locked = false, lockedHint, error = null, idPrefix = '',
}) {
  const [filter, setFilter] = useState('');
  const options = useMemo(() => currencyOptions(defaultCode), [defaultCode]);

  return CurrencySelectHelper.render(
    {
      options, filter, value, locked, lockedHint, error, idPrefix,
    },
    {
      onFilterChange: (event) => setFilter(event.target.value),
      onSelect: (event) => onChange(event.target.value),
    },
  );
}
