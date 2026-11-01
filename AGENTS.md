# Project Instructions

_Last updated: 2026-11-01_

Ward is a personal, modular web application for organising everyday life. It consolidates
independent utilities into a single NestJS backend and React/Vite frontend, served together
through the Tent caching reverse proxy. Each utility is a self-contained backend module with its
own tables, routes, frontend client and pages, and modules are added one at a time.

| Module | Tier | Purpose | Status |
|--------|------|---------|--------|
| `auth` | Always-on | Accounts and login: username/password, JWT `access_token` cookie + rotating refresh token, device-authorization, admin approval | Implemented |
| `mail` | Always-on (service-only) | Transactional email | Implemented |
| `bank` | Lazy | Bank accounts, business expenses to send to the accountant, bills to pay | Planned |
| `protocol` | Lazy | Protocol numbers of requests made to companies | Planned |
| `car-performance` | Lazy | Fuel consumption and cost per car | Planned |
| `links` | Lazy | Links saved to check later | Planned |

More modules will follow. Ward runs on the Render free tier (512 MB RAM), which is why rarely used
modules are lazy-loaded and Tent caches GET responses. See [Flow](docs/agents/flow.md) for the
request/data flow and [Product Definitions](docs/agents/product.md) for product decisions.

## Stack

### Backend

- Node.js, ECMAScript (ES) Modules, TypeScript (strict), NestJS
- TypeORM (Object-Relational Mapping — ORM — library, with CLI migrations)
- MySQL 9.3
- Yarn (package manager)
- Jest + `@swc/jest` + `supertest` + `@nestjs/testing` (tests and coverage)
- ESLint (linting, flat config, `typescript-eslint`)

Only the Auth and Mail modules exist so far; the domain modules above are planned (see
[Product Definitions](docs/agents/product.md)). See
[Backend Architecture](docs/agents/architecture/backend.md) for the module classification
(Core/Always-on/Lazy) and inter-module communication guidelines. A new module must follow them
unless its issue or plan explicitly documents why it deviates.

### Frontend

- React 19
- Vite (build tool)
- Jasmine + c8 (tests and coverage)
- ESLint (linting)
- Yarn (package manager)

Real auth UI exists (a route-independent login/register/device-authorization modal, hash-based
routing, and a `client/` HTTP layer — see
[Frontend Architecture](docs/agents/architecture/frontend.md)); each domain module adds its own
client and pages.

### Infrastructure

- Docker + Docker Compose
- Reverse proxy via `darthjee/tent`
- Cache warmer via `darthjee/navi-hey`

## Development

```bash
# Start the full stack (proxy + backend + frontend)
make dev-up

# Open a backend shell
make dev

# Open a test shell
make tests

# Run TypeORM migrations
make setup
```

Backend runs on port `3030`, frontend dev server on `3010`, full stack proxy on `3000`.

**Always run project commands through `docker-compose`.** Never install packages or invoke
tooling (`yarn`, `npm`, `php`, etc.) directly on the host machine. The only exception is when the
user explicitly allows running a specific command on the host — either in their message in the
current conversation, or through a standing user instruction (for example a user memory entry or
a `CLAUDE.md` override). The host may not even have the required runtime installed, and
dependencies must stay reproducible inside the project's containers. Examples:

```bash
docker-compose run --rm ward_fe yarn lint
docker-compose run --rm ward_tests yarn test
```

## Conventions

- All documentation and code comments must be written in **English**, with no exceptions — even
  when the user writes in another language.
- Backend code lives in `backend/`, frontend in `frontend/`.
- Backend source lives under `backend/src/`, one folder per module (e.g. `backend/src/auth/`),
  following the standard module structure (`<name>.module.ts`, `.controller.ts`, `.service.ts`,
  `dto/`, `entities/`, `events/`, `tests/`) — see
  [Backend Architecture](docs/agents/architecture/backend.md).
  TypeORM migrations live under `backend/src/database/migrations/`.
- Frontend JS/JSX lives under `frontend/assets/js/`, specs under `frontend/specs/`.
- Max 300 lines per file, max complexity 10 (both backend and frontend, ESLint-enforced).
- Keep backend controllers thin — business logic belongs in each module's service, not the
  controller, unless a change explicitly documents why an exception is warranted.
- The backend image family (`ward`, `circleci_ward-base`, `production_ward-base`) is
  **not published to Docker Hub** — built locally / in CI only. Only the frontend/proxy
  (`vite_ward*`) images are published.
- Ward has a lightweight per-user account/login — see [Flow](docs/agents/flow.md).

## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
|------|----------|
| [Index](docs/agents/index.md) | Link-only table of contents for `docs/agents/` — fetch this first to navigate the doc set. |
| [Summary](docs/agents/summary.md) | 2-4 line abstract of each doc under `docs/agents/`, to decide whether to open the full file. |
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Flow](docs/agents/flow.md) | Request/data flow: proxy routing, login/session flow, and per-module flows. |
| [Architecture](docs/agents/architecture.md) | Hub page linking to per-area architecture pages (`proxy`, `frontend`, `infra`, `backend`) plus the cross-cutting modular-pattern page. |
| [Contributing](docs/agents/contributing.md) | Commit guidelines, PR standards, code organization, and refactoring rules. |
| [Product Definitions](docs/agents/product.md) | Product decisions for Ward and its modules. Consult before planning any issue that introduces new entities. |
| [External Tooling](docs/agents/external.md) | Hub linking full usage guides for external, project-agnostic tools (Tent, Navi, navi-hey-client). |
| [Cache Warmer](docs/agents/cache-warmer.md) | Navi setup for warming the proxy cache after release (CI and local); used by the `cache` agent. |
| [Specs](docs/agents/specs.md) | Permanent hub for feature specs: temporary, shared definitions of multi-issue features (lifecycle, conventions, active/completed list). |
| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |
| [Issues](docs/agents/issues/) | Detailed specs for open issues. |
| [Issue Enhancement](docs/agents/issue-enhancement.md) | Checklist of concerns used by `/enhance-issue` to flesh out vague issue ideas. |

### Issues (`docs/agents/issues/`)

Each file documents an issue in detail. Naming convention:

```
docs/agents/issues/<issue_id>_<issue_name>.md
```

### Plans (`docs/agents/plans/`)

Each plan is a directory named after the issue ID and topic, containing one or more related
files:

```
docs/agents/plans/<issue_id>_<topic>/<related_files>.md
```

## Specialist agents

See `.claude/agents/` for the full roster (`architect`, `backend`, `infra`, `frontend`, `proxy`,
`cache`, `security`, `data-access`, `product-owner`).

## Boundaries

- Never install packages or invoke any package manager or language runtime (e.g. `yarn`, `npm`,
  `php`) directly on the host machine — always run it through `docker-compose`. The only exception
  is a specific command the user has explicitly allowed on the host, either in their message in the
  current conversation or through a standing user instruction (for example a user memory entry).
- Keep backend controllers thin — business logic belongs in each module's service, not the
  controller, unless a change explicitly documents why an exception is warranted.
