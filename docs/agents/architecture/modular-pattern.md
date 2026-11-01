# Architecture — Modular Pattern

Cross-cutting rules every backend module — Auth and Mail today, and every domain module
(`bank`, `protocol`, `car-performance`, `links`, …) — must follow. See `docs/agents/architecture/backend.md` for the stack/layout this pattern lives inside, and
`docs/agents/modules/auth.md` for a concrete example.

## Module classification

| Type | Loading | Examples |
|---|---|---|
| Core | Always resident, at boot | `src/core/` — JWT Guard, DB connection, CacheToken Service, `LazyModuleLoader` wrapper |
| Always-on | Always resident, at boot | Auth module, Mail module — imported directly into `AppModule` |
| Lazy | On demand, first request | Domain modules: `bank`, `protocol`, `car-performance`, `links` (planned — none implemented yet) |

A **lazy** module is *not* imported into `AppModule` directly. Instead, its controller's first
route handler calls `LazyModuleLoaderService#loadOnFirstRequest()`
(`src/core/lazy-module-loader.service.ts`) with a loader function that dynamically `import()`s
the module class:

```ts
@Controller('widgets')
class WidgetController {
  constructor(private readonly lazyModuleLoader: LazyModuleLoaderService) {}

  @Get('widgets.json')
  async list() {
    const moduleRef = await this.lazyModuleLoader.loadOnFirstRequest(
      () => import('../widget/widget.module.js').then((m) => m.WidgetModule),
    );
    return moduleRef.get(WidgetService).list();
  }
}
```

Nest instantiates (and thereafter caches) that module's DI graph on first hit, not at
application boot — this is what actually reduces startup footprint for modules nobody has
touched yet — the main lever for staying inside the Render free tier's 512 MB (see
`docs/agents/architecture.md`'s "Hosting constraints").

Make a module **always-on** only when at least one of these holds:

- it is needed on almost every request (Auth);
- other always-on modules depend on it (Mail);
- it must validate its config at boot, so a bad config fails startup.

Otherwise — which is the default for Ward's domain modules — make it **lazy**. Record the choice
in the module's page under `docs/agents/modules/`.

### Planned modules

| Module | Tier | Table prefix | Purpose |
|---|---|---|---|
| `auth` | Always-on | `auth_` | Accounts, login, sessions, device authorization, user approval |
| `mail` | Always-on (service-only) | — (no tables) | Transactional email |
| `bank` | Lazy | `bank_` | Bank accounts, business expenses for the accountant, bills to pay |
| `protocol` | Lazy | `protocol_` | Protocol numbers of requests made to companies |
| `car-performance` | Lazy | `car_performance_` | Fuel consumption and cost per car |
| `links` | Lazy | `links_` | Links saved to check later |

The backend folder uses the module name (`src/car-performance/`); table prefixes use its
snake_case form.

## Standard module structure

Every feature module (`src/<name>/`) follows the same shape:

- `<name>.module.ts` — module definition (imports, providers, exports)
- `<name>.controller.ts` — thin routes, delegating to the service; every route path ends in
  `.json` (see `architecture/backend.md`'s "Routing convention")
- `<name>.service.ts` — business logic; constructor-injected repositories/services only
- `dto/` — request/response DTOs, annotated with `class-validator` decorators
- `entities/` — TypeORM entities, table names prefixed with the module name (e.g. `auth_users`)
- `events/` — `@OnEvent` handlers and event payload classes
- `tests/` — Jest unit (`*.spec.ts`) and e2e (`*.e2e-spec.ts`) specs for the module

## Inter-module communication (hybrid pattern)

- **Direct DI (synchronous):** a module exports its service (`AuthModule` exports `AuthService`);
  a consuming module imports the module and injects the exported service. A module never writes
  to another module's tables — reads happen only through the exported service, never a direct
  repository/query against another module's entities.
- **Event-driven (reactive):** via `@nestjs/event-emitter`'s `EventEmitter2`, fire-and-forget.
  Event names follow `<entity>.<action>` (e.g. `user.registered`, fired by `AuthService` on
  successful registration). A module fires events without knowing or caring whether anything
  listens; `EventEmitterModule.forRoot()` is registered once, globally, in `AppModule`.

Use direct DI when the consumer needs an answer synchronously (e.g. "does this user exist");
use an event when the producer just needs to announce something happened and doesn't need (or
want to block on) any reaction.

| Scenario | Pattern |
|---|---|
| Module A needs to read data owned by module B | Direct DI |
| Module A needs a synchronous answer from module B | Direct DI |
| Module A announces something; others may react | Event |
| Module A reacts to something that happened in module B | Event (`@OnEvent` listener) |

