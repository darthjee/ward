import { negateAmount, parseAmount } from '../../amounts.js';

/**
 * Whether the account is a debt (its statement balance is the amount owed).
 *
 * @param {object} account - The account.
 * @returns {boolean} True for a debt.
 */
function isDebt(account) {
  return account?.type === 'debt';
}

/**
 * The label of the statement balance input.
 *
 * @param {object} account - The account.
 * @returns {string} 'Amount owed' for a debt, 'Statement balance' otherwise.
 */
export function statementBalanceLabel(account) {
  return isDebt(account) ? 'Amount owed' : 'Statement balance';
}

/**
 * Build the form fields of the start / edit statement form.
 *
 * @description Start: today and an empty balance. Edit: the statement's values. On a debt the
 * balance is shown negated (the amount owed).
 * @param {{statement: (object|null), account: object, today: string}} source - The open
 *   statement (edit) or `null` (start), the account and local today.
 * @returns {{statement_date: string, statement_balance: string}} The form fields.
 */
export function statementFieldsFor({ statement, account, today }) {
  const balance = statement ? String(statement.statement_balance ?? '') : '';

  return {
    statement_date: statement ? statement.statement_date : today,
    statement_balance: isDebt(account) ? negateAmount(balance) : balance,
  };
}

/**
 * Validate the statement form and build the request body.
 *
 * @description The date is required (the `max` is only a UX default, never validated). The
 * balance may be negative or zero and goes through `parseAmount`; on a debt it is negated back
 * before it is sent.
 * @param {{statement_date: string, statement_balance: string}} fields - The form fields.
 * @param {object} account - The account (`currency`, `type`).
 * @returns {{fieldErrors: object}|{body: {statement_date: string, statement_balance: string}}}
 *   The field errors, or the exact body.
 */
export function validateStatementFields(fields, account) {
  const fieldErrors = {};
  const date = String(fields.statement_date ?? '').trim();
  const parsed = parseAmount(fields.statement_balance, {
    currency: account.currency, allowNegative: true, allowZero: true,
  });

  if (!date) {
    fieldErrors.statement_date = 'Enter the statement date.';
  }

  if (parsed.error) {
    fieldErrors.statement_balance = parsed.error;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return {
    body: {
      statement_date: date,
      statement_balance: isDebt(account) ? negateAmount(parsed.value) : parsed.value,
    },
  };
}
