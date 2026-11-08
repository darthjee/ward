import { Injectable } from '@nestjs/common';
import { LazyModuleLoader, ModuleRef } from '@nestjs/core';

/**
 * Thin wrapper around Nest's built-in `LazyModuleLoader`, documenting
 * Ward's module classification (see
 * `docs/agents/architecture/modular-pattern.md`):
 *
 * | Type      | Loading                  | Examples                                          |
 * |-----------|---------------------------|---------------------------------------------------|
 * | Core      | Always resident, at boot  | Router, JWT Guard, DB Connection, CacheToken Svc  |
 * | Always-on | Always resident, at boot  | Auth Module, Mail Module                          |
 * | Lazy      | On demand, first request  | `bank` (first lazy module)                        |
 *
 * A lazy module is split in two (see `bank/` for the reference
 * implementation):
 *
 * - **Resident** (a small `<name>RoutesModule`, imported by `AppModule`):
 *   the thin controllers (Nest registers routes only at boot, so a lazily
 *   loaded module cannot declare them), the entity classes registered through
 *   a resident `TypeOrmModule.forFeature([...])` (`autoLoadEntities` only sees
 *   entities whose `forFeature` ran before the `DataSource` initialised — an
 *   entity known only to a lazy module has no metadata), and any
 *   boot-validated config.
 * - **Lazy** (the `<name>Module`, never imported by `AppModule`): every
 *   service, query and piece of business logic. The resident controllers load
 *   it on the first request by calling `loadOnFirstRequest()` with a loader
 *   function that dynamically `import()`s the module class — Nest
 *   instantiates (and thereafter caches) that module's DI graph on first hit,
 *   not at application boot. Controllers import the service classes as types
 *   only and reach them through the dynamic import, so not even their code is
 *   loaded before then.
 *
 * Example (resident helper of a lazy module):
 * ```ts
 * @Injectable()
 * class WidgetModuleLoader {
 *   constructor(private readonly lazyModuleLoader: LazyModuleLoaderService) {}
 *
 *   async service(): Promise<WidgetService> {
 *     const widget = await import('./widget.module.js');
 *     const moduleRef = await this.lazyModuleLoader.loadOnFirstRequest(() => widget.WidgetModule);
 *     return moduleRef.get(widget.WidgetService);
 *   }
 * }
 * ```
 *
 * This service is provided by `AppModule` but not exported, so a resident
 * routes module lists it in its own `providers` (it is stateless).
 */
@Injectable()
export class LazyModuleLoaderService {
  private readonly lazyModuleLoader: LazyModuleLoader;

  /**
   * @param {LazyModuleLoader} lazyModuleLoader - Nest's built-in lazy loader,
   * itself always available for injection without explicit registration.
   */
  constructor(lazyModuleLoader: LazyModuleLoader) {
    this.lazyModuleLoader = lazyModuleLoader;
  }

  /**
   * Loads (and caches, on subsequent calls) a module on demand.
   * @param {Parameters<LazyModuleLoader['load']>[0]} loaderFn - Returns (or
   * resolves to) the module class, dynamic module, or forward reference to
   * load.
   * @returns {Promise<ModuleRef>} The loaded module's DI container.
   */
  loadOnFirstRequest(
    loaderFn: Parameters<LazyModuleLoader['load']>[0],
  ): Promise<ModuleRef> {
    return this.lazyModuleLoader.load(loaderFn);
  }
}
