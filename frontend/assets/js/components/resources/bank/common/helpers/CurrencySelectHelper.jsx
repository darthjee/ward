import { filterCurrencies } from '../currencies.js';

/** Hint shown under a locked currency select. */
export const LOCKED_HINT = "Currency can't change once the account has transactions.";

/**
 * Build the visible options: the filtered list, keeping the selected option visible even when
 * the filter hides it.
 *
 * @param {Array<object>} options - Every option.
 * @param {string} filter - The filter text.
 * @param {string} value - The selected code.
 * @returns {Array<object>} The visible options.
 */
function visibleOptions(options, filter, value) {
  const filtered = filterCurrencies(options, filter);

  if (!value || filtered.some(({ code }) => code === value)) {
    return filtered;
  }

  const selected = options.find(({ code }) => code === value);

  return selected ? [selected, ...filtered] : filtered;
}

/**
 * Render the hint or the error under the select.
 *
 * @param {{locked: boolean, lockedHint: string, error: (string|null)}} state - Select state.
 * @returns {React.ReactNode} The feedback, if any.
 */
function renderFeedback({ locked, lockedHint, error }) {
  return (
    <>
      {error && <div className="invalid-feedback d-block">{error}</div>}
      {locked && <div className="form-text">{lockedHint ?? LOCKED_HINT}</div>}
    </>
  );
}

/**
 * Rendering helper for {@link CurrencySelect}.
 */
const CurrencySelectHelper = {
  /**
   * Render the filter input above a native, keyboard-accessible `<select size>`.
   *
   * @param {{options: Array<object>, filter: string, value: string, locked: boolean,
   *   lockedHint: string, error: (string|null), idPrefix: string}} state - Select state.
   * @param {{onFilterChange: Function, onSelect: Function}} handlers - Change handlers.
   * @returns {React.ReactElement} The rendered field.
   */
  render(state, handlers) {
    const selectId = `${state.idPrefix}currency`;
    const invalid = state.error ? ' is-invalid' : '';

    return (
      <div className="mb-3">
        <label className="form-label" htmlFor={selectId}>Currency</label>
        <input
          id={`${selectId}-filter`}
          type="search"
          className="form-control form-control-sm mb-1"
          placeholder="Search currency"
          aria-label="Search currency"
          value={state.filter}
          onChange={handlers.onFilterChange}
          disabled={state.locked}
        />
        <select
          id={selectId}
          size={8}
          className={`form-select${invalid}`}
          value={state.value ?? ''}
          onChange={handlers.onSelect}
          disabled={state.locked}
        >
          {visibleOptions(state.options, state.filter, state.value).map(({ code, label }) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
        {renderFeedback(state)}
      </div>
    );
  },
};

export default CurrencySelectHelper;
