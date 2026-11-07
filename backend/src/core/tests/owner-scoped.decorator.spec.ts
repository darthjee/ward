import 'reflect-metadata';
import { Get } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { CacheClass } from '../cache-class.js';
import { CACHE_CLASS_KEY } from '../cache-policy.decorator.js';
import { IS_OWNER_SCOPED_KEY, OwnerScoped, OwnerScopedController } from '../owner-scoped.decorator.js';

@OwnerScopedController('things')
class ThingsController {
  @Get('list.json')
  list(): string[] {
    return [];
  }
}

class PlainController {
  @OwnerScoped()
  handler(): void {}
}

describe('OwnerScopedController', () => {
  it('mounts the controller under the personal and the organization prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ThingsController)).toEqual(['things', 'orgs/:orgId/things']);
  });

  it('marks the controller owner-scoped', () => {
    expect(Reflect.getMetadata(IS_OWNER_SCOPED_KEY, ThingsController)).toBe(true);
  });

  it('declares the user-scoped cache class', () => {
    expect(Reflect.getMetadata(CACHE_CLASS_KEY, ThingsController)).toBe(CacheClass.UserScoped);
  });
});

describe('OwnerScoped', () => {
  it('sets the owner-scoped flag on a handler', () => {
    expect(Reflect.getMetadata(IS_OWNER_SCOPED_KEY, PlainController.prototype.handler)).toBe(true);
  });
});
