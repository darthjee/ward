# Architecture

## Overview

Modular web application with a Node.js + NestJS backend and a React + Vite frontend. The backend is divided into modules loaded on demand (lazy loading) to optimize memory usage in a constrained environment. A reverse proxy (Tent) acts as the single entry point, serving the static frontend, caching API responses, and routing requests to the backend.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + NestJS |
| ORM | TypeORM |
| Database | MySQL (single, shared) |
| Frontend | React + Vite |
| Proxy / Cache | Tent (darthjee/tent) |
| Infrastructure | Render (free tier, 512MB RAM) |
| Orchestration | Docker |

## Folder Structure

```
project-root/
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── core/                  # Always resident
│   │   │   ├── jwt.guard.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── cache-token.service.ts
│   │   │   └── core.module.ts
│   │   ├── modules/
│   │   │   ├── auth/              # Always-on
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── dto/
│   │   │   │   ├── entities/
│   │   │   │   └── events/
│   │   │   ├── banco/             # Lazy
│   │   │   ├── lembrete/          # Lazy
│   │   │   ├── tarefa/            # Lazy
│   │   │   ├── protocolo/         # Lazy
│   │   │   └── reclamacao/        # Lazy
│   │   ├── config/
│   │   └── database/
│   │       ├── migrations/
│   │       └── data-source.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/                      # React + Vite (discussed later)
├── proxy/
│   ├── static/                    # Frontend build served by Tent
│   └── configuration/
│       ├── configure.php
│       └── rules/
│           ├── backend.php
│           └── frontend.php
├── docker-compose.yml
├── .env
└── docs/
    ├── architecture.md
    ├── module-contract.md
    └── modules/
        ├── auth.md
        └── banco.md
```

## Application Layers

```
[User]
   ↓
[Tent (Proxy + Cache)]  ← Static frontend (React build) + GET response caching
   ↓
[NestJS Backend]
   ├── Core (always resident)
   │   ├── Router (routes to modules)
   │   ├── JWT Guard (verifies access token from cookie)
   │   └── CacheToken Service (generates HMAC for cache keying)
   ├── Auth Module (always-on)
   │   ├── Login / Register / Refresh / Logout
   │   └── Refresh Token Rotation
   └── Lazy Modules (loaded on demand)
       ├── Bank
       ├── Reminders
       ├── Tasks
       ├── Call Log
       └── Complaints
   ↓
[MySQL]
```

## Module Pattern

### Classification

| Type | Loading | Description |
|---|---|---|
| **Core** | Always resident, at boot | Router, JWT Guard, DB Connection, CacheToken Service |
| **Always-on** | Always resident, at boot | Auth Module (needed in every session) |
| **Lazy** | On demand, on first request | Bank, Reminders, Tasks, Call Log, Complaints |

### Lazy Loading via LazyModuleLoader

NestJS provides the `LazyModuleLoader` class natively. A lazy module is only instantiated when the first request targeting it reaches the router. After loading, the module stays resident in memory for subsequent requests.

Flow:

