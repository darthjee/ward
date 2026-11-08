import { Get, Inject } from '@nestjs/common';
import { BANK_CONFIG, type BankConfig } from './bank.config.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';

/** Body of `GET <base>/settings.json`. */
export interface BankSettingsResponse {
  default_currency: string;
}

/**
 * `GET bank/settings.json` and `GET orgs/:orgId/bank/settings.json`: the
 * bank settings the create form needs. Owner-scoped like every bank route (a
 * non-member `:orgId` answers 404) and `user-scoped`, although the value is
 * the same for everyone: it comes from the resident, boot-validated
 * `BANK_CONFIG`, so this route does not need the lazy `BankModule`.
 */
@OwnerScopedController('bank')
export class SettingsController {
  private readonly config: BankConfig;

  /**
   * @param {BankConfig} config - The boot-validated bank config.
   */
  constructor(@Inject(BANK_CONFIG) config: BankConfig) {
    this.config = config;
  }

  /**
   * `GET <base>/settings.json`.
   * @returns {BankSettingsResponse} `{ default_currency }` from `BANK_DEFAULT_CURRENCY`.
   */
  @Get('settings.json')
  show(): BankSettingsResponse {
    return { default_currency: this.config.defaultCurrency };
  }
}
