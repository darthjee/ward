import { Allow, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserFieldChangesDto } from './user-field-changes.dto.js';

/**
 * Request body for `PATCH /auth/account.json`. At least one of `username`,
 * `email`, `newPassword`, or `locale` must be present — that rule is business
 * logic enforced by `AccountService`, not a per-field decorator here. No
 * `newPasswordConfirmation` field — matching `RegisterDto`/`ResetPasswordDto`,
 * password confirmation equality is a client-only UX check.
 *
 * `currentPassword` is optional at the DTO level: it is required (by
 * `AccountService`) only when `username`, `email`, or `newPassword` changes.
 * `locale` is `null` (browser default) or an allowlisted tag; it is left
 * untyped here (`@Allow()` only keeps it through the whitelist pipe) so any
 * non-allowlisted value reaches the service and answers `422 INVALID_LOCALE`
 * rather than a `400`.
 */
export class UpdateAccountDto extends UserFieldChangesDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
    currentPassword?: string;

  @IsOptional()
  @Allow()
    locale?: unknown;
}
