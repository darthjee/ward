/**
 * Build the **Add payment** preset of the inline ledger form: **In**, "Payment", with the
 * debt's instalment amount suggested when set.
 *
 * @param {object|null} debt - The account's `debt` object.
 * @returns {{direction: string, description: string, amount: string}} The form preset.
 */
export function paymentPreset(debt) {
  return { direction: 'in', description: 'Payment', amount: debt?.instalment_amount ?? '' };
}

/**
 * Build the **Add interest** preset of the inline ledger form: **Out**, "Interest", no amount.
 *
 * @returns {{direction: string, description: string, amount: string}} The form preset.
 */
export function interestPreset() {
  return { direction: 'out', description: 'Interest', amount: '' };
}
