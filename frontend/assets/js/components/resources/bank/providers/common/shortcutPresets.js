/**
 * Pick the suggested charge amount: the `expected_amount` of the provider's single recurring
 * bill; empty with zero or several recurring bills (the same rule as the contract migration's
 * `down`), or while the page is not loaded.
 *
 * @param {{provider_bills: Array<object>, pagination: {total_count: number}}|null|undefined}
 *   recurringPage - The first page of the provider's `kind=recurring` bills.
 * @returns {string} The suggested amount, or `''`.
 */
function singleRecurringAmount(recurringPage) {
  if (recurringPage?.pagination?.total_count !== 1) {
    return '';
  }

  return recurringPage.provider_bills?.[0]?.expected_amount ?? '';
}

/**
 * Build the **Add charge** preset of the inline ledger form: **Out**, "Charge", with the
 * expected amount of the provider's single recurring bill suggested (#125).
 *
 * @param {object|null|undefined} recurringPage - The first page of the provider's
 *   `kind=recurring` bills (`{provider_bills, pagination}`), or nothing when not loaded.
 * @returns {{direction: string, description: string, amount: string}} The form preset.
 */
export function chargePreset(recurringPage) {
  return { direction: 'out', description: 'Charge', amount: singleRecurringAmount(recurringPage) };
}

/**
 * Build the **Add payment** preset of the inline ledger form: **In**, "Payment", no amount.
 *
 * @returns {{direction: string, description: string, amount: string}} The form preset.
 */
export function paymentPreset() {
  return { direction: 'in', description: 'Payment', amount: '' };
}

/**
 * Build the provider shortcuts (see `AccountShortcuts`): **Add charge** then **Add payment**.
 *
 * @param {object|null|undefined} recurringPage - The first page of the provider's
 *   `kind=recurring` bills, feeding the charge's suggested amount.
 * @returns {Array<Array>} The `[label, variant, preset]` shortcuts.
 */
export function providerShortcuts(recurringPage) {
  return [
    ['Add charge', 'outline-danger', chargePreset(recurringPage)],
    ['Add payment', 'outline-success', paymentPreset()],
  ];
}
