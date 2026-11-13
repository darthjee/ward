import 'reflect-metadata';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { CacheInvalidation } from '../cache-invalidation.decorator.js';
import { CACHE_INVALIDATE_HEADER, CacheInvalidationInterceptor } from '../cache-invalidation.interceptor.js';
import type { OwnerContext } from '../owner-context.js';

class BankController {}
Reflect.defineMetadata(PATH_METADATA, ['bank', 'orgs/:orgId/bank'], BankController);

class SlashedController {}
Reflect.defineMetadata(PATH_METADATA, '/things/', SlashedController);

class BareController {}

interface FakeResponse {
  set: jest.Mock;
  headersSent: boolean;
}

interface FakeRequest {
  method: string;
  ownerContext?: OwnerContext;
  params?: Record<string, string>;
}

function contextFor(request: FakeRequest, response: FakeResponse, controller: object = BankController): ExecutionContext {
  return {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

const succeeding: CallHandler = { handle: () => of({ ok: true }) };

describe('CacheInvalidationInterceptor', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let interceptor: CacheInvalidationInterceptor;
  let response: FakeResponse;

  const declare = (declaration: CacheInvalidation | undefined): void => {
    reflector.getAllAndOverride.mockReturnValue(declaration);
  };

  const run = (request: FakeRequest, controller?: object, next: CallHandler = succeeding): Promise<unknown> =>
    lastValueFrom(interceptor.intercept(contextFor(request, response, controller), next));

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    interceptor = new CacheInvalidationInterceptor(reflector as unknown as Reflector);
    response = { set: jest.fn(), headersSent: false };
  });

  describe('with the owner declaration', () => {
    beforeEach(() => declare({ kind: 'owner' }));

    it('emits the personal prefix for a user owner', async () => {
      await run({ method: 'POST', ownerContext: { kind: 'user', userId: 7 } });
      expect(response.set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/bank');
    });

    it('emits the organization prefix for an organization owner', async () => {
      await run({ method: 'PATCH', ownerContext: { kind: 'organization', organizationId: 3 } });
      expect(response.set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/orgs/3/bank');
    });

    it('strips slashes around a plain-string controller path', async () => {
      await run({ method: 'DELETE', ownerContext: { kind: 'user', userId: 7 } }, SlashedController);
      expect(response.set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/things');
    });

    it('emits nothing without an owner context', async () => {
      await run({ method: 'POST' });
      expect(response.set).not.toHaveBeenCalled();
    });

    it('emits nothing when the controller has no path', async () => {
      await run({ method: 'POST', ownerContext: { kind: 'user', userId: 7 } }, BareController);
      expect(response.set).not.toHaveBeenCalled();
    });

    it.each(['GET', 'HEAD', 'get'])('passes %s through without a header', async (method) => {
      await run({ method, ownerContext: { kind: 'user', userId: 7 } });
      expect(response.set).not.toHaveBeenCalled();
      expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
    });

    it('returns the handler response unchanged', async () => {
      expect(await run({ method: 'POST', ownerContext: { kind: 'user', userId: 7 } })).toEqual({ ok: true });
    });

    it('never sets the header when the handler throws', async () => {
      const failing: CallHandler = { handle: () => throwError(() => new Error('boom')) };

      await expect(run({ method: 'POST', ownerContext: { kind: 'user', userId: 7 } }, undefined, failing)).rejects.toThrow(
        'boom',
      );
      expect(response.set).not.toHaveBeenCalled();
    });

    it('skips the header when headers were already sent', async () => {
      response.headersSent = true;
      await run({ method: 'POST', ownerContext: { kind: 'user', userId: 7 } });
      expect(response.set).not.toHaveBeenCalled();
    });
  });

  describe('with explicit paths', () => {
    it('emits the built paths joined by a comma', async () => {
      declare({ kind: 'paths', build: (req) => ['/orgs.json', `/orgs/${req.params.orgId}.json`] });
      await run({ method: 'PATCH', params: { orgId: '3' } });
      expect(response.set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/orgs.json, /orgs/3.json');
    });

    it.each([
      'orgs.json',
      '/',
      '/orgs.json?x=1',
      '/orgs.json#frag',
      '/orgs/../bank',
      '/orgs/./bank',
      '/orgs//bank',
      '/orgs%2F3',
      '/orgs\\3',
      'http://evil/x',
      '/a/http://x',
      '/orgs\0',
    ])('drops the unsafe path %p', async (unsafe) => {
      declare({ kind: 'paths', build: () => [unsafe, '/orgs.json'] });
      await run({ method: 'POST' });
      expect(response.set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/orgs.json');
    });

    it('emits nothing when every path is unsafe', async () => {
      declare({ kind: 'paths', build: () => ['/'] });
      await run({ method: 'POST' });
      expect(response.set).not.toHaveBeenCalled();
    });
  });

  describe('without invalidation', () => {
    it.each([undefined, { kind: 'none' } as const])('emits nothing for %p', async (declaration) => {
      declare(declaration);
      await run({ method: 'POST', ownerContext: { kind: 'user', userId: 7 } });
      expect(response.set).not.toHaveBeenCalled();
    });
  });
});
