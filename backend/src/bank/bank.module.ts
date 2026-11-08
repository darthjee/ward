import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountBalancesQuery } from './account-balances.query.js';
import { ACCOUNT_TYPE_HANDLERS, type AccountTypeHandler } from './account-types/account-type-handler.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { RegularAccountHandler } from './account-types/regular-account.handler.js';
import { AccountService } from './account.service.js';
import { BankConfigModule } from './bank-config.module.js';
import { Account } from './entities/account.entity.js';
import { Transaction } from './entities/transaction.entity.js';

/**
 * The lazy `bank` domain module: every service, query and piece of business
 * logic of the bank. **Never imported by `AppModule`** — the resident
 * `BankRoutesModule` controllers load it on the first bank request through
 * `LazyModuleLoaderService#loadOnFirstRequest()`. The entities themselves are
 * registered resident (see `BankRoutesModule`) so their metadata exists
 * before the `DataSource` initialises; this `forFeature` only provides the
 * repositories inside the lazy graph.
 *
 * A later account type registers its handler by adding it to `providers`
 * and to the `ACCOUNT_TYPE_HANDLERS` factory's `inject` list.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account, Transaction]), BankConfigModule],
  providers: [
    RegularAccountHandler,
    {
      provide: ACCOUNT_TYPE_HANDLERS,
      inject: [RegularAccountHandler],
      useFactory: (...handlers: AccountTypeHandler[]): AccountTypeHandler[] => handlers,
    },
    AccountTypeRegistry,
    AccountBalancesQuery,
    AccountService,
  ],
  exports: [AccountService],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BankModule {}
