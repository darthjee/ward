import { Body, Controller, Get, Post } from '@nestjs/common';
import type { Request } from 'express';
import { CacheClass } from '../cache-class.js';
import { type CacheInvalidation, NoCacheInvalidation } from '../cache-invalidation.decorator.js';
import { CachePolicy } from '../cache-policy.decorator.js';
import { OwnerScopedController } from '../owner-scoped.decorator.js';
import { StrictBody } from '../strict-validation.pipe.js';
import {
  discoverControllers,
  KNOWN_CONTROLLERS,
  READ_METHODS,
  routesOf,
  type ClassConstructor,
  type RouteEntry,
} from './support/route-discovery.js';

// Enforces `docs/agents/architecture/caching.md`: every route must declare a cache class via
// `@CachePolicy()`, because under Tent's opt-in rule (`require_cache_header`) an undeclared
// `*.json` route is silently *not* cached and gets no browser `Cache-Control` either. Only static
// decorator metadata is read — no app bootstrap, no DB.
// It also keeps owner-scoped routes from ever being `public`, and keeps owner-scoped and
// organization handlers on `@StrictBody()` (a plain `@Body()` would silently strip owner fields
// instead of answering 400). Every write (non-GET/HEAD) route must also declare its cache
// invalidation (owner default, explicit paths, or none); owner-scoped routes keep the owner
// default unless a handler overrides it, and no explicit declaration may emit `/` or `/orgs`.
// The owner-scoped write-role check (`@MinOrgRole`) lives in `min-org-role.coverage.spec.ts`;
// both share the route discovery in `support/route-discovery.ts`.

// Controllers that are not owner-scoped but must still take bodies only through `@StrictBody()`.
const STRICT_BODY_CONTROLLERS = ['OrganizationController'];

// Recursive clears that would wipe far more than any single write changes.
const FORBIDDEN_INVALIDATIONS = ['/', '/orgs'];

// A representative request for evaluating explicit invalidation builders statically.
const SAMPLE_REQUEST = { method: 'POST', params: { orgId: '1' } } as unknown as Request;

function publicOwnerScopedRoutes(routes: RouteEntry[]): string[] {
  return routes
    .filter((route) => route.ownerScoped && route.cacheClass === CacheClass.Public)
    .map((route) => `${route.controller}.${route.method}`);
}

function plainBodyStrictRoutes(routes: RouteEntry[]): string[] {
  return routes
    .filter((route) => route.ownerScoped || STRICT_BODY_CONTROLLERS.includes(route.controller))
    .filter((route) => route.usesPlainBody)
    .map((route) => `${route.controller}.${route.method}`);
}

function undeclaredWriteRoutes(routes: RouteEntry[]): string[] {
  return routes
    .filter((route) => !READ_METHODS.includes(route.httpMethod))
    .filter((route) => route.invalidation === undefined)
    .map((route) => `${route.controller}.${route.method}`);
}

function nonOwnerInvalidationRoutes(routes: RouteEntry[]): string[] {
  return routes
    .filter((route) => route.ownerScoped && !route.invalidationOnHandler)
    .filter((route) => route.invalidation?.kind !== 'owner')
    .map((route) => `${route.controller}.${route.method}`);
}

function forbiddenInvalidationRoutes(routes: RouteEntry[]): string[] {
  return routes
    .filter((route) => route.invalidation?.kind === 'paths')
    .filter((route) => {
      const declared = route.invalidation as Extract<CacheInvalidation, { kind: 'paths' }>;

      return declared.build(SAMPLE_REQUEST).some((path) => FORBIDDEN_INVALIDATIONS.includes(path));
    })
    .map((route) => `${route.controller}.${route.method}`);
}

// Fixtures proving the owner-scoped checks actually detect violations (never registered anywhere).
@OwnerScopedController('fixture')
class ViolatingOwnerScopedController {
  @Get('leak.json')
  @CachePolicy(CacheClass.Public)
  leak(): void {}

  @Post('loose.json')
  loose(@Body() _body: unknown): void {}

  @Post('strict.json')
  strict(@StrictBody() _body: unknown): void {}
}

@NoCacheInvalidation()
@OwnerScopedController('fixture-none')
class ViolatingOwnerInvalidationController {
  @Post('write.json')
  write(): void {}
}

@Controller('fixture-plain')
@CachePolicy(CacheClass.Never)
class UndeclaredWriteController {
  @Get('read.json')
  read(): void {}

  @Post('write.json')
  write(): void {}
}

