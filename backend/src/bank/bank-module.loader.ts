import { Injectable } from '@nestjs/common';
import type { AccountService } from './account.service.js';
import type { TransactionService } from './transaction.service.js';
import { LazyModuleLoaderService } from '../core/lazy-module-loader.service.js';

/**
 * The lazy `BankModule`'s services, as resolved by {@link BankModuleLoader}.
 */
export interface BankServices {
  accounts: AccountService;
  transactions: TransactionService;
}

/**
 * Resident helper loading the lazy `BankModule` on the first bank request
 * (Nest's `LazyModuleLoader` caches it afterwards) and resolving its
 * services. The service classes are reached only through the dynamic
 * `import()` (controllers import their types only), so not even their code is
 * loaded before the first bank request.
 */
@Injectable()
export class BankModuleLoader {
  private readonly lazyModuleLoader: LazyModuleLoaderService;

  /**
   * @param {LazyModuleLoaderService} lazyModuleLoader - Core's lazy-module wrapper.
   */
  constructor(lazyModuleLoader: LazyModuleLoaderService) {
    this.lazyModuleLoader = lazyModuleLoader;
  }

  /**
   * @returns {Promise<BankServices>} The lazy module's services, loading the
   *   module first when needed.
   */
  async services(): Promise<BankServices> {
    const bank = await import('./bank.module.js');
    const moduleRef = await this.lazyModuleLoader.loadOnFirstRequest(() => bank.BankModule);

    return {
      accounts: moduleRef.get(bank.AccountService),
      transactions: moduleRef.get(bank.TransactionService),
    };
  }
}
