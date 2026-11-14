import { BadRequestException } from '@nestjs/common';
import { UserFieldChangesDto } from './dto/user-field-changes.dto.js';

/**
 * Rejects a user-update request when none of the updatable fields are
 * present, shared by `AccountService#updateAccount` and
 * `AdminService#editUser` so both self-service and admin edits enforce the
 * same "at least one field" rule. A `locale` key (including an explicit
 * `null`) counts as present; the admin DTO never carries one.
 * @param {UserFieldChangesDto & { locale?: unknown }} dto - The requested changes.
 * @returns {void} Nothing when at least one field is present.
 * @throws {BadRequestException} When `username`, `email`, `newPassword`
 *   and `locale` are all absent.
 */
export function assertAnyFieldPresent(dto: UserFieldChangesDto & { locale?: unknown }): void {
  if (!dto.username && !dto.email && !dto.newPassword && dto.locale === undefined) {
    throw new BadRequestException('At least one of username, email, or newPassword is required');
  }
}
