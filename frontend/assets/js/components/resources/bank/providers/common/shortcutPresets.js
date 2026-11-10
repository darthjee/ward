/**
 * Build the **Add charge** preset of the inline ledger form: **Out**, "Charge", with the
 * provider's expected amount suggested when set (decided in #55).
 *
 * @param {object|null} details - The account's `provider_expense` object.
 * @returns {{direction: string, description: string, amount: string}} The form preset.
 */
export function chargePreset(details) {
  return { direction: 'out', description: 'Charge', amount: details?.expected_amount ?? '' };
}

/**
 * Build the **Add payment** preset of the inline ledger form: **In**, "Payment", no amount.
 *
 * @returns {{direction: string, description: string, amount: string}} The form preset.
 */
export function paymentPreset() {
  return { direction: 'in', description: 'Payment', amount: '' };
}
