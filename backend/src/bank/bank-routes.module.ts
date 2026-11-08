import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller.js';
import { BankConfigModule } from './bank-config.module.js';
import { BankModuleLoader } from './bank-module.loader.js';
import { Account } from './entities/account.entity.js';
import { DebtDetails } from './entities/debt-details.entity.js';
import { InvestmentDetails } from './entities/investment-details.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { SettingsController } from './settings.controller.js';
import { TransactionsController } from './transactions.controller.js';
import { LazyModuleLoaderService } from '../core/lazy-module-loader.service.js';

/**
 * The resident part of the lazy `bank` module, imported by `AppModule`:
 * - the thin controllers (Nest registers routes only at boot, so a lazily
 *   loaded module cannot declare them);
 * - the entity registration (`forFeature`), so the metadata exists before the
 *   `DataSource` initialises (`autoLoadEntities` only sees entities whose
 *   `forFeature` ran at boot);
 * - the boot-validated `BANK_CONFIG`.
 *
 * Every service, query and piece of business logic stays in the lazy
 * `BankModule`, loaded on the first bank request through
 * {@link BankModuleLoader}. `LazyModuleLoaderService` is listed here because
 * `AppModule` does not export it (it is stateless; Nest's `LazyModuleLoader`
 * caches the loaded module).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account, DebtDetails, InvestmentDetails, Transaction]), BankConfigModule],
  controllers: [AccountsController, TransactionsController, SettingsController],
  providers: [LazyModuleLoaderService, BankModuleLoader],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BankRoutesModule {}
