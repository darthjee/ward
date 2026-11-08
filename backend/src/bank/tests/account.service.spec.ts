import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { IsNull, QueryFailedError } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import { AccountTypeRegistry } from '../account-types/account-type.registry.js';
import { RegularAccountHandler } from '../account-types/regular-account.handler.js';
import { AccountService } from '../account.service.js';
import { buildAccount, ORGANIZATION, PERSONAL } from './account.test-support.js';
import type { CreateAccountDto } from '../dto/create-account.dto.js';
import type { UpdateAccountDto } from '../dto/update-account.dto.js';
import type { Account } from '../entities/account.entity.js';

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

    it.each(['debt', 'investment', 'nope'])('rejects the type %p with a 400', async (type) => {
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