describe('cache-class coverage', () => {
  let controllers: ClassConstructor[];
  let routes: RouteEntry[];

  beforeAll(async () => {
    controllers = await discoverControllers();
    routes = controllers.flatMap(routesOf);
  });

  it('discovers at least the known controllers (so a broken glob cannot pass vacuously)', () => {
    expect(controllers.map((controller) => controller.name)).toEqual(expect.arrayContaining(KNOWN_CONTROLLERS));
  });

  it('discovers routes on the known controllers', () => {
    expect(routes.length).toBeGreaterThanOrEqual(KNOWN_CONTROLLERS.length);
  });

  it('declares a cache class on every route (method or controller level)', () => {
    const undeclared = routes
      .filter((route) => route.cacheClass === undefined)
      .map((route) => `${route.controller}.${route.method}`);

    if (undeclared.length > 0) {
      throw new Error(
        `Routes without a cache class: ${undeclared.join(', ')}. ` +
          'Add @CachePolicy(CacheClass.X) to the route or its controller — see docs/agents/architecture/caching.md.',
      );
    }

    expect(undeclared).toEqual([]);
  });

  it('never resolves an owner-scoped route to the public cache class', () => {
    const offending = publicOwnerScopedRoutes(routes);

    if (offending.length > 0) {
      throw new Error(`Owner-scoped routes declared public: ${offending.join(', ')}.`);
    }

    expect(offending).toEqual([]);
  });

  it('never takes a plain @Body() on owner-scoped or organization handlers', () => {
    const offending = plainBodyStrictRoutes(routes);

    if (offending.length > 0) {
      throw new Error(`Handlers using @Body() instead of @StrictBody(): ${offending.join(', ')}.`);
    }

    expect(offending).toEqual([]);
  });

  it('declares cache invalidation on every write route (method or controller level)', () => {
    const undeclared = undeclaredWriteRoutes(routes);

    if (undeclared.length > 0) {
      throw new Error(
        `Write routes without a cache invalidation: ${undeclared.join(', ')}. ` +
          'Add InvalidatesOwner(), InvalidatesPaths(...) or NoCacheInvalidation() — see docs/agents/architecture/caching.md.',
      );
    }

    expect(undeclared).toEqual([]);
  });

  it('keeps the owner invalidation on owner-scoped routes unless a handler overrides it', () => {
    const offending = nonOwnerInvalidationRoutes(routes);

    if (offending.length > 0) {
      throw new Error(`Owner-scoped routes without the owner invalidation: ${offending.join(', ')}.`);
    }

    expect(offending).toEqual([]);
  });

  it('never declares an invalidation of / or /orgs', () => {
    const offending = forbiddenInvalidationRoutes(routes);

    if (offending.length > 0) {
      throw new Error(`Routes invalidating / or /orgs: ${offending.join(', ')}.`);
    }

    expect(offending).toEqual([]);
  });

  describe('the invalidation checks themselves', () => {
    it('flag an undeclared write but not a read', () => {
      expect(undeclaredWriteRoutes(routesOf(UndeclaredWriteController))).toEqual(['UndeclaredWriteController.write']);
    });

    it('flag an owner-scoped controller overriding the owner default', () => {
      expect(nonOwnerInvalidationRoutes(routesOf(ViolatingOwnerInvalidationController))).toEqual([
        'ViolatingOwnerInvalidationController.write',
      ]);
    });

    it('accept the owner default on owner-scoped routes', () => {
      expect(nonOwnerInvalidationRoutes(routesOf(ViolatingOwnerScopedController))).toEqual([]);
    });

    it('flag an explicit declaration emitting /orgs', () => {
      const entry = routesOf(UndeclaredWriteController)[1];
      const wide: RouteEntry = { ...entry, invalidation: { kind: 'paths', build: () => ['/orgs.json', '/orgs'] } };

      expect(forbiddenInvalidationRoutes([wide])).toEqual(['UndeclaredWriteController.write']);
    });
  });

  describe('the owner-scoped checks themselves', () => {
    const fixtureRoutes = routesOf(ViolatingOwnerScopedController);

    it('flag a public owner-scoped route', () => {
      expect(publicOwnerScopedRoutes(fixtureRoutes)).toEqual(['ViolatingOwnerScopedController.leak']);
    });

    it('flag a plain @Body() but not @StrictBody()', () => {
      expect(plainBodyStrictRoutes(fixtureRoutes)).toEqual(['ViolatingOwnerScopedController.loose']);
    });
  });
});
