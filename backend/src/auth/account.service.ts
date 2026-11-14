import { BadRequestException, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AccountEditAbuseGuardService } from './account-edit-abuse-guard.service.js';
import { assertAnyFieldPresent } from './assert-any-field-present.js';
import { AuthService } from './auth.service.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { User } from './entities/user.entity.js';
import { isUserLocale, UserLocale } from './user-locale.js';
import { AccountChanges, AccountSummary, UserUpdateService } from './user-update.service.js';
import { ErrorCodes } from '../core/error-codes.js';
import { LockedException } from '../core/locked.exception.js';

/** Message of the `422 INVALID_LOCALE` answer. */
export const INVALID_LOCALE_MESSAGE = 'Unsupported display locale';

/**
 * The self-service "My Account" update flow's business logic (`PATCH
 * /auth/account.json`), split into its own service rather than growing
 * `AuthService` further (already near the project's 300-line-per-file
 * convention — see `docs/agents/plans/.../backend.md`'s Notes).
 */
@Injectable()
export class AccountService {
  private readonly userRepository: Repository<User>;
  private readonly authService: AuthService;
  private readonly userUpdateService: UserUpdateService;
  private readonly accountEditAbuseGuardService: AccountEditAbuseGuardService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {AuthService} authService - Supplies the self-exclusion
   *   username/email availability check for updates.
   * @param {UserUpdateService} userUpdateService - Applies/hashes/persists
   *   the requested changes, shared with `AdminService#editUser`.
   * @param {AccountEditAbuseGuardService} accountEditAbuseGuardService - Tracks and enforces
   *   the per-user brute-force cool-off lockout for this endpoint.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
      authService: AuthService,
      userUpdateService: UserUpdateService,
      accountEditAbuseGuardService: AccountEditAbuseGuardService,
  ) {
    this.userRepository = userRepository;
    this.authService = authService;
    this.userUpdateService = userUpdateService;
    this.accountEditAbuseGuardService = accountEditAbuseGuardService;
  }

  /**
   * Returns the caller's own account summary.
   * @param {number} userId - The id of the authenticated user (from the access-token session).
   * @returns {Promise<AccountSummary>} The caller's username, email and display locale.
   * @throws {UnauthorizedException} When the user no longer exists.
   */
  async getAccount(userId: number): Promise<AccountSummary> {
    const user = await this.#loadUser(userId);

    return { username: user.username, email: user.email, locale: user.locale ?? null };
  }

  /**
   * Updates the caller's own username, email, password and/or display locale.
   * Username/email/password changes are confirmed by their current password;
   * a locale-only change needs none (and skips the lockout guard). Leaves other active sessions
   * (refresh tokens) untouched — deliberately, per the issue's Expected
   * Behavior — unlike the password-recovery reset flow. Any failed
   * validation (wrong current password, duplicate username/email) counts
   * toward a per-user cool-off lockout, checked before any other validation
   * runs and reset on success (see `AccountEditAbuseGuardService`).
   * @param {number} userId - The id of the authenticated user (from the access-token session).
   * @param {UpdateAccountDto} dto - The requested changes plus the current password.
   * @returns {Promise<AccountSummary>} The user's resulting username and email.
   * @throws {BadRequestException} When no field is being changed, or the current
   *   password is missing (credential change) or wrong.
   * @throws {UnprocessableEntityException} `INVALID_LOCALE` for a non-allowlisted locale.
   * @throws {ConflictException} When the new username/email is already taken.
   * @throws {LockedException} `423 Locked` when the caller's per-user cool-off
   *   lockout is currently active.
   */
  async updateAccount(userId: number, dto: UpdateAccountDto): Promise<AccountSummary> {
    assertAnyFieldPresent(dto);
    AccountService.#assertValidLocale(dto.locale);

    if (!AccountService.#isCredentialChange(dto)) {
      return this.#applyLocaleOnly(userId, dto.locale as UserLocale | null);
    }

    return this.#applyCredentialChange(userId, dto);
  }

  static #assertValidLocale(locale: unknown): void {
    if (locale !== undefined && locale !== null && !isUserLocale(locale)) {
      throw new UnprocessableEntityException({ code: ErrorCodes.INVALID_LOCALE, message: INVALID_LOCALE_MESSAGE });
    }
  }

  static #isCredentialChange(dto: UpdateAccountDto): boolean {
    return dto.username !== undefined || dto.email !== undefined || dto.newPassword !== undefined;
  }

  async #applyLocaleOnly(userId: number, locale: UserLocale | null): Promise<AccountSummary> {
    const user = await this.#loadUser(userId);

    return this.userUpdateService.applyUserUpdate(user, { locale });
  }

  async #applyCredentialChange(userId: number, dto: UpdateAccountDto): Promise<AccountSummary> {
    if (!dto.currentPassword) {
      throw new BadRequestException({
        message: ['currentPassword should not be empty', 'currentPassword must be a string'],
      });
    }

    await this.#assertNotLockedOut(userId);

    const user = await this.#loadUser(userId);
    await this.#applyGuardedChecks(user, dto.currentPassword, dto);

    const result = await this.userUpdateService.applyUserUpdate(user, dto as AccountChanges);
    await this.accountEditAbuseGuardService.reset(userId);

    return result;
  }

  async #assertNotLockedOut(userId: number): Promise<void> {
    if (await this.accountEditAbuseGuardService.isLockedOut(userId)) {
      throw new LockedException('Account temporarily locked due to too many failed attempts');
    }
  }

  async #applyGuardedChecks(user: User, currentPassword: string, dto: UpdateAccountDto): Promise<void> {
    try {
      await this.#verifyCurrentPassword(user, currentPassword);
      await this.#assertNewValuesAvailable(user, dto);
    } catch (error) {
      await this.accountEditAbuseGuardService.registerFailure(user.id);
      throw error;
    }
  }

  async #assertNewValuesAvailable(user: User, dto: UpdateAccountDto): Promise<void> {
    const username = dto.username && dto.username !== user.username ? dto.username : undefined;
    const email = dto.email && dto.email !== user.email ? dto.email : undefined;

    await this.authService.assertAvailableForUpdate(user.id, username, email);
  }

  async #loadUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    return user;
  }

  async #verifyCurrentPassword(user: User, currentPassword: string): Promise<void> {
    const valid = await bcrypt.compare(currentPassword, user.passwordDigest);

    if (!valid) {
      throw new BadRequestException('Invalid current password');
    }
  }
}
