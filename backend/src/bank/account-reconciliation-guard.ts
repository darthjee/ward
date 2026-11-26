import type { EntityManager } from 'typeorm';
import type { AccountBalancesQuery } from './account-balances.query.js';
import { currencyLocked } from './account-conflicts.js';
import { convertAmountInput, parseAmountInput } from './amount-input.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';
import type { Account } from './entities/account.entity.js';
import { accountReconciled } from './reconciliation-conflicts.js';
import type { ReconciliationQuery } from './reconciliation.query.js';

// The statement-aware checks of `AccountService.update()` (see
// `docs/agents/specs/reconciliation/api/existing-routes.md`, *Accounts*). They run inside the
// account's write transaction, under the account row lock, so a concurrent statement start (which
// takes the same lock first) is either fully before or fully after them.

/**
 * @param {UpdateAccountDto} dto - The validated body.
 * @returns {boolean} Whether the body touches the opening anchor or the currency, the only fields
 *   a statement locks (so a `name` edit never pays the lookup).
 */
export function touchesStatementLockedFields(dto: UpdateAccountDto): boolean {
  return dto.currency !== undefined || dto.opening_date !== undefined || dto.opening_balance !== undefined;
}

/**
 * "A statement exists" means any `bank_reconciliations` row of the account, open or finished.
 * @param {ReconciliationQuery} query - The reconciliation SQL.
 * @param {EntityManager} manager - The write transaction's manager.
 * @param {Account} account - The (locked) account.
 * @param {UpdateAccountDto} dto - The validated body.
 * @returns {Promise<boolean>} Whether a statement exists; always `false` without a lookup when the
 *   body touches neither the anchor nor the currency.
 */
export async function hasLockingStatement(
  query: ReconciliationQuery,
  manager: EntityManager,
  account: Account,
  dto: UpdateAccountDto,
): Promise<boolean> {
  return touchesStatementLockedFields(dto) && query.hasAny(account.id, manager);
}

/**
 * Applies a requested currency change to the account in place: `CURRENCY_LOCKED` once the account
 * has transactions or a statement (a zero-row statement is stored in minor units of the old
 * currency, so a change would reinterpret its balance). Without a new `opening_balance` the stored
 * one is converted to the new currency.
 * @param {Account} account - The (locked) account, edited in place.
 * @param {UpdateAccountDto} dto - The validated body.
 * @param {boolean} hasStatement - Whether the account has a statement.
 * @param {AccountBalancesQuery} balances - Balance reads (for `hasTransactions`).
 * @returns {Promise<void>}
 * @throws {ConflictException} 409 `CURRENCY_LOCKED` when the account has transactions or a statement.
 */
export async function applyCurrencyChange(
  account: Account,
  dto: UpdateAccountDto,
  hasStatement: boolean,
  balances: AccountBalancesQuery,
): Promise<void> {
  if (dto.currency === undefined || dto.currency === account.currency) {
    return;
  }

  if (hasStatement || await balances.hasTransactions(account.id)) {
    throw currencyLocked();
  }

  if (dto.opening_balance === undefined) {
    account.openingBalance = convertAmountInput('opening_balance', account.openingBalance, account.currency, dto.currency);
  }

  account.currency = dto.currency;
}

/**
 * @param {Account} account - The account, with its stored anchor.
 * @param {UpdateAccountDto} dto - The validated body.
 * @param {boolean} hasStatement - Whether the account has a statement.
 * @returns {void}
 * @throws {BadRequestException} 400 for an invalid `opening_balance` when a statement exists.
 * @throws {ConflictException} 409 `ACCOUNT_RECONCILED` when a statement exists and `opening_date`
 *   or `opening_balance` differs from the stored value (the balance compared as minor units, so
 *   `"1000"` equals `"1000.00"`). Unchanged values pass.
 */
export function assertAnchorUnlocked(account: Account, dto: UpdateAccountDto, hasStatement: boolean): void {
  if (!hasStatement) {
    return;
  }

  const dateChanged = dto.opening_date !== undefined && dto.opening_date !== account.openingDate;
  const balanceChanged = dto.opening_balance !== undefined &&
    parseAmountInput('opening_balance', dto.opening_balance, account.currency) !== account.openingBalance;

  if (dateChanged || balanceChanged) {
    throw accountReconciled();
  }
}
