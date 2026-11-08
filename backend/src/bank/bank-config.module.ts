import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BANK_CONFIG, buildBankConfig, type BankConfig } from './bank.config.js';

/**
 * Resident bank configuration module. Resolves `BANK_DEFAULT_CURRENCY` into
 * the frozen {@link BankConfig} at boot (so an unsupported value fails
 * startup) and exports it under {@link BANK_CONFIG} for both the resident
 * bank routes and the lazy `BankModule`.
 */
@Module({
  providers: [
    {
      provide: BANK_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): BankConfig => buildBankConfig(configService),
    },
  ],
  exports: [BANK_CONFIG],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BankConfigModule {}
