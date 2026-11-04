# Architecture

## Overview

Ward is a personal, modular application for organising everyday life (banking, protocols of
requests to companies, car fuel performance, links to check later, and more to come). It is
structured as two independent applications — a NestJS backend and a React/Vite frontend —
served together through the Tent proxy. The backend is split into self-contained modules (see
[Modular Pattern](./architecture/modular-pattern.md)), and the whole stack is shaped by a small
host (see "Hosting constraints" below). This repository documents the architecture split by
concern to keep agent contexts small.

This page is the hub. See the area pages for details:

- [Proxy](./architecture/proxy.md)
- [Frontend](./architecture/frontend.md)
- [Backend](./architecture/backend.md) — NestJS + TypeORM + MySQL stack, layout, build, and
  testing conventions. The Auth and Mail modules exist (always-on); the domain modules
  (`bank`, `protocol`, `car-performance`, `links`) are planned as lazy modules — see
  `docs/agents/product.md`.
- [Modular Pattern](./architecture/modular-pattern.md) — the cross-cutting rules (module
  classification, lazy loading, inter-module communication, database strategy) every backend
  module, present or future, must follow.
- [API Caching](./architecture/caching.md) — the opt-out Tent cache for `*.json`, the
  `public`/`user-scoped`/`never` cache classes declared with `@CachePolicy()`, the
  `Cache-Control` policy, freshness/invalidation semantics, and what Navi may warm.
- [Security](./architecture/security.md) — cross-cutting security posture, starting with CSRF
  (the `SameSite=Strict` cookie, the CORS allowlist and the global `OriginGuard`).
- [Deployment](./deployment.md) — how a release runs: triggers and job graph, base images,
  Render and `bin/server.sh`, SSH staging and the release swap, rollback, security, release
  steps and the provisioning checklist.
- [Infra](./architecture/infra.md) — the CircleCI release pipeline's job graph (test/lint jobs,
  the semver-tag-gated release chain, and the base-image publish jobs feeding it).

## Hosting constraints

Ward runs on the **Render free tier**, and that constraint drives most architectural choices:

- **512 MB RAM** for the backend process. Node.js/V8 alone takes roughly 50–150 MB, so every
  resident module counts.
- **Sleeps when idle.** Render stops the service after a period of inactivity and wakes it on
  the next request (cold start). Navi's wake call (`scripts/wake_navi.sh`) exists to warm it.
- **Tent keeps serving while the backend sleeps.** Cached `GET` responses and the static
  frontend are served by the proxy without waking the backend (see
  [API Caching](./architecture/caching.md)).

Consequences:

- Rarely used domain modules are **lazy** — their DI graph is built on first request, not at
  boot (see [Modular Pattern](./architecture/modular-pattern.md)).
- TypeORM runs in-process (no extra binary/subprocess), with a small connection pool
  (`poolSize: 5`).
- Everything runs as a single backend process — modules communicate through DI and in-process
  events, never through separate services.

## Key trade-offs

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Backend framework | NestJS | Rails, Django | Native lazy module loading, lower memory footprint |
| ORM | TypeORM | Prisma | No binary subprocess, lower memory use |
| Access token storage | `httpOnly` cookie | `Authorization` header | XSS protection — JavaScript cannot read it |
| Refresh token storage | `localStorage`, sent in the request body | `httpOnly` cookie | Explicit frontend control over refresh |
| Module communication | Hybrid (DI + events), in-process | Microservices | Memory budget — one process only |
| Database layout | Single DB, one table prefix per module | Separate schemas/databases | Simpler, smaller connection pool |
| Cross-module references | Logical FKs | Physical FKs | Module decoupling (one documented exception may be recorded per module) |
| Hosting | Render free tier | Paid tiers | Zero cost, at the price of 512 MB RAM and cold starts |
