# Project Ward

## What Is Project Ward

Project Ward is a personal modular web application designed to consolidate multiple everyday utilities — banking management, task lists, reminders, call logging, complaints tracking — into a single backend served behind a caching reverse proxy. The project is optimized for a constrained hosting environment (Render free tier, 512MB RAM) and is built to be developed module-by-module using AI-assisted coding (Claude Code).

## Core Design Principles

1. **Modular by design**: the backend is split into isolated modules, each responsible for a specific domain. Modules are loaded on demand (lazy loading) to minimize memory usage.
2. **AI-friendly structure**: each module follows a strict, predictable file structure and contract template, so an AI agent can generate code module-by-module with consistent results.
3. **Cache-first architecture**: a reverse proxy (Tent) sits in front of the backend, caching GET responses on disk. The backend is only hit on cache misses or write operations.
4. **Cost-efficient**: the entire stack runs on a single Render free tier instance with 512MB RAM. The application sleeps when idle and is woken on demand via a custom warm-up mechanism.

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | Node.js + NestJS | LazyModuleLoader for on-demand module loading |
| ORM | TypeORM | Runs in-process, no binary subprocess (unlike Prisma) |
| Database | MySQL | Single shared database, table prefixes per module |
| Frontend | React + Vite | Built statically, served by Tent |
| Proxy / Cache | Tent (darthjee/tent) | Reverse proxy, file cache, static file serving |
| Infrastructure | Render (free tier) | 512MB RAM, sleeps when idle |
| Orchestration | Docker | Single docker-compose with backend + proxy containers |

## Architecture Overview

```
[User]
   |
   v
[Tent (Proxy + Cache)]
   |--- Serves React frontend (static files from Vite build)
   |--- Caches GET 2xx responses (keyed by X-Cache-Key header)
   |--- Proxies API requests to NestJS (no cache on writes)
   |
   v
[NestJS Backend]
   |--- Core (always resident): Router, JWT Guard, CacheToken Service
   |--- Auth Module (always-on): login, register, refresh, logout
   |--- Lazy Modules: Bank, Reminders, Tasks, Call Log, Complaints
   |
   v
[MySQL]
```

## Module System

### Module Classification

| Type | Loading | Examples |
|---|---|---|
| Core | Always resident, at boot | Router, JWT Guard, DB Connection, CacheToken Service |
| Always-on | Always resident, at boot | Auth Module |
| Lazy | On demand, on first request | Bank, Reminders, Tasks, Call Log, Complaints |

### Current Modules

| Module | Type | Prefix | Status |
|---|---|---|---|
| Auth | always-on | `auth_` | Contract documented |
| Bank | lazy | `banco_` | Planned |
| Reminders | lazy | `lembrete_` | Planned |
| Tasks | lazy | `tarefa_` | Planned |
| Call Log | lazy | `proto_` | Planned |
| Complaints | lazy | `reclam_` | Planned |

### Inter-Module Communication

A hybrid pattern is used:

- **Direct DI (synchronous)**: when Module A needs to call Module B's service directly. The target module exports its service, the source imports it. No cross-module table writes; cross-module references use logical foreign keys (store the ID, no physical FK, no JOIN).
- **Event-Driven (reactive)**: when Module A needs to react to something in Module B without coupling. Uses `@nestjs/event-emitter`. Events are fire-and-forget. If the listener module is not loaded yet (lazy), the event is lost (acceptable in this scenario).

## Authentication

### Token Strategy

| Token | Storage | Duration | Purpose |
|---|---|---|---|
| Access Token (JWT) | httpOnly Cookie | 15 min | Authentication on every request |
| Refresh Token | localStorage (frontend) | 7 days | Renew access token, rotated on each use |
| Cache Token (HMAC) | localStorage (frontend) | Per session | Cache keying in Tent (X-Cache-Key header) |

### Key Behaviors

- Access token is in an httpOnly cookie — JavaScript cannot read it, protecting against XSS.
- Refresh token is in localStorage — the frontend controls when to send it to `/auth/refresh`.
- Refresh token rotation: each use invalidates the previous token and issues a new one. Reuse detection revokes the entire session chain.
- Cache token is an HMAC-SHA256 of `userId + sessionId`. It is not an auth credential — it only allows Tent to separate cache by user without knowing who the user is. It rotates on every refresh.

## Database Strategy

- Single MySQL database shared by all modules.
- Each module uses a table prefix (e.g., `auth_`, `banco_`, `proto_`) for visual separation.
- No physical foreign keys across modules — references are logical (store the ID, resolve via service calls).
- No cross-module JOINs — each query accesses only its own module's tables.
- Migrations are per-module, following `--.ts` naming.

## Tent Proxy Configuration

### Cache Rules

| Route Pattern | Method | Cache | Notes |
|---|---|---|---|
| `/auth/*` | ALL | No | Never cache auth endpoints |
| `/api/*` | GET | Yes | Keyed by `X-Cache-Key` header (per-user) |
| `/api/*` | POST/PUT/PATCH/DELETE | No | Write operations bypass cache + cleanup stale entries |
| `/` and `/assets/*` | GET | N/A | Served as static files (React build) |

### Cache Keying

The Tent uses `HeaderAwareRequestHasher` with `X-Cache-Key` header to separate cache entries per user. The cache token is an HMAC — opaque, non-reversible, and not an authentication credential.

## Folder Structure

```
project-root/
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── core/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── banco/
│   │   │   ├── lembrete/
│   │   │   ├── tarefa/
│   │   │   ├── protocolo/
│   │   │   └── reclamacao/
│   │   ├── config/
│   │   └── database/
│   │       ├── migrations/
│   │       └── data-source.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
├── proxy/
│   ├── static/
│   └── configuration/
│       ├── configure.php
│       └── rules/
├── docker-compose.yml
├── .env
└── docs/
    ├── architecture.md
    ├── module-contract.md
    └── modules/
        └── auth.md
```

## Development Workflow

1. **Architecture and contracts are documented** in `docs/` as Markdown files.
2. **Each module has a contract** following the `module-contract.md` template — describing tables, API endpoints, events, service interfaces, business rules, security, tests, and migrations.
3. **Claude Code** reads the contract documents and implements the module in NestJS.
4. **Modules are developed one at a time**, starting with Auth, then Bank, then others as needed.
5. **The Tent proxy and docker-compose** are configured to run everything in a single container group.

## Infrastructure Constraints

- **RAM**: 512MB (Render free tier) — this is the primary driver for lazy loading and TypeORM over Prisma.
- **Cold starts**: the app sleeps after inactivity (~30min). A custom warm-up mechanism wakes it.
- **Tent cache persistence**: when the backend is asleep, Tent continues serving cached GET responses.
- **MySQL connection pool**: configured with a low limit (e.g., `poolSize: 5`) to conserve memory.
- **Single user (initially)**: the system is designed for one user but built to support multiple users from the start (user isolation at the service level, cache keying per user).

## Key Trade-offs

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Backend framework | NestJS | Rails, Django | Native LazyModuleLoader + lower memory footprint |
| ORM | TypeORM | Prisma | No binary subprocess, lower memory |
| Access token storage | httpOnly cookie | Authorization header | XSS protection |
| Refresh token storage | localStorage | httpOnly cookie | Frontend control, explicit refresh |
| Cache keying | HMAC token in header | X-User-Id plaintext | Privacy — no user ID in headers |
| Module communication | Hybrid (DI + events) | Microservices | Memory constraints — no multi-process |
| Database | Single DB, prefixed tables | Separate schemas | Simpler connection pool, less memory |
| Cross-module FKs | Logical only | Physical FKs | Module decoupling |