1. Request arrives at the Core Router
2. JWT Guard verifies the access token in the httpOnly cookie
3. Router identifies the module responsible for the route
4. If the module has not been loaded yet, `LazyModuleLoader` loads it
5. Request is delegated to the module's controller
6. Response returns through Tent (which may cache it if it's a GET 2xx)

### Standard Module Structure

Each module follows the same file structure:

```
modules//
├── .module.ts        # Module definition (imports, providers, exports)
├── .controller.ts    # Module routes
├── .service.ts       # Business logic
├── dto/                    # Data Transfer Objects (request/response)
├── entities/               # TypeORM entities
├── events/                 # Event handlers (@OnEvent) and event payloads
└── tests/                  # Unit and e2e tests for the module
```

## Inter-Module Communication

### Hybrid Pattern

Communication between modules follows a hybrid pattern with two mechanisms:

#### 1. Direct DI (Synchronous)

Used when a module needs to directly call a functionality from another. The target module **exports** its service and the source module **imports** the module that contains it.

```typescript
// The Complaints module needs data from the Call Log module
@Module({
  imports: [ProtocoloModule],  // imports the module
  // ...
})
export class ReclamacaoModule {}
```

Rules:
- A module **never writes to another module's table**
- A module can **read** data from another via the exported service
- Cross-module references use **logical foreign keys** (store the ID, but do not JOIN directly)
- The exported service should have a narrow interface (only the methods other modules need)

#### 2. Event-Driven (Reactive)

Used when a module needs to react to something that happened in another, without direct coupling. Via `@nestjs/event-emitter`.

```typescript
// Bank module emits an event
this.eventEmitter.emit('transaction.created', new TransactionEvent(payload));

// Reminders module listens (if loaded)
@OnEvent('transaction.created')
handleTransactionCreated(payload: TransactionEvent) {
  // create automatic reminder
}
```

Rules:
- Events are **fire-and-forget** — the emitter does not know if anyone is listening
- If the listener module has not been loaded yet (lazy), the event is lost (acceptable in this scenario)
- Event names follow the pattern `.` (e.g., `transaction.created`, `call.logged`)
- Event payloads are typed objects defined in the emitting module

### When to Use Each Pattern

| Scenario | Pattern |
|---|---|
| Module A needs to read data from Module B | Direct DI |
| Module A needs to trigger an action in Module B | Event-Driven |
| Module A needs a synchronous response from Module B | Direct DI |
| Module A reacts to an event from Module B | Event-Driven |

## Database

### Strategy

Single MySQL database, shared across all modules. Each module owns its tables with a distinct prefix for visual separation.

### Naming Convention

| Module | Prefix | Tables (example) |
|---|---|---|
| Auth | `auth_` | `auth_users`, `auth_refresh_tokens`, `auth_sessions` |
| Bank | `banco_` | `banco_contas`, `banco_transacoes`, `banco_categorias` |
| Reminders | `lembrete_` | `lembrete_itens`, `lembrete_recorrencias` |
| Tasks | `tarefa_` | `tarefa_listas`, `tarefa_itens` |
| Call Log | `proto_` | `proto_ligacoes`, `proto_contatos` |
| Complaints | `reclam_` | `reclam_itens`, `reclam_historico` |

### Cross-Module Relationships

- **Logical foreign keys, not physical**: a module may store the ID of another module's entity (e.g., `reclam_itens.proto_ligacao_id`), but does not create a physical FK in MySQL
- **No cross-module JOINs**: each query only accesses its own module's tables
- **Read via service**: when Module A needs details of Module B's entity, it calls B's service via DI
- **Write isolation**: a module never performs INSERT/UPDATE/DELETE on another module's tables

### Migrations

Each module maintains its own migrations inside `src/database/migrations/`. Migrations follow the naming convention: `--.ts` (e.g., `20260823-auth-create-users.ts`).

## Authentication

### Overview

Stateless JWT authentication with refresh token rotation. The access token is delivered via httpOnly cookie and the refresh token via response body. An additional token (cache_token) is generated for cache keying in Tent.

### Tokens

| Token | Storage | Duration | Purpose |
|---|---|---|---|
| Access Token (JWT) | httpOnly Cookie | 15 min | Authentication on every request |
| Refresh Token | localStorage (frontend) | 7 days | Renew access token |
| Cache Token (HMAC) | localStorage (frontend) | Per session | Cache keying in Tent |

### Access Token (httpOnly Cookie)

Cookie properties:
- `httpOnly: true` — JavaScript cannot read
- `secure: true` — only sent over HTTPS
- `sameSite: 'Lax'` — allows cross-origin navigation, blocks cross-site CSRF
- `maxAge: 15 minutes`
- Automatically sent by the browser on every request

NestJS reads the access token from the cookie (not from the `Authorization` header) in the JWT Guard.

### Refresh Token (localStorage)

- Returned in the login and refresh response body
- Frontend stores it in `localStorage`
- Explicitly sent in the body of `POST /auth/refresh`
- **Rotation**: on each use, the previous refresh token is invalidated and a new one is issued
- The server stores a hash of the current refresh token in the database (`auth_refresh_tokens`), associated with the user and session
- If an already-used refresh token is presented again, the server detects reuse and invalidates the entire token chain for that user

### Cache Token (HMAC)

Opaque token generated to allow Tent to separate cache by user without knowing the user's identity.

Generation:
```
cache_token = HMAC-SHA256(SECRET_KEY, userId + sessionId)
```

- **Not reversible** — even if captured, does not reveal the userId
- **Deterministic** — same user + same session = same token
- **Rotates with the refresh token** — on each `/auth/refresh`, a new `sessionId` is generated, producing a new `cache_token`
- Frontend sends it as the `X-Cache-Key` header on every request
- Tent uses this header as part of the cache key via `HeaderAwareRequestHasher`
- **Not an authentication token** — grants no access; real authentication is the JWT in the cookie

### Login Flow

```
1. POST /auth/login { email, password }
   → Backend validates credentials
   → Backend generates:
     - access_token (JWT, 15min) → Set-Cookie httpOnly
     - refresh_token (7 days) → response body
     - cache_token (HMAC) → response body
   → Response: { refresh_token, cache_token } + Set-Cookie: access_token

2. Frontend stores:
   - refresh_token → localStorage
   - cache_token → localStorage

3. Subsequent requests:
   → Browser sends httpOnly cookie automatically
   → Frontend sends header X-Cache-Key: 
   → Tent uses X-Cache-Key for cache keying
   → NestJS reads JWT from cookie for authentication
```

### Refresh Flow

```
1. POST /auth/refresh { refresh_token }
   → Backend validates refresh_token against the database
   → Backend invalidates the current refresh_token (rotation)
   → Backend generates a new session:
     - new access_token → Set-Cookie
     - new refresh_token → response body
     - new cache_token (new sessionId) → response body
   → Response: { refresh_token, cache_token } + Set-Cookie

2. Frontend updates localStorage with the new tokens
```

### Logout Flow

```
1. POST /auth/logout
   → Backend invalidates the session in the database
   → Backend clears the httpOnly cookie (Set-Cookie with maxAge=0)
   → Frontend removes refresh_token and cache_token from localStorage
```

### Separation of Responsibilities in Auth

| Responsibility | Where | Why |
|---|---|---|
| Verify JWT on every request | Core (JWT Guard) | Every request must pass through here; must be stateless and fast |
| Login / Register / Refresh / Logout | Auth Module (always-on) | Identity management operations; loaded at boot |
| Generate cache_token | Auth Module | Only on login/refresh |
| Validate cache_token | Nobody (no validation needed) | Tent uses it as an opaque string for cache keying |

## Proxy and Cache (Tent)

### Overview

Tent is the single entry point. It:
1. Serves the React frontend (built by Vite) statically
2. Proxies API requests to NestJS
3. Caches GET 2xx responses on disk
4. Separates cache by user via `X-Cache-Key` header

### Rule Configuration

#### Static Frontend (Production)

Serves Vite build files from `/var/www/html/static/`.

#### API — GET (with cache, keyed by user)

```php
Configuration::buildRule([
    'handler' => [
        'type'           => 'default_proxy',
        'host'           => 'http://backend:3000',
        'cache'          => './cache/api',
        'request_hasher' => [
            'class'      => 'Tent\\Cache\\HeaderAwareRequestHasher',
            'headerName' => 'X-Cache-Key'
        ]
    ],
    'matchers' => [
        ['method' => 'GET', 'uri' => '/api/', 'type' => 'begins_with']
    ]
]);
```

#### API — Writes (no cache + stale cache cleanup)

```php
Configuration::buildRule([
    'handler' => [
        'type'  => 'default_proxy',
        'host'  => 'http://backend:3000',
        'cache' => false
    ],
    'matchers' => [
        ['method' => 'POST',   'uri' => '/api/', 'type' => 'begins_with'],
        ['method' => 'PUT',    'uri' => '/api/', 'type' => 'begins_with'],
        ['method' => 'PATCH',  'uri' => '/api/', 'type' => 'begins_with'],
        ['method' => 'DELETE', 'uri' => '/api/', 'type' => 'begins_with']
    ]
]);
```

> **Note**: Add `CacheCleanupMiddleware` to clean stale cache on write operations.

#### Auth — no cache, ever

```php
Configuration::buildRule([
    'handler' => [
        'type'  => 'default_proxy',
        'host'  => 'http://backend:3000',
        'cache' => false
    ],
    'matchers' => [
        ['uri' => '/auth/', 'type' => 'begins_with']
    ]
]);
```

### Headers Excluded from Cache

Tent already excludes `Set-Cookie`, `Set-Cookie2`, `WWW-Authenticate`, and `Proxy-Authenticate` from cached responses by default. This prevents one user's cookies from being served to another user on a cache hit.

### Cache Cleanup

- Tent has no built-in expiration
- On write operations (POST/PUT/PATCH/DELETE), `CacheCleanupMiddleware` deletes relevant cache directories
- For manual cleanup, delete files in the `./cache/api` directory

## Frontend

Stack: React + Vite. The build is served statically by Tent.

> Frontend structure will be discussed and documented later.

## Infrastructure

### Render Free Tier

- **RAM**: 512MB
- **Behavior**: the application is shut down after inactivity and woken up on demand
- **Warm-up**: a custom warm-up mechanism already exists
- **Tent cache**: when the application is shut down, Tent continues serving cached responses

### Memory Considerations

- Node.js/V8 consumes ~50-150MB of baseline
- TypeORM runs inside the same process (no extra subprocess)
- MySQL connection pool should be configured with a low limit (e.g., `poolSize: 5`)
- Lazy modules reduce memory footprint at startup
- The Auth Module is always-on but lightweight (does not justify the cost of lazy loading for the gain)

## Decisions and Trade-offs

| Decision | Justification | Trade-off |
|---|---|---|
| NestJS over Rails/Django | Native LazyModuleLoader + lower memory footprint | ORM less mature than ActiveRecord/Django ORM |
| TypeORM over Prisma | No binary subprocess, lower memory consumption | Inferior DX to Prisma (no generated autocomplete) |
| httpOnly cookie for access token | XSS protection | Frontend cannot read the token |
| localStorage for refresh token | Explicit control on the frontend | Vulnerable to XSS |
| HMAC for cache_token | Lightweight, deterministic, not reversible | Rotates on every refresh (cache lost) |
| Table prefix over separate schema | Simplifies connection pool | Less visual isolation |
| Logical FK over physical FK | Module decoupling | No referential integrity in the database |
| Direct DI + Event-Driven | Simple for sync, decoupled for reactive | Two patterns to maintain |
| Render free tier | Zero cost | 512MB RAM, cold start |

