import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  CreateReconciliationDto,
  EmptyReconciliationBodyDto,
  ReconciliationTicksDto,
  UpdateReconciliationDto,
} from '../dto/reconciliation.dto.js';
import { ReconciliationsController } from '../reconciliations.controller.js';
import { ORGANIZATION, PERSONAL } from './account.test-support.js';
import type { BankModuleLoader } from '../bank-module.loader.js';

function fakeLoader() {
  const reconciliations = {
    list: jest.fn(async () => ({ reconciliations: [] })),
    start: jest.fn(async () => ({ id: 1 })),
    get: jest.fn(async () => ({ id: 1 })),
    edit: jest.fn(async () => ({ id: 1 })),
    cancel: jest.fn(async () => undefined),
    tick: jest.fn(async () => ({ id: 1 })),
    finish: jest.fn(async () => ({ id: 1 })),
    undo: jest.fn(async () => ({ id: 1 })),
  };
  const services = jest.fn(async () => ({ reconciliations }));

  return { loader: { services } as unknown as BankModuleLoader, services, reconciliations };
}

describe('ReconciliationsController', () => {
  it('reads the history with the parsed id and page (default 1)', async () => {
    const { loader, reconciliations } = fakeLoader();
    const controller = new ReconciliationsController(loader);

    await controller.list(PERSONAL, '3', undefined);
    await controller.list(ORGANIZATION, '3', '2');

    expect(reconciliations.list).toHaveBeenNthCalledWith(1, PERSONAL, 3, 1);
    expect(reconciliations.list).toHaveBeenNthCalledWith(2, ORGANIZATION, 3, 2);
  });

  it.each(['0', '-1', 'abc', '1.5'])('rejects the page %p with a 400 before loading the module', async (page) => {
    const { loader, services } = fakeLoader();

    await expect(new ReconciliationsController(loader).list(PERSONAL, '3', page)).rejects.toThrow(BadRequestException);
    expect(services).not.toHaveBeenCalled();
  });

  it('delegates every route with the parsed ids', async () => {
    const { loader, reconciliations } = fakeLoader();
    const controller = new ReconciliationsController(loader);
    const create = { statement_date: '2026-02-28', statement_balance: '1.00' } as CreateReconciliationDto;
    const update = { statement_balance: '2.00' } as UpdateReconciliationDto;
    const ticks = { tick: [1], untick: [] } as unknown as ReconciliationTicksDto;
    const empty = {} as EmptyReconciliationBodyDto;

    await controller.create(PERSONAL, '3', create);
    await controller.show(PERSONAL, '3', '9');
    await controller.update(PERSONAL, '3', '9', update);
    await controller.cancel(PERSONAL, '3', '9');
    await controller.ticks(PERSONAL, '3', '9', ticks);
    await controller.finish(PERSONAL, '3', '9', empty);
    await controller.undo(PERSONAL, '3', '9', empty);

    expect(reconciliations.start).toHaveBeenCalledWith(PERSONAL, 3, create);
    expect(reconciliations.get).toHaveBeenCalledWith(PERSONAL, 3, 9);
    expect(reconciliations.edit).toHaveBeenCalledWith(PERSONAL, 3, 9, update);
    expect(reconciliations.cancel).toHaveBeenCalledWith(PERSONAL, 3, 9);
    expect(reconciliations.tick).toHaveBeenCalledWith(PERSONAL, 3, 9, ticks);
    expect(reconciliations.finish).toHaveBeenCalledWith(PERSONAL, 3, 9);
    expect(reconciliations.undo).toHaveBeenCalledWith(PERSONAL, 3, 9);
  });

  it('answers the uniform 404 for malformed ids without loading the module', async () => {
    const { loader, services } = fakeLoader();
    const controller = new ReconciliationsController(loader);
    const empty = {} as EmptyReconciliationBodyDto;

    await expect(controller.list(PERSONAL, 'x', undefined)).rejects.toThrow(NotFoundException);
    await expect(controller.create(PERSONAL, 'x', {} as CreateReconciliationDto)).rejects.toThrow(NotFoundException);
    await expect(controller.show(PERSONAL, '3', 'x')).rejects.toThrow(NotFoundException);
    await expect(controller.update(PERSONAL, '3', '1e3', {} as UpdateReconciliationDto)).rejects.toThrow(NotFoundException);
    await expect(controller.cancel(PERSONAL, 'x', '9')).rejects.toThrow(NotFoundException);
    await expect(controller.ticks(PERSONAL, '3', 'x', {} as ReconciliationTicksDto)).rejects.toThrow(NotFoundException);
    await expect(controller.finish(PERSONAL, '3', 'x', empty)).rejects.toThrow(NotFoundException);
    await expect(controller.undo(PERSONAL, 'x', '9', empty)).rejects.toThrow(NotFoundException);
    expect(services).not.toHaveBeenCalled();
  });
});
