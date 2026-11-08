import type { FindOptionsWhere } from 'typeorm';
import { ownerWhere, type OwnerContext } from '../core/owner-context.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';
import type { Account } from './entities/account.entity.js';

// Plain-copy editable fields: body key -> entity property.
const COPIED_FIELDS = [
  ['name', 'name'],
  ['bank_name', 'bankName'],
  ['branch', 'branch'],
  ['account_number', 'accountNumber'],
  ['opening_date', 'openingDate'],
  ['notes', 'notes'],
] as const;

/**
 * @param {OwnerContext} owner - The resolved owner.
 * @returns {Pick<Account, 'userId' | 'organizationId'>} The owner columns of a
 *   new account: exactly one is set, always from the route, never the body.
 */
export function ownerColumns(owner: OwnerContext): Pick<Account, 'userId' | 'organizationId'> {
  return owner.kind === 'user'
    ? { userId: owner.userId, organizationId: null }
    : { userId: null, organizationId: owner.organizationId };
}

/**
 * @param {OwnerContext} owner - The resolved owner.
 * @returns {FindOptionsWhere<Account>} `ownerWhere(owner)`, typed for the
 *   `Account` repository: both owner columns are always constrained.
 */
export function accountOwnerWhere(owner: OwnerContext): FindOptionsWhere<Account> {
  return ownerWhere(owner) as FindOptionsWhere<Account>;
}

/**
 * @param {object} dto - A request body.
 * @param {string} type - The account type (also the nested object's key).
 * @returns {unknown} The type's nested body object, if any.
 */
export function nestedObject(dto: object, type: string): unknown {
  return (dto as Record<string, unknown>)[type];
}

/**
 * @param {object} dto - A request body.
 * @returns {string[]} The keys actually sent (not `undefined`).
 */
export function presentFields(dto: object): string[] {
  return Object.entries(dto)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
}

/**
 * Copies the plain editable fields that were sent (`null` clears an optional
 * field). `currency` and `opening_balance` need conversions and are applied by
 * the service.
 * @param {Account} account - The account to edit in place.
 * @param {UpdateAccountDto} dto - The validated body.
 * @returns {void}
 */
export function copyEditableFields(account: Account, dto: UpdateAccountDto): void {
  for (const [field, property] of COPIED_FIELDS) {
    if (dto[field] !== undefined) {
      Object.assign(account, { [property]: dto[field] });
    }
  }
}
