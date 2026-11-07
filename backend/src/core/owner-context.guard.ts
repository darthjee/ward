import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { readBooleanMetadata } from './boolean-metadata.js';
import {
  ORGANIZATION_MEMBERSHIP_LOOKUP,
  type OrganizationMembershipLookup,
} from './organization-membership-lookup.js';
import type { OwnerContext } from './owner-context.js';
import { IS_OWNER_SCOPED_KEY } from './owner-scoped.decorator.js';
import { ownerNotFound, parseOrgId } from './parse-org-id.js';

/**
 * Global guard resolving the `OwnerContext` of every `@OwnerScoped()` route,
 * registered as an `APP_GUARD` after `JwtGuard` (it needs `request.user`).
 * Routes without the metadata are unaffected (no-op).
 *
 * - No `:orgId` (personal prefix): the owner is always the JWT user.
 * - `:orgId` present: it is parsed strictly (`parseOrgId()`) and the user's
 *   membership checked on every request through the
 *   `ORGANIZATION_MEMBERSHIP_LOOKUP` port (implemented by the Auth module), with
 *   no caching and no bypass for the global admin.
 *
 * Every failure (missing user, malformed/unknown id, non-member) throws the
 * same uniform 404, so organizations cannot be enumerated.
 */
@Injectable()
export class OwnerContextGuard implements CanActivate {
  private readonly reflector: Reflector;
  private readonly lookup: OrganizationMembershipLookup;

  /**
   * @param {Reflector} reflector - Reads the `@OwnerScoped()` route metadata.
   * @param {OrganizationMembershipLookup} lookup - Checks organization membership.
   */
  constructor(reflector: Reflector, @Inject(ORGANIZATION_MEMBERSHIP_LOOKUP) lookup: OrganizationMembershipLookup) {
    this.reflector = reflector;
    this.lookup = lookup;
  }

  /**
   * Resolves and stores `request.ownerContext` on owner-scoped routes.
   * @param {ExecutionContext} context - The current request's execution context.
   * @returns {Promise<boolean>} Whether the request may proceed (failures throw the uniform 404).
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!readBooleanMetadata(this.reflector, IS_OWNER_SCOPED_KEY, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    request.ownerContext = await this.#resolve(request);
    return true;
  }

  async #resolve(request: Request): Promise<OwnerContext> {
    const user = request.user;

    if (!user) {
      throw ownerNotFound();
    }

    const rawOrgId: unknown = request.params?.orgId;

    if (rawOrgId === undefined) {
      return { kind: 'user', userId: user.sub };
    }

    const organizationId = parseOrgId(rawOrgId);

    if (!(await this.lookup.isMember(user.sub, organizationId))) {
      throw ownerNotFound();
    }

    return { kind: 'organization', organizationId };
  }
}