Event rules:

- Payload classes and listeners live in the module's `events/` folder; payloads are typed
  classes defined by the emitting module.
- Listeners are best-effort: they catch and log their own errors and never rethrow into the
  request that emitted the event.
- **Lazy listeners can miss events.** A listener in a lazy module that has not been loaded yet
  is not registered, so the event is lost. Never rely on an event for correctness when the
  listener lives in a lazy module — use direct DI (which loads the target) or make the reaction
  recoverable.

### Dependency inversion across the Core boundary

`src/core/` never imports a feature module. When Core needs data a feature module owns, Core
defines a token and an interface (and its own return shape), the feature module provides the
implementation and exports the token, and Core injects the token. Example: `SESSION_LOOKUP`
(`src/core/session-lookup.ts`), implemented by Auth's `SessionService` and injected by the
global `JwtGuard`.

## Database strategy

- Single MySQL database, shared across modules.
- Each module owns its tables under a distinct prefix (see "Planned modules" above). A module
  never inserts, updates, deletes or queries another module's tables.
- Cross-module references use **logical foreign keys** only: store the referenced ID (e.g.
  `RefreshToken.userId`), with no physical FK constraint and no cross-module SQL JOIN. Fetching
  the referenced row, if ever needed, goes through the owning module's exported service (direct
  DI), not a query against its table.
- Migrations live in `src/database/migrations/`, named `<timestamp>-<module>-<action>.ts`, run
  via `yarn migration:run`/`yarn migration:revert` (TypeORM CLI, `-d src/database/data-source.ts`).

## Dependency injection only

Classes never read env vars or import global state directly — see
`docs/agents/contributing.md`'s DI rule and `architecture/backend.md`'s one documented
exception (`src/database/data-source.ts`, consumed standalone by the TypeORM CLI).

## What a module page must contain

Each module has a page at `docs/agents/modules/<name>.md` (sub-features or variants go in
`docs/agents/modules/<name>/<topic>.md`). It must cover:

1. **Overview** — purpose, tier (always-on/lazy) and why, dependencies on other modules.
2. **Data** — owned tables (with prefix), columns, entities, indexes, logical FKs to other
   modules.
3. **Routes** — a link to `docs/agents/backend/routes/<name>.md` (the routes page owns
   request/response/status details; the module page does not repeat them).
4. **Events** — events emitted (name, payload, when) and events consumed (and what happens).
5. **Exported services** — the public interface other modules may inject.
6. **Business rules** — validation, state transitions, access control (who may read/edit
   what), constraints.
7. **Config** — env vars (also listed in `docs/agents/environment-variables.md`).
8. **Security** — data sensitivity, guards (`@Public()`/`@AdminOnly()`), rate limiting.
9. **Deviations** — any rule from this page the module breaks, with the reason.

## Adding a new module

1. **Pick the tier** (lazy by default; see "Module classification") and record it in the
   module page.
2. **Create `backend/src/<name>/`** with `<name>.module.ts`, `.controller.ts`, `.service.ts`,
   `dto/`, `entities/`, `events/` and `tests/`. Split services early to stay under the
   300-line / complexity-10 limits.
3. **Wire it.** Always-on: add it to `AppModule.imports`. Lazy: leave it out of `AppModule` and
   load it from the controller through `LazyModuleLoaderService#loadOnFirstRequest()`.
4. **Entities and migrations.** Prefix table names, register entities with
   `TypeOrmModule.forFeature`, add `<timestamp>-<name>-<action>.ts` migrations, use logical FKs
   only, and add the tables to "Owned tables" in `architecture/backend.md`.
5. **Public surface.** Export only what other modules need; emit `<entity>.<action>` events for
   side effects others may react to; use a Core-owned token if Core needs the module's data.
6. **Config.** Build a frozen config object in a `useFactory` provider from `ConfigService`,
   fail at boot when invalid, and document new `WARD_*` env vars.
7. **Routes.** Every path ends in `.json`, controllers stay thin, `@Public()`/`@AdminOnly()`
   where they apply, and every route declares `@CachePolicy(...)` (see
   `architecture/caching.md`). Update `navi/` when a route is cacheable.
8. **Tests.** Unit specs with `jest.fn()` doubles, e2e specs with overridden repository tokens.
9. **Frontend.** `client/<Name>Client.js`, pages under `components/resources/<area>/pages/`,
   and mirrored specs under `frontend/specs/`.
10. **Docs.** Module page (contract above), routes page + its entry in `backend/routes.md`, and
    updates to `architecture/backend.md`, this page's "Planned modules" table,
    `environment-variables.md`, `index.md` and `summary.md`.
