/** Section base of the Accounts submenu (regular accounts). */
export const ACCOUNTS_BASE = '/bank/accounts';

/** Section base of the Debts submenu (debt accounts). */
export const DEBTS_BASE = '/bank/debts';

/** Section base of the Investments submenu (investment accounts). */
export const INVESTMENTS_BASE = '/bank/investments';

/** Section base of each account type that has a frontend submenu. */
export const SECTION_BY_TYPE = new Map([
  ['regular', ACCOUNTS_BASE],
  ['debt', DEBTS_BASE],
  ['investment', INVESTMENTS_BASE],
]);

/** Account type shown by each section base. */
export const TYPE_BY_SECTION = new Map([...SECTION_BY_TYPE].map(([type, base]) => [base, type]));
