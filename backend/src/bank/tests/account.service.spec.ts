import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { IsNull, QueryFailedError } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import { AccountTypeRegistry } from '../account-types/account-type.registry.js';
import { DebtAccountHandler } from '../account-types/debt-account.handler.js';
import { defaultDebtState } from '../account-types/debt-details.js';
import { InvestmentAccountHandler } from '../account-types/investment-account.handler.js';
import { defaultInvestmentState } from '../account-types/investment-details.js';
import { RegularAccountHandler } from '../account-types/regular-account.handler.js';
import { AccountService } from '../account.service.js';
import { buildAccount, ORGANIZATION, PERSONAL } from './account.test-support.js';
import type { CreateAccountDto } from '../dto/create-account.dto.js';
import type { UpdateAccountDto } from '../dto/update-account.dto.js';
import { Account } from '../entities/account.entity.js';
import { DebtDetails } from '../entities/debt-details.entity.js';
import { InvestmentDetails } from '../entities/investment-details.entity.js';

function mysqlError(code: string): QueryFailedError {
  return new QueryFailedError('q', [], Object.assign(new Error(code), { code }));
}

function setup(stored: Account | null = buildAccount()) {
  const transactionalSave = jest.fn(async (account: Account) => ({ ...account, id: 99 }));
  const manager = {
    transaction: jest.fn(async (work: (m: unknown) => Promise<unknown>) =>
      work({ getRepository: () => ({ save: transactionalSave }) })),
  };
  const accountRepository = {
    find: jest.fn(async (): Promise<Account[]> => []),
    findOneBy: jest.fn(async () => stored),
    create: jest.fn((fields: Partial<Account>) => buildAccount({ id: undefined, ...fields })),
    save: jest.fn(async (account: Account) => account),
    delete: jest.fn(async () => ({})),
    manager,
  };
  const balances = {
    currentBalances: jest.fn(async (accounts: Account[]) =>
      new Map(accounts.map((account) => [account.id, account.openingBalance + 1n]))),
    hasTransactions: jest.fn(async () => false),
  };
  const registry = new AccountTypeRegistry([new RegularAccountHandler()]);
  const service = new AccountService(accountRepository as never, registry, balances as never, {
    defaultCurrency: 'BRL',
  });

  return { service, accountRepository, balances, transactionalSave, manager };
}

const createDto = (fields: Partial<CreateAccountDto> = {}): CreateAccountDto =>
  ({ name: 'Nubank', ...fields }) as CreateAccountDto;
const updateDto = (fields: Partial<UpdateAccountDto>): UpdateAccountDto => fields as UpdateAccountDto;

async function codeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return ((error as ConflictException).getResponse() as { code?: string }).code;
  }
  throw new Error('expected a rejection');
}

