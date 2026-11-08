import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CreateTransactionDto } from '../dto/create-transaction.dto.js';
import type { UpdateTransactionDto } from '../dto/update-transaction.dto.js';
import { TransactionsController } from '../transactions.controller.js';
import { ORGANIZATION, PERSONAL } from './account.test-support.js';
import { fakeLoader } from './bank-controllers.test-support.js';

describe('TransactionsController', () => {
  it('reads the ledger with the parsed id and page (default 1)', async () => {
    const { loader, transactions } = fakeLoader();
    const controller = new TransactionsController(loader);

    await controller.ledger(PERSONAL, '3', undefined);
    await controller.ledger(ORGANIZATION, '3', '2');

    expect(transactions.ledger).toHaveBeenNthCalledWith(1, PERSONAL, 3, 1);
    expect(transactions.ledger).toHaveBeenNthCalledWith(2, ORGANIZATION, 3, 2);
  });

  it.each(['0', '-1', 'abc', '1.5'])('rejects the page %p with a 400', async (page) => {
    const { loader, services } = fakeLoader();

    await expect(new TransactionsController(loader).ledger(PERSONAL, '3', page)).rejects.toThrow(BadRequestException);
    expect(services).not.toHaveBeenCalled();
  });

  it('delegates the writes with the parsed ids', async () => {
    const { loader, transactions } = fakeLoader();
    const controller = new TransactionsController(loader);
    const createDto = { amount: '1' } as CreateTransactionDto;
    const updateDto = { notes: null } as UpdateTransactionDto;

    await controller.create(PERSONAL, '3', createDto);
    await controller.update(PERSONAL, '3', '9', updateDto);
    await controller.remove(PERSONAL, '3', '9');

    expect(transactions.create).toHaveBeenCalledWith(PERSONAL, 3, createDto);
    expect(transactions.update).toHaveBeenCalledWith(PERSONAL, 3, 9, updateDto);
    expect(transactions.delete).toHaveBeenCalledWith(PERSONAL, 3, 9);
  });

  it('answers the uniform 404 for malformed ids', async () => {
    const { loader, services } = fakeLoader();
    const controller = new TransactionsController(loader);

    await expect(controller.ledger(PERSONAL, 'x', undefined)).rejects.toThrow(NotFoundException);
    await expect(controller.create(PERSONAL, 'x', {} as CreateTransactionDto)).rejects.toThrow(NotFoundException);
    await expect(controller.update(PERSONAL, '3', 'x', {} as UpdateTransactionDto)).rejects.toThrow(NotFoundException);
    await expect(controller.remove(PERSONAL, '3', '1e3')).rejects.toThrow(NotFoundException);
    expect(services).not.toHaveBeenCalled();
  });
});
