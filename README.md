# ward

[![Build Status](https://circleci.com/gh/darthjee/ward.svg?style=shield)](https://circleci.com/gh/darthjee/ward)

**Current Version:** [0.0.1](https://github.com/darthjee/ward/releases/tag/0.0.1)

**Next Release:** [0.1.0](https://github.com/darthjee/ward/compare/0.0.1...main)

![ward](https://raw.githubusercontent.com/darthjee/ward/main/ward.png)

A personal, modular web application for organising everyday life.

## About

Ward brings the small, scattered pieces of life admin into one application: one login, one UI,
one database, one deployment. Each concern is a self-contained **module**, so Ward grows one
module at a time.

| Module | Purpose | Status |
|--------|---------|--------|
| **auth** | Accounts and login: username/password, JWT cookie + rotating refresh token, device authorization, admin approval of new accounts | Implemented |
| **mail** | Transactional email (e.g. password recovery) | Implemented |
| **bank** | Bank accounts, business expenses to send to the accountant, bills to pay | Planned |
| **protocol** | Protocol numbers of requests made to companies | Planned |
| **car-performance** | Fuel consumption and cost per car | Planned |
| **links** | Links saved to check later | Planned |

More modules will follow.

The application is a NestJS backend and a React single-page frontend, served together through
the [Tent](https://github.com/darthjee/tent) caching reverse proxy. It runs on the Render free
tier (512 MB RAM), so domain modules are lazy-loaded on their first request and Tent caches
`GET` responses. See [docs/agents/product.md](docs/agents/product.md) for product decisions and
[docs/agents/architecture/modular-pattern.md](docs/agents/architecture/modular-pattern.md) for
how modules are built.

## Technology Stack

### Backend

- **Node.js / NestJS** (TypeScript, ES modules): application framework, lazy module loading
- **TypeORM**: ORM and migrations
- **MySQL 9.3**: one shared database, one table prefix per module
- **Jest + `@swc/jest` + `supertest` + `@nestjs/testing`**: test suite
- **ESLint** and **Yarn**

### Frontend

- **React 19**: UI framework
- **Vite**: build tool and dev server
- **Jasmine + c8**: tests and coverage
- **ESLint** and **Yarn**

### Infrastructure

- **Docker & Docker Compose**: containerisation and orchestration
- **[darthjee/tent](https://github.com/darthjee/tent)**: reverse proxy and cache (port 3000)
- **[darthjee/navi](https://github.com/darthjee/navi)**: cache warmer
- **Render**: backend hosting (free tier)
- **CircleCI**: tests, lint and tag-triggered releases

## Project Structure

```
ward/
├── backend/              # NestJS/TypeORM backend, one folder per module under src/
├── frontend/             # React + Vite frontend, one client and page set per module
├── proxy/                # Tent (PHP) proxy configuration and extensions
├── dockerfiles/          # Dockerfiles for each image
├── docker_volumes/       # Bind-mounted volumes (static assets, proxy cache, MySQL data)
├── navi/                 # Navi cache-warmer configuration
├── bin/, scripts/        # CI, release and deploy scripts
├── docs/agents/          # Project documentation
└── docker-compose.yml    # Full stack service definitions
```

## Development Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and
  [Docker Compose](https://docs.docker.com/compose/install/)

Every project command runs through `docker-compose`; nothing needs to be installed on the host.

### First Time Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/darthjee/ward.git
   cd ward
   ```

2. Create the `.env` file and run database migrations:
   ```bash
   make setup
   ```

3. Review and adjust the `.env` values if needed.

### Running the Application

```bash
# Start the full stack (proxy + backend + frontend dev server)
make dev-up
```

The application will be available at:

- **Full stack (proxy):** <http://localhost:3000>
- **Backend API:** <http://localhost:3030>
- **Frontend dev server:** <http://localhost:3010>

### Development Shells

```bash
# Open a backend shell
make dev

# Open a test shell
make tests
```

### Running Tests

Backend (Jest):

```bash
docker-compose run --rm ward_tests yarn coverage          # unit + e2e specs with coverage
docker-compose run --rm ward_tests yarn test:integration  # MySQL-backed integration specs
docker-compose run --rm ward_tests yarn lint
```

Frontend (Jasmine):

```bash
docker-compose run --rm ward_fe yarn coverage
docker-compose run --rm ward_fe yarn lint
```

Proxy extension (PHPUnit):

```bash
docker-compose run --rm proxy_tests
```

## Documentation

Agent-facing documentation lives under [`docs/agents/`](docs/agents/). Start at
[`docs/agents/index.md`](docs/agents/index.md). Project instructions for AI agents live in
[`AGENTS.md`](AGENTS.md).