describe('AccountService', () => {
  describe('list', () => {
    it('lists active regular accounts of the personal owner, by name, masked, with one balance query', async () => {
      const { service, accountRepository, balances } = setup();
      const accounts = [buildAccount({ id: 1 }), buildAccount({ id: 2, name: 'Itaú' })];
      accountRepository.find.mockResolvedValue(accounts);

      const result = await service.list(PERSONAL);

      expect(accountRepository.find).toHaveBeenCalledWith({
        where: { userId: 7, organizationId: IsNull(), type: 'regular', archivedAt: IsNull() },
        order: { name: 'ASC', id: 'ASC' },
      });
      expect(balances.currentBalances).toHaveBeenCalledTimes(1);
      expect(balances.currentBalances).toHaveBeenCalledWith(accounts);
      expect(result.map((account) => account.account_number)).toEqual(['•••• 45-6', '•••• 45-6']);
      expect(result[0].balance).toBe('1000.01');
    });

    it('includes archived accounts when asked, scoped to the organization', async () => {
      const { service, accountRepository } = setup();

      await service.list(ORGANIZATION, { archived: true });

      expect(accountRepository.find).toHaveBeenCalledWith({
        where: { userId: IsNull(), organizationId: 3, type: 'regular' },
        order: { name: 'ASC', id: 'ASC' },
      });
    });

    it('rejects a type without a handler', async () => {
      const { service } = setup();

      await expect(service.list(PERSONAL, { type: 'debt' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('find', () => {
    it('scopes the lookup with ownerWhere and returns the full number and balance', async () => {
      const { service, accountRepository } = setup();

      const result = await service.find(ORGANIZATION, 1);

      expect(accountRepository.findOneBy).toHaveBeenCalledWith({ userId: IsNull(), organizationId: 3, id: 1 });
      expect(result).toMatchObject({ account_number: '12345-6', balance: '1000.01' });
      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('organization_id');
    });

    it('answers the uniform 404 when the account is not owned (wrong context or unknown)', async () => {
      const { service } = setup(null);

      await expect(service.find(PERSONAL, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('defaults type and currency, sets the personal owner and today as opening date', async () => {
      const { service, accountRepository, transactionalSave } = setup();

      const result = await service.create(PERSONAL, createDto());

      expect(accountRepository.create).toHaveBeenCalledWith({
        userId: 7,
        organizationId: null,
        type: 'regular',
        name: 'Nubank',
        bankName: null,
        branch: null,
        accountNumber: null,
        currency: 'BRL',
        openingDate: new Date().toISOString().slice(0, 10),
        openingBalance: 0n,
        archivedAt: null,
        notes: null,
      });
      expect(transactionalSave).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ id: 99, type: 'regular', currency: 'BRL', opening_balance: '0.00' });
    });

    it('sets the organization owner only from the context', async () => {
      const { service, accountRepository } = setup();

      await service.create(ORGANIZATION, createDto());

      expect(accountRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, organizationId: 3 }),
      );
    });

    it('parses the opening balance in the given currency', async () => {
      const { service, accountRepository } = setup();

      await service.create(PERSONAL, createDto({ currency: 'JPY', opening_balance: '500', opening_date: '2026-01-05' }));

      expect(accountRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'JPY', openingBalance: 500n, openingDate: '2026-01-05' }),
      );
    });

    it.each(['10.555', 'abc', '100000000000.01'])('rejects the opening balance %p with a 400', async (value) => {
      const { service } = setup();

      await expect(service.create(PERSONAL, createDto({ opening_balance: value }))).rejects.toThrow(BadRequestException);
    });

    it.each(['debt', 'provider_expense', 'nope'])('rejects the type %p with a 400', async (type) => {
      const { service } = setup();

      await expect(service.create(PERSONAL, createDto({ type }))).rejects.toThrow(BadRequestException);
    });

    it('maps a duplicate name to 409', async () => {
      const { service, manager } = setup();
      manager.transaction.mockRejectedValue(mysqlError('ER_DUP_ENTRY'));

      expect(await codeOf(service.create(PERSONAL, createDto()))).toBe(ErrorCodes.ACCOUNT_NAME_TAKEN);
    });

    it('rethrows other errors', async () => {
      const { service, manager } = setup();
      manager.transaction.mockRejectedValue(new Error('boom'));

      await expect(service.create(PERSONAL, createDto())).rejects.toThrow('boom');
    });
  });

  describe('update', () => {
    it('edits the fields and the opening anchor', async () => {
      const { service, transactionalSave } = setup();

      await service.update(PERSONAL, 1, updateDto({
        name: 'Renamed', bank_name: null, opening_date: '2025-12-01', opening_balance: '-5.5', notes: 'n',
      }));

      expect(transactionalSave).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Renamed', bankName: null, branch: '0001', openingDate: '2025-12-01', openingBalance: -550n, notes: 'n',
      }));
    });

    it('answers 404 for an account of another owner', async () => {
      const { service } = setup(null);

      await expect(service.update(PERSONAL, 1, updateDto({ name: 'x' }))).rejects.toThrow(NotFoundException);
    });

    it('accepts a rename on an archived account', async () => {
      const { service, transactionalSave } = setup(buildAccount({ archivedAt: new Date() }));

      await service.update(PERSONAL, 1, updateDto({ name: 'Old', notes: undefined }));

      expect(transactionalSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Old' }));
    });

    it('answers 409 for any other field on an archived account', async () => {
      const { service } = setup(buildAccount({ archivedAt: new Date() }));

      expect(await codeOf(service.update(PERSONAL, 1, updateDto({ name: 'Old', notes: 'x' })))).toBe(
        ErrorCodes.ACCOUNT_ARCHIVED,
      );
    });

    it('locks the currency once the account has transactions', async () => {
      const { service, balances } = setup();
      balances.hasTransactions.mockResolvedValue(true);

      expect(await codeOf(service.update(PERSONAL, 1, updateDto({ currency: 'USD' })))).toBe(ErrorCodes.CURRENCY_LOCKED);
    });

    it('accepts the same currency even with transactions', async () => {
      const { service, balances } = setup();
      balances.hasTransactions.mockResolvedValue(true);

      await expect(service.update(PERSONAL, 1, updateDto({ currency: 'BRL' }))).resolves.toMatchObject({ currency: 'BRL' });
    });

    it('changes the currency before any transaction, keeping the opening value', async () => {
      const { service, transactionalSave } = setup();

      await service.update(PERSONAL, 1, updateDto({ currency: 'JPY' }));

      expect(transactionalSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'JPY', openingBalance: 1000n }));
    });

    it('parses a new opening balance in the new currency', async () => {
      const { service, transactionalSave } = setup();

      await service.update(PERSONAL, 1, updateDto({ currency: 'BHD', opening_balance: '1.234' }));

      expect(transactionalSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'BHD', openingBalance: 1234n }));
    });

    it('rejects a currency change that cannot represent the opening balance', async () => {
      const { service } = setup(buildAccount({ openingBalance: 12345n }));

      await expect(service.update(PERSONAL, 1, updateDto({ currency: 'JPY' }))).rejects.toThrow(BadRequestException);
    });

    it('maps a rename clash to 409', async () => {
      const { service, manager } = setup();
      manager.transaction.mockRejectedValue(mysqlError('ER_DUP_ENTRY'));

      expect(await codeOf(service.update(PERSONAL, 1, updateDto({ name: 'Taken' })))).toBe(ErrorCodes.ACCOUNT_NAME_TAKEN);
    });
  });

  describe('archive / unarchive', () => {
    it('archives an active account', async () => {
      const { service, accountRepository } = setup();

      const result = await service.archive(PERSONAL, 1);

      expect(accountRepository.save).toHaveBeenCalledWith(expect.objectContaining({ archivedAt: expect.any(Date) }));
      expect(result.archived_at).toBeInstanceOf(Date);
    });

    it('leaves an archived account as is', async () => {
      const archivedAt = new Date('2026-02-01T00:00:00Z');
      const { service, accountRepository } = setup(buildAccount({ archivedAt }));

      expect((await service.archive(PERSONAL, 1)).archived_at).toBe(archivedAt);
      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('unarchives an archived account', async () => {
      const { service, accountRepository } = setup(buildAccount({ archivedAt: new Date() }));

      const result = await service.unarchive(PERSONAL, 1);

      expect(accountRepository.save).toHaveBeenCalledWith(expect.objectContaining({ archivedAt: null }));
      expect(result.archived_at).toBeNull();
    });

    it('leaves an active account as is', async () => {
      const { service, accountRepository } = setup();

      await service.unarchive(PERSONAL, 1);

      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('maps an unarchive name clash to 409', async () => {
      const { service, accountRepository } = setup(buildAccount({ archivedAt: new Date() }));
      accountRepository.save.mockRejectedValue(mysqlError('ER_DUP_ENTRY'));

      expect(await codeOf(service.unarchive(PERSONAL, 1))).toBe(ErrorCodes.ACCOUNT_NAME_TAKEN);
    });

    it('answers 404 for another owner', async () => {
      const { service } = setup(null);

      await expect(service.archive(PERSONAL, 1)).rejects.toThrow(NotFoundException);
      await expect(service.unarchive(PERSONAL, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('account_number masking', () => {
    const MASKED = '•••• 45-6';

    it('returns the full number only on the detail', async () => {
      const { service } = setup();

      expect((await service.find(PERSONAL, 1)).account_number).toBe('12345-6');
    });

    it('masks the number on the create response', async () => {
      const { service } = setup();

      const result = await service.create(PERSONAL, createDto({ account_number: '12345-6' }));

      expect(result.account_number).toBe(MASKED);
    });

    it('masks the number on the update response', async () => {
      const { service } = setup();

      expect((await service.update(PERSONAL, 1, updateDto({ notes: 'n' }))).account_number).toBe(MASKED);
    });

    it('masks the number on the archive response', async () => {
      const { service } = setup();

      expect((await service.archive(PERSONAL, 1)).account_number).toBe(MASKED);
    });

    it('masks the number on the unarchive response', async () => {
      const { service } = setup(buildAccount({ archivedAt: new Date() }));

      expect((await service.unarchive(PERSONAL, 1)).account_number).toBe(MASKED);
    });
  });

  describe('delete', () => {
    it('deletes an account without transactions', async () => {
      const { service, accountRepository } = setup();

      await service.delete(PERSONAL, 1);

      expect(accountRepository.delete).toHaveBeenCalledWith({ id: 1 });
    });

    it('answers 409 pointing to archive when the account has transactions', async () => {
      const { service, balances, accountRepository } = setup();
      balances.hasTransactions.mockResolvedValue(true);

      const promise = service.delete(PERSONAL, 1);

      await expect(promise).rejects.toThrow(/archive/);
      expect(await codeOf(service.delete(PERSONAL, 1))).toBe(ErrorCodes.ACCOUNT_HAS_TRANSACTIONS);
      expect(accountRepository.delete).not.toHaveBeenCalled();
    });

    it('maps the FK refusal (race) to the same 409', async () => {
      const { service, accountRepository } = setup();
      accountRepository.delete.mockRejectedValue(mysqlError('ER_ROW_IS_REFERENCED_2'));

      expect(await codeOf(service.delete(PERSONAL, 1))).toBe(ErrorCodes.ACCOUNT_HAS_TRANSACTIONS);
    });

    it('rethrows other errors', async () => {
      const { service, accountRepository } = setup();
      accountRepository.delete.mockRejectedValue(new Error('boom'));

      await expect(service.delete(PERSONAL, 1)).rejects.toThrow('boom');
    });

    it('answers 404 for another owner', async () => {
      const { service } = setup(null);

      await expect(service.delete(PERSONAL, 1)).rejects.toThrow(NotFoundException);
    });
  });
});

const STORED_DEBT = {
  ...defaultDebtState(),
  accountId: 1,
  interestRate: '1.9900',
  interestPeriod: 'monthly',
  instalmentAmount: 50000n,
  instalmentFrequency: 'yearly',
  dueDay: 10,
  dueMonth: 3,
};

function setupDebt(account: Account = buildAccount({ type: 'debt' }), details: object[] = [STORED_DEBT]) {
  const accountSave = jest.fn(async (saved: Account) => ({ ...saved, id: saved.id ?? 99 }));
  const detailsSave = jest.fn(async (row: object) => row);
  const detailsFind = jest.fn(async () => details.map((row) => Object.assign(new DebtDetails(), row)));
  const repositoryFor = (entity: unknown) =>
    entity === Account ? { save: accountSave } : { save: detailsSave, find: detailsFind };
  const manager: { getRepository: jest.Mock; transaction: jest.Mock } = {
    getRepository: jest.fn(repositoryFor),
    transaction: jest.fn(async (work: (m: unknown) => Promise<unknown>) => work(manager)),
  };
  const accountRepository = {
    find: jest.fn(async (): Promise<Account[]> => [account]),
    findOneBy: jest.fn(async () => account),
    create: jest.fn((fields: Partial<Account>) => buildAccount({ id: undefined, ...fields })),
    save: jest.fn(async (saved: Account) => saved),
    manager,
  };
  const balances = {
    currentBalances: jest.fn(async () => new Map()),
    hasTransactions: jest.fn(async () => false),
  };
  const registry = new AccountTypeRegistry([new RegularAccountHandler(), new DebtAccountHandler()]);
  const service = new AccountService(accountRepository as never, registry, balances as never, { defaultCurrency: 'BRL' });

  return { service, accountRepository, balances, accountSave, detailsSave, detailsFind };
}

describe('AccountService with debt accounts', () => {
  describe('create', () => {
    it('creates a debt with a defaults details row when no debt object is sent', async () => {
      const { service, detailsSave } = setupDebt(buildAccount({ type: 'debt' }), []);

      const result = await service.create(PERSONAL, createDto({ type: 'debt' }));

      expect(detailsSave).toHaveBeenCalledWith({ ...defaultDebtState(), accountId: 99 });
      expect(result.type).toBe('debt');
      expect(result.debt).toMatchObject({ instalment_frequency: 'monthly', interest_rate: null });
    });

    it('parses the instalment amount in the new account currency', async () => {
      const { service, detailsSave } = setupDebt();

      await service.create(PERSONAL, createDto({
        type: 'debt',
        currency: 'JPY',
        debt: { instalment_amount: '500' },
      } as Partial<CreateAccountDto>));

      expect(detailsSave).toHaveBeenCalledWith(expect.objectContaining({ instalmentAmount: 500n }));
    });

    it('rejects a debt object on a regular account with a 400, before saving', async () => {
      const { service, accountSave } = setupDebt();

      await expect(service.create(PERSONAL, createDto({ debt: {} } as Partial<CreateAccountDto>))).rejects.toThrow(
        BadRequestException,
      );
      expect(accountSave).not.toHaveBeenCalled();
    });

    it('rejects a broken paired rule with a 400', async () => {
      const { service } = setupDebt();

      await expect(service.create(PERSONAL, createDto({
        type: 'debt',
        debt: { interest_rate: '1' },
      } as Partial<CreateAccountDto>))).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('merges the debt object onto the stored details', async () => {
      const { service, detailsSave } = setupDebt();

      await service.update(PERSONAL, 1, updateDto({ debt: { interest_rate: '2.5' } }));

      expect(detailsSave).toHaveBeenCalledWith(expect.objectContaining({
        accountId: 1,
        interestRate: '2.5',
        interestPeriod: 'monthly',
        instalmentAmount: 50000n,
        dueMonth: 3,
      }));
    });

    it('rejects clearing only the period, on the merged state', async () => {
      const { service, detailsSave } = setupDebt();

      await expect(service.update(PERSONAL, 1, updateDto({ debt: { interest_period: null } }))).rejects.toThrow(
        BadRequestException,
      );
      expect(detailsSave).not.toHaveBeenCalled();
    });

    it('rejects a debt object on a regular account with a 400', async () => {
      const { service } = setupDebt(buildAccount());

      await expect(service.update(PERSONAL, 1, updateDto({ debt: {} }))).rejects.toThrow(BadRequestException);
    });

    it('answers 409 for any debt field on an archived debt, even an invalid one', async () => {
      const { service } = setupDebt(buildAccount({ type: 'debt', archivedAt: new Date() }));

      expect(await codeOf(service.update(PERSONAL, 1, updateDto({ debt: { interest_period: null } })))).toBe(
        ErrorCodes.ACCOUNT_ARCHIVED,
      );
    });

    it('renames an archived debt without touching its details', async () => {
      const { service, detailsSave } = setupDebt(buildAccount({ type: 'debt', archivedAt: new Date() }));

      await service.update(PERSONAL, 1, updateDto({ name: 'Old loan' }));

      expect(detailsSave).toHaveBeenCalledWith(expect.objectContaining({ instalmentAmount: 50000n, dueMonth: 3 }));
    });

    it('rescales the stored instalment amount on a currency change', async () => {
      const { service, detailsSave, accountSave } = setupDebt();

      await service.update(PERSONAL, 1, updateDto({ currency: 'JPY' }));

      expect(accountSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'JPY', openingBalance: 1000n }));
      expect(detailsSave).toHaveBeenCalledWith(expect.objectContaining({ instalmentAmount: 500n }));
    });

    it('rejects a currency change that cannot represent the instalment amount (12.50 BRL to JPY)', async () => {
      const { service, detailsSave } = setupDebt(buildAccount({ type: 'debt' }), [{ ...STORED_DEBT, instalmentAmount: 1250n }]);

      await expect(service.update(PERSONAL, 1, updateDto({ currency: 'JPY' }))).rejects.toThrow(BadRequestException);
      expect(detailsSave).not.toHaveBeenCalled();
    });

    it('parses a sent instalment amount in the new currency instead of rescaling', async () => {
      const { service, detailsSave } = setupDebt(buildAccount({ type: 'debt' }), [{ ...STORED_DEBT, instalmentAmount: 1250n }]);

      await service.update(PERSONAL, 1, updateDto({ currency: 'JPY', debt: { instalment_amount: '13' } }));

      expect(detailsSave).toHaveBeenCalledWith(expect.objectContaining({ instalmentAmount: 13n }));
    });

    it('keeps the 409 currency lock ahead of the rescale', async () => {
      const { service, balances } = setupDebt(buildAccount({ type: 'debt' }), [{ ...STORED_DEBT, instalmentAmount: 1250n }]);
      balances.hasTransactions.mockResolvedValue(true);

      expect(await codeOf(service.update(PERSONAL, 1, updateDto({ currency: 'JPY' })))).toBe(ErrorCodes.CURRENCY_LOCKED);
    });
  });

  describe('responses', () => {
    const DEBT_RESPONSE = {
      interest_rate: '1.99',
      interest_period: 'monthly',
      instalment_amount: '500.00',
      instalment_frequency: 'yearly',
      due_day: 10,
      due_month: 3,
      instalment_count: null,
    };

    it('lists debts with their debt object, loading details in one query', async () => {
      const { service, accountRepository, detailsFind } = setupDebt();

      const result = await service.list(PERSONAL, { type: 'debt' });

      expect(accountRepository.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ type: 'debt' }),
      }));
      expect(detailsFind).toHaveBeenCalledTimes(1);
      expect(result[0].debt).toEqual(DEBT_RESPONSE);
    });

    it('returns the debt object on the detail, archive and unarchive responses', async () => {
      const { service } = setupDebt();

      expect((await service.find(PERSONAL, 1)).debt).toEqual(DEBT_RESPONSE);
      expect((await service.archive(PERSONAL, 1)).debt).toEqual(DEBT_RESPONSE);
      expect((await service.unarchive(PERSONAL, 1)).debt).toEqual(DEBT_RESPONSE);
    });

    it('never adds a debt object to a regular account', async () => {
      const { service, detailsFind } = setupDebt(buildAccount());

      expect(await service.find(PERSONAL, 1)).not.toHaveProperty('debt');
      expect(detailsFind).not.toHaveBeenCalled();
    });
  });
});

const STORED_INVESTMENT = {
  ...defaultInvestmentState(),
  accountId: 1,
  kind: 'fixed_income',
  yieldRate: '1.1000',
  yieldPeriod: 'monthly',
};

function setupInvestment(
  account: Account = buildAccount({ type: 'investment', openingBalance: 0n }),
  details: object[] = [STORED_INVESTMENT],
) {
  const accountSave = jest.fn(async (saved: Account) => ({ ...saved, id: saved.id ?? 99 }));
  const detailsSave = jest.fn(async (row: object) => row);
  const detailsFind = jest.fn(async () => details.map((row) => Object.assign(new InvestmentDetails(), row)));
  const repositoryFor = (entity: unknown) =>
    entity === Account ? { save: accountSave } : { save: detailsSave, find: detailsFind };
  const manager: { getRepository: jest.Mock; transaction: jest.Mock } = {
    getRepository: jest.fn(repositoryFor),
    transaction: jest.fn(async (work: (m: unknown) => Promise<unknown>) => work(manager)),
  };
  const accountRepository = {
    find: jest.fn(async (): Promise<Account[]> => [account]),
    findOneBy: jest.fn(async () => account),
    create: jest.fn((fields: Partial<Account>) => buildAccount({ id: undefined, ...fields })),
    save: jest.fn(async (saved: Account) => saved),
    manager,
  };
  const balances = {
    currentBalances: jest.fn(async () => new Map()),
    hasTransactions: jest.fn(async () => false),
  };
  const investmentHandler = new InvestmentAccountHandler();
  const registry = new AccountTypeRegistry([new RegularAccountHandler(), new DebtAccountHandler(), investmentHandler]);
  const service = new AccountService(accountRepository as never, registry, balances as never, { defaultCurrency: 'BRL' });

  return { service, accountRepository, balances, accountSave, detailsSave, detailsFind, investmentHandler, manager };
}

describe('AccountService with investment accounts', () => {
  describe('create', () => {
    it('creates an investment with an all-null details row when no investment object is sent', async () => {
      const { service, detailsSave } = setupInvestment();

      const result = await service.create(PERSONAL, createDto({ type: 'investment' }));

      expect(detailsSave).toHaveBeenCalledWith({ ...defaultInvestmentState(), accountId: 99 });
      expect(result.type).toBe('investment');
      expect(result.opening_balance).toBe('0.00');
    });

    it('calls validateAccount with the account about to be saved', async () => {
      const { service, investmentHandler } = setupInvestment();
      const validateAccount = jest.spyOn(investmentHandler, 'validateAccount');

      await service.create(PERSONAL, createDto({ type: 'investment', opening_balance: '0' }));

      expect(validateAccount).toHaveBeenCalledWith(expect.objectContaining({ type: 'investment', openingBalance: 0n }));
    });

    it.each(['0', '0.00', '-0'])('accepts the opening balance %p', async (opening) => {
      const { service, accountSave } = setupInvestment();

      await service.create(PERSONAL, createDto({ type: 'investment', opening_balance: opening }));

      expect(accountSave).toHaveBeenCalledWith(expect.objectContaining({ openingBalance: 0n }));
    });

    it.each(['0.01', '-5.00', '100'])('rejects the opening balance %p with a 400, before saving', async (opening) => {
      const { service, manager } = setupInvestment();

      await expect(service.create(PERSONAL, createDto({ type: 'investment', opening_balance: opening }))).rejects.toThrow(
        BadRequestException,
      );
      expect(manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects an investment object on a regular account with a 400', async () => {
      const { service, accountSave } = setupInvestment();

      await expect(service.create(PERSONAL, createDto({ investment: {} } as Partial<CreateAccountDto>))).rejects.toThrow(
        BadRequestException,
      );
      expect(accountSave).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('merges the investment object onto the stored details', async () => {
      const { service, detailsSave } = setupInvestment();

      await service.update(PERSONAL, 1, updateDto({ investment: { yield_rate: '3' } }));

      expect(detailsSave).toHaveBeenCalledWith(expect.objectContaining({
        accountId: 1,
        kind: 'fixed_income',
        yieldRate: '3',
        yieldPeriod: 'monthly',
      }));
    });

    it('rejects clearing only the period, on the merged state', async () => {
      const { service, detailsSave } = setupInvestment();

      await expect(service.update(PERSONAL, 1, updateDto({ investment: { yield_period: null } }))).rejects.toThrow(
        BadRequestException,
      );
      expect(detailsSave).not.toHaveBeenCalled();
    });

    it.each(['0', '0.00'])('accepts the opening balance %p', async (opening) => {
      const { service } = setupInvestment();

      await expect(service.update(PERSONAL, 1, updateDto({ opening_balance: opening }))).resolves.toBeDefined();
    });

    it('rejects a non-zero opening balance with a 400, before saving', async () => {
      const { service, manager } = setupInvestment();

      await expect(service.update(PERSONAL, 1, updateDto({ opening_balance: '1.00' }))).rejects.toThrow(BadRequestException);
      expect(manager.transaction).not.toHaveBeenCalled();
    });

    it('calls validateAccount on PATCH too', async () => {
      const { service, investmentHandler } = setupInvestment();
      const validateAccount = jest.spyOn(investmentHandler, 'validateAccount');

      await service.update(PERSONAL, 1, updateDto({ notes: 'n' }));

      expect(validateAccount).toHaveBeenCalledTimes(1);
    });

    it('answers 409 for a non-zero opening balance on an archived investment', async () => {
      const { service } = setupInvestment(buildAccount({ type: 'investment', openingBalance: 0n, archivedAt: new Date() }));

      expect(await codeOf(service.update(PERSONAL, 1, updateDto({ opening_balance: '5.00' })))).toBe(
        ErrorCodes.ACCOUNT_ARCHIVED,
      );
    });

    it('answers 409 for any investment field on an archived investment', async () => {
      const { service } = setupInvestment(buildAccount({ type: 'investment', openingBalance: 0n, archivedAt: new Date() }));

      expect(await codeOf(service.update(PERSONAL, 1, updateDto({ investment: { yield_period: null } })))).toBe(
        ErrorCodes.ACCOUNT_ARCHIVED,
      );
    });

    it('keeps a zero opening balance across a currency change', async () => {
      const { service, accountSave } = setupInvestment();

      await service.update(PERSONAL, 1, updateDto({ currency: 'JPY' }));

      expect(accountSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'JPY', openingBalance: 0n }));
    });
  });

  describe('responses', () => {
    it('lists investments with their investment object, loading details in one query', async () => {
      const { service, detailsFind } = setupInvestment();

      const result = await service.list(PERSONAL, { type: 'investment' });

      expect(detailsFind).toHaveBeenCalledTimes(1);
      expect(result[0].investment).toEqual({
        kind: 'fixed_income',
        yield_rate: '1.1',
        yield_period: 'monthly',
        maturity_date: null,
        liquidity_days: null,
      });
    });

    it('never adds an investment object to a regular account', async () => {
      const { service, detailsFind } = setupInvestment(buildAccount());

      expect(await service.find(PERSONAL, 1)).not.toHaveProperty('investment');
      expect(detailsFind).not.toHaveBeenCalled();
    });
  });
});
