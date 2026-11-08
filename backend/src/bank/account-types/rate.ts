// Shared helper for the `DECIMAL(7,4)` rates of the account types (a debt's
// interest rate, an investment's yield rate).

/**
 * Normalises a `DECIMAL(7,4)` rate by stripping trailing fractional zeros
 * (`"1.9900"` → `"1.99"`, `"0.0000"` → `"0"`, `"100.0000"` → `"100"`).
 * @param {string} rate - The stored rate.
 * @returns {string} The normalised decimal string.
 */
export function normaliseRate(rate: string): string {
  return rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate;
}
