import { NotFoundException } from '@nestjs/common';
import { AccountsController } from '../accounts.controller.js';
import { ORGANIZATION, PERSONAL } from './account.test-support.js';
import { fakeLoader } from './bank-controllers.test-support.js';
import type { CreateAccountDto } from '../dto/create-account.dto.js';
import type { UpdateAccountDto } from '../dto/update-account.dto.js';

describe('AccountsController', () => {
  it('lists with the owner and the parsed filters', async () => {
    const { loader, accounts } = fakeLoader();
    const controller = new AccountsController(loader);

    await controller.list(PERSONAL, { type: 'regular', archived: 'true' });
    await controller.list(ORGANIZATION, {});

    expect(accounts.list).toHaveBeenNthCalledWith(1, PERSONAL, { type: 'regular', archived: true });
    expect(accounts.list).toHaveBeenNthCalledWith(2, ORGANIZATION, { type: undefined, archived: false });
  });

  it('delegates create with the owner and the body', async () => {
    const { loader, accounts } = fakeLoader();
    const dto = { name: 'Nubank' } as CreateAccountDto;

    await expect(new AccountsController(loader).create(ORGANIZATION, dto)).resolves.toEqual({ id: 1 });
    expect(accounts.create).toHaveBeenCalledWith(ORGANIZATION, dto);
  });

  it('delegates the id routes with the parsed id', async () => {
    const { loader, accounts } = fakeLoader();
    const controller = new AccountsController(loader);
    const dto = { name: 'x' } as UpdateAccountDto;

    await controller.show(PERSONAL, '12');
    await controller.update(PERSONAL, '12', dto);
    await controller.remove(PERSONAL, '12');
    await controller.archive(PERSONAL, '12');
    await controller.unarchive(PERSONAL, '12');

    expect(accounts.find).toHaveBeenCalledWith(PERSONAL, 12);
    expect(accounts.update).toHaveBeenCalledWith(PERSONAL, 12, dto);
    expect(accounts.delete).toHaveBeenCalledWith(PERSONAL, 12);
    expect(accounts.archive).toHaveBeenCalledWith(PERSONAL, 12);
    expect(accounts.unarchive).toHaveBeenCalledWith(PERSONAL, 12);
  });

  it('answers the uniform 404 for a malformed id without loading the module', async () => {
    const { loader, services } = fakeLoader();
    const controller = new AccountsController(loader);

    await expect(controller.show(PERSONAL, 'abc')).rejects.toThrow(NotFoundException);
    await expect(controller.update(PERSONAL, '0', {} as UpdateAccountDto)).rejects.toThrow(NotFoundException);
    await expect(controller.remove(PERSONAL, '1.5')).rejects.toThrow(NotFoundException);
    await expect(controller.archive(PERSONAL, '-1')).rejects.toThrow(NotFoundException);
    await expect(controller.unarchive(PERSONAL, '007')).rejects.toThrow(NotFoundException);
    expect(services).not.toHaveBeenCalled();
  });
});
