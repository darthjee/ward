Infrastructure Reference

INFRASTRUCTURE TEMPLATE

Inspired by the darthjee/majora Project

23 de agosto de 2026

---

# Infrastructure Template — Inspired by the darthjee/majora Project

*A modular architecture for full-stack applications with automated CI/CD and cache warming*

---

## Context and Mandatory Framing

This document is an infrastructure reference based on the open-source project **darthjee/majora** (https://github.com/darthjee/majora). It serves as **INSPIRATION** and a **STARTING POINT** for structuring new projects.

**IMPORTANT:** Any project implementing this structure must:

- Choose its **OWN** programming languages (majora uses Python/Django, React/Vite, PHP, and Node.js, but your project can use any stack)
- Use the appropriate **PROJECT NAME** (replacing "[project]" placeholders throughout this document)
- Adapt Docker images, services, and configurations to your specific reality
- Evaluate which parts make sense for your use case (proxy, cache warmer, etc. are not mandatory if not needed)

The folder structure, the base+final Dockerfile pattern, the docker-compose with anchors, the Makefile for image builds, and the CircleCI pipeline are the patterns worth copying — regardless of the languages chosen.

---

## 1. Project Root Layout

The repository is organized modularly, where each component of the stack resides in its own folder at the root level. This separation ensures that backend, frontend, and infrastructure concerns do not mix, facilitating maintenance and scalability.

```text
[project_name]/
├── backend/            # Backend application (Django, Node, Go, etc.)
├── frontend/           # Frontend application (React, Vue, Vite, etc.)
├── proxy/              # Reverse proxy configuration (if applicable)
├── navi/               # Cache warmer configuration (if applicable)
├── dockerfiles/        # Docker image definitions (base + final)
├── docker_volumes/     # Persistent volumes and bind-mounts
├── bin/                # Shell utility scripts for CI
├── scripts/            # Release and deploy automation scripts
├── docs/               # Technical documentation and architecture guides
├── .circleci/          # CI/CD pipeline configuration
├── Makefile            # Build orchestration and dev commands
├── docker-compose.yml  # Full stack of service definitions
├── .env.dev.sample     # Environment variable template for development
└── version             # Semantic version control file
```

Each layer is an isolated unit. Communication between them is orchestrated exclusively by `docker-compose.yml` through internal networks and service links, ensuring the development environment mirrors production connectivity.

---

## 2. docker-compose.yml — The Service Stack

The compose file uses YAML anchors to promote **DRY (Don't Repeat Yourself)**, centralizing common volume and environment configurations.

| Service | Image / Build | Role |
| --- | --- | --- |
| [project]_mysql | `mysql:9.3.0` | Database |
| base (&base) | `[docker_user]/[project]` | Template for dev containers |
| base_build | `dockerfiles/[project]/Dockerfile` | Build job for dev image |
| base_prod (&base_prod) | `[docker_user]/production_[project]` | Template for production containers |
| base_prod_build | `dockerfiles/production_[project]/Dockerfile` | Build job for production image |
| [project]_app | `<<: *base` | Backend application dev |
| [project]_tests | `<<: *base` | Container for running tests |
| [project]_prod_app | `<<: *base_prod` | Backend application prod |
| [project]_fe | `dockerfiles/vite_[project]/Dockerfile` | Frontend dev server |
| [project]_proxy | `darthjee/tent:0.10.4` | Reverse proxy (entry point) |
| proxy_tests | `darthjee/tent-test:0.10.4` | Proxy extension tests |
| [project]_navi | `darthjee/navi-hey:1.5.1` | Cache warmer |
| markdownlint | `dockerfiles/markdownlint/Dockerfile` | Documentation linter |

### YAML Anchor Pattern

```yaml
version: '3.8'
services:
  [project]_mysql:
    image: mysql:9.3.0
    container_name: [project]_mysql
    env_file: .env
    environment:
      MYSQL_DATABASE: [project]
      MYSQL_USER: [project]
      MYSQL_PASSWORD: [project]
      MYSQL_ROOT_PASSWORD: [project]
    ports:
      - 0.0.0.0:$[PROJECT]_MYSQL_PORT:3306
    volumes:
      - ./docker_volumes/mysql_data:/var/lib/mysql

  #################### Base ####################
  base: &base
    image: [docker_user]/[project]
    volumes:
      - ./backend:/home/app/app
    links:
      - [project]_mysql:mysql
    env_file: .env

  base_build:
    <<: *base
    build:
      context: .
      dockerfile: dockerfiles/[project]/Dockerfile
    command: echo done

  base_prod: &base_prod
    image: [docker_user]/production_[project]
    links:
      - [project]_mysql:mysql
    env_file: .env.prod

  base_prod_build:
    <<: *base_prod
    build:
      context: .
      dockerfile: dockerfiles/production_[project]/Dockerfile
    command: echo done

  #################### DEV CONTAINERS ####################
  [project]_app:
    <<: *base
    container_name: [project]_app
    depends_on:
      - base_build
      - [project]_mysql
    ports:
      - 0.0.0.0:3030:8080

  [project]_fe:
    container_name: [project]_fe
    build:
      context: .
      dockerfile: dockerfiles/vite_[project]/Dockerfile
    volumes:
      - ./frontend:/home/node/app
      - ./docker_volumes/node_modules:/home/node/app/node_modules
      - ./docker_volumes/static:/home/node/app/dist
    ports:
      - 0.0.0.0:3010:8080
    env_file: .env

  [project]_proxy:
    image: darthjee/tent:0.10.4
    container_name: [project]_proxy
    env_file: .env
    volumes:
      - ./docker_volumes/static/:/var/www/html/static/
      - ./proxy/dev_configuration:/var/www/html/configuration/
      - ./docker_volumes/proxy_cache:/var/www/html/cache/
      - ./docker_volumes/photos:/var/www/html/photos
      - ./docker_volumes/files:/var/www/html/files
      - ./docker_volumes/domain:/var/www/html/domain
      - ./proxy/extension:/var/www/html/extension
    links:
      - [project]_app:backend
      - [project]_fe:frontend
    depends_on:
      - [project]_app
      - [project]_fe
    ports:
      - 0.0.0.0:3000:80

  proxy_tests:
    image: darthjee/tent-test:0.10.4
    volumes:
      - ./proxy/extension:/var/www/html/extension
      - ./proxy:/var/www/html/proxy
    command: vendor/bin/phpunit --bootstrap /var/www/html/extension/tests/bootstrap.php /var/www/html/extension/tests

  [project]_navi:
    image: darthjee/navi-hey:1.5.1
    volumes:
      - ./navi/:/home/node/app
    command: navi-hey --config navi_config.yaml
    environment:
      - [PROJECT]_PRODUCTION_URL=$[PROJECT]_PRODUCTION_URL
      - STATISTICS_SKIP_SECRET=$STATISTICS_SKIP_SECRET
      - NAVI_PORT=3000
      - NAVI_NAMEPACE=$NAVI_NAMEPACE
    ports:
      - 0.0.0.0:3100:3000

  markdownlint:
    container_name: [project]_markdownlint
    build:
      context: .
      dockerfile: dockerfiles/markdownlint/Dockerfile
    volumes:
      - .:/home/node/app
      - ./docker_volumes/markdownlint_node_modules:/home/node/app/node_modules
    command: sh -c "yarn install && yarn lint_md"
```

The compose uses two anchors: **&base** (dev) and **&base_prod** (prod). Each real container does `<<: *base` and only overrides what changes (container_name, depends_on, ports, environment). This avoids duplicating volumes/links/env_file declarations across services.

**Typical Ports:**

- **3000:** Proxy (user entry point)
- **3010:** Frontend dev server (HMR)
- **3030:** Backend direct
- **3100:** Cache warmer web UI

---

## 3. dockerfiles/ — Base and Final Images

Each service has its own folder inside `dockerfiles/`, and each folder has a final Dockerfile + a `-base` Dockerfile (the cached base image that the final one inherits from).

```text
dockerfiles/
├── [project]-base/              # Backend base image (dev)
├── [project]/                   # Backend final image (dev)
├── production_[project]-base/   # Backend base image (prod)
├── production_[project]/        # Backend final image (prod)
├── vite_[project]-base/         # Frontend base image
├── vite_[project]/              # Frontend final image
├── circleci_[project]-base/     # Base image used as CircleCI executor
└── markdownlint/               # Documentation linter image
```

The **-base** image contains heavy dependencies that change rarely (apt-get, pecl, composer install, global npm install, etc.) and is rebuilt only when dependencies change. The **final** Dockerfile is lightweight — it just copies the application code on top of the base. This speeds up CI builds.

---

## 4. Makefile — Image Build Commands

The Makefile is the single entry point for building and publishing all images.

```makefile
.PHONY: build-base push-base build push build-fe-base push-fe-base build-fe push-fe build-circleci-base push-circleci-base build-production-base push-production-base dev dev-up setup tests

PROJECT?=[project_name]
IMAGE?=$(PROJECT)
BASE_VERSION?=0.1.0
FE_IMAGE?=$(DOCKER_ID_USER)/vite_$(PROJECT)
PUSH_IMAGE=$(DOCKER_ID_USER)/$(PROJECT)
DOCKER_FILE=dockerfiles/$(PROJECT)/Dockerfile
DOCKER_FILE_FE=dockerfiles/vite_$(PROJECT)/Dockerfile

# ── Base images 
build-base:
	bin/image.sh build [project]-base

push-base:
	bin/image.sh push [project]-base

build-circleci-base:
	bin/image.sh build circleci_[project]-base

push-circleci-base:
	bin/image.sh push circleci_[project]-base

build-production-base:
	bin/image.sh build production_[project]-base

push-production-base:
	bin/image.sh push production_[project]-base

build-fe-base:
	bin/image.sh build vite_[project]-base

push-fe-base:
	bin/image.sh push vite_[project]-base

# ── Backend 
build:
	docker build -f $(DOCKER_FILE) . -t $(IMAGE) -t $(PUSH_IMAGE) -t $(PUSH_IMAGE):$(BASE_VERSION)

push:
	make build
	docker push $(PUSH_IMAGE)
	docker push $(PUSH_IMAGE):$(BASE_VERSION)

# ── Frontend 
build-fe:
	docker build -f $(DOCKER_FILE_FE) . -t $(FE_IMAGE) -t $(FE_IMAGE):$(BASE_VERSION)

push-fe:
	make build-fe
	docker push $(FE_IMAGE)
	docker push $(FE_IMAGE):$(BASE_VERSION)

# ── Environment files 
.env:
	cp .env.dev.sample .env

.env.production:
	touch .env.production
```

- **Base image targets:** each with a `build-`/`push-` pair delegating to `bin/image.sh`
- **Final image targets:** `build`/`push` for backend, `build-fe`/`push-fe` for frontend
- **Environment targets:** `.env` copies the sample, `.env.production` creates an empty file

---

## 5. .circleci/config.yml — CI Pipeline

The pipeline uses a `tags_only` filter: `/\d+\.\d+\.\d+/` to distinguish branch pushes (run tests) from release tags (run deploy + cache warming).

### 5.1 Base Image Release Jobs

Each base image is published in **TWO architectures** (amd64 + arm64) using `machine: true` + QEMU:

- `release-[project]-base`
- `release-[project]-base-arm64`
- `release-circleci_[project]-base`
- `release-circleci_[project]-base-arm64`
- `release-production_[project]-base`
- `release-production_[project]-base-arm64`
- `release-vite_[project]-base`
- `release-vite_[project]-base-arm64`

### 5.2 Test Jobs (require the bases)

| Job | Executor | Description |
| --- | --- | --- |
| Backend tests (views, models, etc.) | `circleci_[project]-base` + database image | Runs unit and integration tests |
| Frontend tests | `vite_[project]-base` | Runs frontend test suite (Jasmine/Jest/Vitest) |
| Checks (linting) backend | `circleci_[project]-base` | Runs linters (Ruff, ESLint, Prettier) |
| Frontend checks (linting) | `vite_[project]-base` | Runs ESLint on frontend |
| Proxy extension tests | `darthjee/tent-test` | Runs PHPUnit on proxy extensions + phpcs (if using proxy) |
| Documentation linter | markdownlint image | Lints markdown files |
| Coverage-final | — | Aggregates coverage after all test jobs |

### 5.3 Deploy Jobs (tags only)

| Job | Description |
| --- | --- |
| `build-and-release` | Triggers `scripts/deploy.sh` (update_deploy_branch + deploy) |
| `upload_proxy_files` | Uploads proxy config via `bin/deploy_frontend.sh upload` |
| `upload_fe_files` | Uploads frontend assets via `bin/deploy_frontend.sh upload` |
| `upload_admin_assets` | Runs `collectstatic` + upload (if using Django) |
| `copy_proxy_configuration` | Copies proxy config to server |
| `link_photos` | Creates persistent symlinks for photos |
| `link_files` | Creates persistent symlinks for files |
| `link_domain` | Creates persistent symlinks for domain config |
| `upload_extension` | Uploads proxy extensions (depends on `upload_proxy_files`) |
| `release` | Aggregator job — requires all above + all base images |
| `warm-up-cache` | Requires `release`; runs `scripts/warm_navi_cache.sh` (if using cache warmer) |
| `wake-navi` | Non-blocking, runs early to wake the cache warmer server (if using cache warmer) |

**Important pattern:** Test jobs use the CircleCI base image as executor, not docker-compose. The base images are pre-built and CI just runs commands inside them — no rebuilding needed.

---

## 6. navi/ — Cache Warmer Configuration (if applicable)

> **NOTE:** This section only applies if your project uses a cache warmer like darthjee/navi. If it doesn't make sense for your project, you can remove this entire folder.

```text
navi/
├── navi_config.yaml     # entry point: web, workers, failure sections + include: list
└── resources/
    ├── clients.yml      # clients.default block (base URL, timeout, headers)
    └── [entity].yml     # one file per entity/resource chain
```

**How it works:**

- `navi_config.yaml` has the `web`, `workers`, `failure` sections and an `include:` that pulls in the files from `resources/`
- Each file in `resources/` declares `namespace: $NAVI_NAMEPACE` — a placeholder resolved at runtime
- The chain is recursive: parameter-free resources are enqueued first → extract data from response → enqueue dependent resources → repeat
- **Never** include mutation endpoints (only `GET`) or restricted endpoints

**Docker Compose service:**

```yaml
[project]_navi:
  image: darthjee/navi-hey:1.5.1
  volumes:
    - ./navi/:/home/node/app
  command: navi-hey --config navi_config.yaml
  environment:
    - [PROJECT]_PRODUCTION_URL=$[PROJECT]_PRODUCTION_URL
    - NAVI_PORT=3000
    - NAVI_NAMEPACE=$NAVI_NAMEPACE
  ports:
    - 0.0.0.0:3100:3000
```

**CI integration:** The CI doesn't boot a new Navi engine per build. Instead it talks to a persistent Navi server (`$NAVI_URL`) via the `navi-hey-client` CLI:

- **`wake-navi`** — runs early, non-blocking, pings `$NAVI_URL` until it responds
- **`warm-up-cache`** — after `release`, on tags: computes namespace, pushes config files via `navi-client -a config --file ...`, then triggers warm-up

---

## 7. proxy/ — Reverse Proxy Configuration (if applicable)

> **NOTE:** This section only applies if your project uses darthjee/tent or a similar proxy. If your project uses nginx, traefik, or another proxy, adapt accordingly.

```text
proxy/
├── dev_configuration/       # rules used in dev
│   ├── configure.php        # entry point that require_once the rules
│   └── rules/               # one .php file per rule set
│       ├── backend.php       # proxy /api/ → [project]_app
│       ├── frontend.php      # serve SPA
│       ├── photos.php        # static handler /photos
│       ├── files.php
│       ├── domain.php        # static handler /domain
│       ├── uploads.php
│       ├── delete.php
│       ├── cache.php
│       ├── admin.php         # serve Django admin static
│       ├── redirects.php
│       └── private_game_data_cache.php
├── prod_configuration/      # same rules, adjusted for prod
│   ├── configure.php
│   └── rules/
├── extension/               # custom PHP classes mounted into the proxy
│   ├── lib/
│   │   ├── cache/           # custom cache hashers
│   │   ├── handlers/        # custom handlers (CacheClear, CacheSize, Upload, Delete)
│   │   └── support/         # support classes (BackendClient, ForwardedHeaderFilter)
│   └── tests/               # extension tests
└── phpcs.xml                # PHP linter ruleset
```

The proxy uses an external image (`darthjee/tent`) and the `proxy/` folder only provides **configuration** + **extensions** — it's not an application you build, it's mounted into the container via volumes.

---

## 8. How Everything Connects

```text
                    ┌┐
   User ──────────► │ [project]_proxy (reverse proxy) :3000               │
                    │  └─ reads proxy/dev_configuration/rules/            │
                    │  └─ uses proxy/extension/lib/                       │
                    │  └─ cache in docker_volumes/proxy_cache/            │
                    └──────┬──────────────────────┬────────────────────────┘
                           │ /api/                │ / (SPA)
                           ▼                      ▼
                  ┌────────────────┐      ┌────────────────────┐
                  │ [project]_app  │      │ [project]_fe       │
                  │ (backend)      │      │ (frontend dev)     │
                  │ :3030          │      │ :3010              │
                  └──────┬─────────┘      └────────┬───────────┘
                         │                          │
                         ▼                          │
                  ┌────────────────┐               │
                  │ [project]_     │               │
                  │  mysql         │               │
                  │ :3306          │               │
                  └────────────────┘               │
 │
                  ┌────────────────────────────────┘  (build output → docker_volumes/static/)
                  │
                  ▼
         ┌──────────────────────────┐    push config     ┌──────────────────────────┐
         │ [project]_navi           │ ─────────────────► │ Navi Server              │
         │ :3100 (local)            │   (via CI CLI)     │ (persistent in CI)       │
         │ reads navi/              │                    │ warms proxy cache        │
         └──────────────────────────┘                    └──────────────────────────┘
```

---

## 9. Implementation Checklist

1. **Create root folders:** `backend/`, `frontend/`, `proxy/` (if applicable), `navi/` (if applicable)
2. **Create `dockerfiles/`** with the base+final pattern for each service (`[project]-base/`, `[project]/`, `production_[project]-base/`, `production_[project]/`, `vite_[project]-base/`, `vite_[project]/`, `circleci_[project]-base/`)
3. **Adapt the `Makefile`** replacing `PROJECT?=` with your project name and `DOCKER_ID_USER` with your Docker Hub username
4. **Write the `docker-compose.yml`** with `&base`/`&base_prod` anchors, app/fe/proxy/mysql/navi services, and corresponding bind-mounted volumes
5. **Create `.env.dev.sample`** with all env vars referenced in the compose
6. **Adapt `.circleci/config.yml`:** base image release jobs (amd64+arm64), test jobs using bases as executors, deploy jobs in `tags_only`, and `wake-navi` + `warm-up-cache` jobs at the end (if using cache warmer)
7. **Create `bin/`** with `image.sh` (build/push wrapper) and `deploy_frontend.sh` (asset upload/symlink)
8. **Create `scripts/`** with `deploy.sh`, `bump_version.sh`, and cache warmer scripts (if applicable)
9. **Configure `navi/navi_config.yaml`** (if using cache warmer)
10. **Write `proxy/dev_configuration/configure.php` + `rules/*.php`** and the `prod_configuration/` equivalent (if using proxy)

---

## 10. Sources Consulted

The following files from the darthjee/majora repository were consulted as reference:

- `AGENTS.md` — project instructions and documentation hub
- `docs/agents/folder-structure.md` — top-level directory layout
- `docs/agents/cache-warmer.md` — Navi cache warmer configuration and CI integration
- `docker-compose.yml` — full stack service definitions
- `Makefile` — image build commands
- `.circleci/config.yml` — CI pipeline configuration
- `dockerfiles/` directory listing — all base and final image folders

---

*Documento elaborado em 23 de agosto de 2026. As informações contidas são de responsabilidade do solicitante.*