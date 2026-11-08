/**
 * Build the **Add application** preset of the inline ledger form: **In**, "Application", the
 * amount typed positive.
 *
 * @returns {{direction: string, description: string, amount: string}} The form preset.
 */
export function applicationPreset() {
  return { direction: 'in', description: 'Application', amount: '' };
}

/**
 * Build the **Add withdrawal** preset of the inline ledger form: **Out**, "Withdrawal", the
 * amount typed positive (stored negative by the toggle).
 *
 * @returns {{direction: string, description: string, amount: string}} The form preset.
 */
export function withdrawalPreset() {
  return { direction: 'out', description: 'Withdrawal', amount: '' };
}
