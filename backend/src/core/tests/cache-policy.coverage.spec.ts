import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Body, Get, Post } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum.js';
import { CacheClass } from '../cache-class.js';
import { CACHE_CLASS_KEY, CachePolicy } from '../cache-policy.decorator.js';
import { IS_OWNER_SCOPED_KEY, OwnerScopedController } from '../owner-scoped.decorator.js';
import { StrictBody } from '../strict-validation.pipe.js';

// Enforces `docs/agents/architecture/caching.md`: every route must declare a cache class via
// `@CachePolicy()`, because under Tent's opt-out default an undeclared `*.json` route would be
// silently shared-cached. Only static decorator metadata is read — no app bootstrap, no DB.
// It also keeps owner-scoped routes from ever being `public`, and keeps owner-scoped and
// organization handlers on `@StrictBody()` (a plain `@Body()` would silently strip owner fields
// instead of answering 400).

const SRC_ROOT = resolve(__dirname, '..', '..');
const KNOWN_CONTROLLERS = ['AdminController', 'AuthController', 'AuthorizationRequestController', 'HealthController'];

type ClassConstructor = new (...args: never[]) => unknown;

// Controllers that are not owner-scoped but must still take bodies only through `@StrictBody()`.
const STRICT_BODY_CONTROLLERS = ['OrganizationController'];

interface RouteEntry {
  controller: string;
  method: string;
  cacheClass: unknown;
  ownerScoped: boolean;
  usesPlainBody: boolean;
}

function findControllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === 'tests' ? [] : findControllerFiles(path);
    }

    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

function isController(value: unknown): value is ClassConstructor {
  return typeof value === 'function' && Reflect.getMetadata(PATH_METADATA, value) !== undefined;
}

function metadataOf(key: string, handler: object, controller: ClassConstructor): unknown {
  return Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller);
}

function usesPlainBody(controller: ClassConstructor, method: string): boolean {
  const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {}) as Record<string, unknown>;

  return Object.keys(args).some((key) => key.split(':')[0] === String(RouteParamtypes.BODY));
}

function routesOf(controller: ClassConstructor): RouteEntry[] {
  const prototype = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor' && typeof prototype[name] === 'function')
    .filter((name) => Reflect.getMetadata(METHOD_METADATA, prototype[name] as object) !== undefined)
    .map((name) => ({
      controller: controller.name,
      method: name,
      cacheClass: metadataOf(CACHE_CLASS_KEY, prototype[name] as object, controller),
      ownerScoped: metadataOf(IS_OWNER_SCOPED_KEY, prototype[name] as object, controller) === true,
      usesPlainBody: usesPlainBody(controller, name),
    }));
}

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

async function discoverControllers(): Promise<ClassConstructor[]> {
  const modules = await Promise.all(
    findControllerFiles(SRC_ROOT).map((file) => import(file) as Promise<Record<string, unknown>>),
  );

  return modules.flatMap((exported) => Object.values(exported).filter(isController));
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
