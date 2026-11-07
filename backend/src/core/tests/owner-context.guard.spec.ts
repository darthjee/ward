import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationMembershipLookup } from '../organization-membership-lookup.js';
import { OwnerContextGuard } from '../owner-context.guard.js';
import { ownerNotFound } from '../parse-org-id.js';

interface FakeRequest {
  user?: { sub: number; isAdmin: boolean };
  params?: Record<string, string>;
  ownerContext?: unknown;
}

function contextFor(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('expected a rejection');
}

describe('OwnerContextGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let lookup: { isMember: jest.Mock };
  let guard: OwnerContextGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    lookup = { isMember: jest.fn() };
    guard = new OwnerContextGuard(reflector as unknown as Reflector, lookup as OrganizationMembershipLookup);
  });

  describe('when the route has no owner-scoped metadata', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
    });

    it('passes without resolving an owner', async () => {
      const request: FakeRequest = { params: { orgId: 'abc' } };

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.ownerContext).toBeUndefined();
      expect(lookup.isMember).not.toHaveBeenCalled();
    });
  });

  describe('when the route is owner-scoped', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(true);
    });

    describe('on the personal prefix', () => {
      it('sets the JWT user as owner', async () => {
        const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: {} };

        await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        expect(request.ownerContext).toEqual({ kind: 'user', userId: 7 });
        expect(lookup.isMember).not.toHaveBeenCalled();
      });

      it('also works when the request has no params object', async () => {
        const request: FakeRequest = { user: { sub: 7, isAdmin: false } };

        await guard.canActivate(contextFor(request));
        expect(request.ownerContext).toEqual({ kind: 'user', userId: 7 });
      });
    });

    describe('on the organization prefix', () => {
      describe('and the user is a member', () => {
        beforeEach(() => {
          lookup.isMember.mockResolvedValue(true);
        });

        it('sets the organization as owner after checking membership', async () => {
          const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId: '3' } };

          await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
          expect(lookup.isMember).toHaveBeenCalledWith(7, 3);
          expect(request.ownerContext).toEqual({ kind: 'organization', organizationId: 3 });
        });
      });

      describe('and the user is not a member (or the organization is unknown)', () => {
        beforeEach(() => {
          lookup.isMember.mockResolvedValue(false);
        });

        it('throws the uniform 404', async () => {
          const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId: '3' } };
          const error = await rejectionOf(guard.canActivate(contextFor(request)));

          expect(error).toBeInstanceOf(NotFoundException);
          expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
          expect(request.ownerContext).toBeUndefined();
        });

        it('gives a global admin no bypass', async () => {
          const request: FakeRequest = { user: { sub: 1, isAdmin: true }, params: { orgId: '3' } };
          const error = await rejectionOf(guard.canActivate(contextFor(request)));

          expect(lookup.isMember).toHaveBeenCalledWith(1, 3);
          expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
        });
      });

      describe('and the id is malformed', () => {
        it.each(['abc', '007', '-1', '1.5', '1e3', '99999999999'])(
          'throws the uniform 404 for %p without a lookup',
          async (orgId) => {
            const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId } };
            const error = await rejectionOf(guard.canActivate(contextFor(request)));

            expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
            expect(lookup.isMember).not.toHaveBeenCalled();
          },
        );
      });
    });

    describe('when there is no authenticated user', () => {
      it('throws the uniform 404', async () => {
        const request: FakeRequest = { params: {} };
        const error = await rejectionOf(guard.canActivate(contextFor(request)));

        expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
      });
    });
  });
});
