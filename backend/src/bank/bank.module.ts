import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountBalancesQuery } from './account-balances.query.js';
import { AccountScheduleValidator } from './account-schedule.validator.js';
import { ACCOUNT_TYPE_HANDLERS, type AccountTypeHandler } from './account-types/account-type-handler.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { DebtAccountHandler } from './account-types/debt-account.handler.js';
import { InvestmentAccountHandler } from './account-types/investment-account.handler.js';
import { ProviderExpenseAccountHandler } from './account-types/provider-expense-account.handler.js';
import { RegularAccountHandler } from './account-types/regular-account.handler.js';
import { AccountService } from './account.service.js';
import { AccountantChargesQuery } from './accountant-charges.query.js';
import { AccountantService } from './accountant.service.js';
import { BankConfigModule } from './bank-config.module.js';
import { Account } from './entities/account.entity.js';
import { BillPayment } from './entities/bill-payment.entity.js';
import { Bill } from './entities/bill.entity.js';
import { DebtDetails } from './entities/debt-details.entity.js';
import { InvestmentDetails } from './entities/investment-details.entity.js';
import { ProviderExpenseDetails } from './entities/provider-expense-details.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { LedgerQuery } from './ledger.query.js';
import { PayingAccountResolver } from './paying-account.resolver.js';
import { TransactionService } from './transaction.service.js';

// Re-exported so the resident `BankModuleLoader` reaches the service classes
// only through its dynamic `import()` of this file.
export { AccountService } from './account.service.js';
export { AccountantService } from './accountant.service.js';
export { TransactionService } from './transaction.service.js';

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
  imports: [TypeOrmModule.forFeature([
    Account,
    Bill,
    BillPayment,
    DebtDetails,
    InvestmentDetails,
    ProviderExpenseDetails,
    Transaction,
  ]), BankConfigModule],
  providers: [
    RegularAccountHandler,
    DebtAccountHandler,
    InvestmentAccountHandler,
    ProviderExpenseAccountHandler,
    {
      provide: ACCOUNT_TYPE_HANDLERS,
      inject: [RegularAccountHandler, DebtAccountHandler, InvestmentAccountHandler, ProviderExpenseAccountHandler],
      useFactory: (...handlers: AccountTypeHandler[]): AccountTypeHandler[] => handlers,
    },
    AccountTypeRegistry,
    AccountBalancesQuery,
    PayingAccountResolver,
    AccountScheduleValidator,
    AccountService,
    AccountantChargesQuery,
    AccountantService,
    LedgerQuery,
    TransactionService,
  ],
  exports: [AccountService, AccountantService, TransactionService],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BankModule {}
