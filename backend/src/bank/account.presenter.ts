import type { Repository } from 'typeorm';
import type { AccountBalancesQuery } from './account-balances.query.js';
import { serializeAccount, type AccountResponse, type ReconciliationFields } from './account-response.js';
import type { AccountTypeRegistry } from './account-types/account-type.registry.js';
import type { Account } from './entities/account.entity.js';
import type { ReconciliationQuery } from './reconciliation.query.js';

/** Options of {@link AccountPresenter.present}. */
export interface PresentAccountsOptions {
  /** Mask `account_number` (lists and write responses); the detail returns it in full. */
  mask: boolean;
  /** Add the handlers' list-only top-level fields (`AccountService.list` only). */
  listExtras?: boolean;
  /** Add the reconciliation fields (`AccountService.find` only; one lookup, never on the list). */
  detail?: boolean;
}

/** Options of {@link AccountPresenter.presentOne}. */
export type PresentOneOptions = Pick<PresentAccountsOptions, 'mask' | 'detail'>;

/**
 * Turns account entities into their public view for `AccountService`: one
 * grouped balance query, one details load per type and, for the list only, one
 * `listExtras` call per type (no N+1). Built by the service from its own
 * collaborators, so it is not a module provider.
 */
export class AccountPresenter {
  private readonly accountRepository: Repository<Account>;
  private readonly registry: AccountTypeRegistry;
  private readonly balances: AccountBalancesQuery;
  private readonly reconciliation: ReconciliationQuery;

  /**
   * @param {Repository<Account>} accountRepository - The account repository (for its entity manager).
   * @param {AccountTypeRegistry} registry - The account type handlers.
   * @param {AccountBalancesQuery} balances - Balance reads.
   * @param {ReconciliationQuery} reconciliation - The statement lookups of the detail.
   */
  constructor(
    accountRepository: Repository<Account>,
    registry: AccountTypeRegistry,
    balances: AccountBalancesQuery,
    reconciliation: ReconciliationQuery,
  ) {
    this.accountRepository = accountRepository;
    this.registry = registry;
    this.balances = balances;
    this.reconciliation = reconciliation;
  }

  /**
   * @param {Account} account - The account.
   * @param {PresentOneOptions} options - Whether to mask `account_number`, and whether to add the
   *   reconciliation fields (the detail only).
   * @returns {Promise<AccountResponse>} Its public view (never with list extras).
   */
  async presentOne(account: Account, options: PresentOneOptions): Promise<AccountResponse> {
    const [response] = await this.present([account], options);

    return response;
  }

  /**
   * @param {Account[]} accounts - The accounts.
   * @param {PresentAccountsOptions} options - Masking and whether to add the list extras.
   * @returns {Promise<AccountResponse[]>} Their public views, in order.
   */
  async present(accounts: Account[], options: PresentAccountsOptions): Promise<AccountResponse[]> {
    const balances = await this.balances.currentBalances(accounts);
    const details = await this.registry.loadDetails(accounts, this.accountRepository.manager);
    const extras = options.listExtras ? await this.registry.listExtras(accounts) : new Map<number, Record<string, unknown>>();

    const reconciliation = options.detail ? await this.#reconciliationFields(accounts) : new Map<number, ReconciliationFields>();

    return accounts.map((account) =>
      serializeAccount(account, {
        balance: balances.get(account.id) ?? account.openingBalance,
        mask: options.mask,
        nested: this.registry.get(account.type).serialize(details.get(account.id), account),
        extra: extras.get(account.id),
        reconciliation: reconciliation.get(account.id),
      }),
    );
  }

  // One latest-finished and one open-statement lookup per detail account (at most one account).
  async #reconciliationFields(accounts: Account[]): Promise<Map<number, ReconciliationFields>> {
    return new Map(await Promise.all(accounts.map(async (account): Promise<[number, ReconciliationFields]> => [
      account.id,
      {
        latestFinished: await this.reconciliation.latestFinished(account.id),
        openId: (await this.reconciliation.openStatement(account.id))?.id ?? null,
      },
    ])));
  }
}
