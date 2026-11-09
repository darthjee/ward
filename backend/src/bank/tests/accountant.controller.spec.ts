import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { CacheClass } from '../../core/cache-class.js';
import { CACHE_CLASS_KEY } from '../../core/cache-policy.decorator.js';
import { AccountantController } from '../accountant.controller.js';
import type { AccountantChargesQueryDto } from '../dto/accountant-charges-query.dto.js';
import { ORGANIZATION, PERSONAL } from './account.test-support.js';
import { fakeLoader } from './bank-controllers.test-support.js';

describe('AccountantController', () => {
  it('delegates the preview with the owner and the validated query', async () => {
    const { loader, accountant } = fakeLoader();
    const query = { from: '2026-10-01', to: '2026-10-31' } as AccountantChargesQueryDto;

    await expect(new AccountantController(loader).charges(ORGANIZATION, query)).resolves.toEqual({ charges: [] });
    expect(accountant.preview).toHaveBeenCalledWith(ORGANIZATION, query);
  });

  it('delegates mark sent / unsent with the body', async () => {
    const { loader, accountant } = fakeLoader();
    const controller = new AccountantController(loader);
    const dto = { transaction_ids: [7] };

    await controller.markSent(PERSONAL, dto);
    await controller.markUnsent(PERSONAL, dto);

    expect(accountant.markSent).toHaveBeenCalledWith(PERSONAL, dto);
    expect(accountant.markUnsent).toHaveBeenCalledWith(PERSONAL, dto);
  });

  it('answers 200 on the mark routes, which are never cached', () => {
    for (const handler of [AccountantController.prototype.markSent, AccountantController.prototype.markUnsent]) {
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(HttpStatus.OK);
      expect(Reflect.getMetadata(CACHE_CLASS_KEY, handler)).toBe(CacheClass.Never);
    }
  });

  it('keeps the preview user-scoped (class level)', () => {
    expect(Reflect.getMetadata(CACHE_CLASS_KEY, AccountantController.prototype.charges)).toBeUndefined();
    expect(Reflect.getMetadata(CACHE_CLASS_KEY, AccountantController)).toBe(CacheClass.UserScoped);
  });
});
