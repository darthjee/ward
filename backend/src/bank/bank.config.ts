import { ConfigService } from '@nestjs/config';
import { isSupportedCurrency } from './currency.js';

// Currency applied when `BANK_DEFAULT_CURRENCY` is unset or blank.
const DEFAULT_CURRENCY = 'BRL';

/**
 * Injection token for the frozen {@link BankConfig} resolved at boot.
 */
export const BANK_CONFIG = 'BANK_CONFIG';

/**
 * Frozen, plain-data bank configuration resolved once at boot from the
 * `BANK_*` env vars.
 */
export interface BankConfig {
  defaultCurrency: string;
}

/**
 * Builds the frozen {@link BankConfig} from `BANK_DEFAULT_CURRENCY`. Called
 * once by `BankConfigModule`'s `useFactory`, so no bank class reads env vars
 * directly, and a bad value fails startup rather than the first bank request.
 * @param {ConfigService} configService - Supplies `BANK_DEFAULT_CURRENCY`.
 * @returns {BankConfig} The frozen config; `defaultCurrency` falls back to
 *   `BRL` when the env var is unset or blank.
 * @throws {Error} When `BANK_DEFAULT_CURRENCY` is not an ISO 4217 code
 *   supported by `Intl.supportedValuesOf('currency')`.
 */
export function buildBankConfig(configService: ConfigService): BankConfig {
  const raw = (configService.get<string>('BANK_DEFAULT_CURRENCY') ?? '').trim();
  const defaultCurrency = raw === '' ? DEFAULT_CURRENCY : raw;

  if (!isSupportedCurrency(defaultCurrency)) {
    throw new Error(
      `bank: BANK_DEFAULT_CURRENCY "${defaultCurrency}" is not a supported ISO 4217 currency code`,
    );
  }

  return Object.freeze({ defaultCurrency });
}
