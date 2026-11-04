# Documentation Summary

A 2-4 line abstract of each doc under `docs/agents/`, so an agent can decide whether to open the
full file before loading it. For a bare link-only table of contents instead, see
[index.md](index.md).

## Architecture

- **[Folder Structure](folder-structure.md)** — Top-level directory layout: what each top-level
  folder (`backend/`, `frontend/`, `proxy/`, `dockerfiles/`, `docs/`, etc.) is for.
- **[Flow](flow.md)** — The request path every module shares: login (password/register/
  recover/device authorization), opening a module page, Tent cache vs. backend (and Render cold
  starts), guards and lazy loading, session renewal, plus the per-user cache note.
- **[Architecture](architecture.md)** — Hub page splitting the architecture by concern (proxy,
  frontend, backend, modular pattern, infra) to keep agent contexts small, plus Ward's hosting
  constraints (Render free tier, 512 MB) and key trade-offs. Read the linked area page relevant
  to your task instead of loading everything.
- **[Modular Pattern](architecture/modular-pattern.md)** — The rules every backend module
  follows: Core/always-on/lazy tiers, the planned-modules table with table prefixes, DI vs.
  events (and the lazy-listener caveat), database ownership, what a module page must contain,
  and the "Adding a new module" checklist. Read it before creating or extending a module.
- **[Modules](modules/)** — Per-backend-module documentation (routes, entities, events), one
  file per module (`modules/auth.md` and `modules/mail.md` today). Read the module's page before
  extending or consuming it.
  - **[Auth](modules/auth.md)** — Ward's always-on login module: `/auth/*.json` routes, the
    `auth_` tables, the JWT/refresh-token flow and session-lookup gate, the admin tool routes, and
    the `user.registered` and `password-recovery.requested` events.
  - **[User approval](modules/auth/user-approval.md)** — Account statuses (`pending` /
    `approved` / `denied`), the optional `WARD_USER_APPROVAL_REQUIRED` flag, admin
    approve/deny, per-endpoint behavior by status and lifecycle edge cases.
  - **[Mail](modules/mail.md)** — Always-on, general-purpose transactional email sender. No HTTP
    surface; consumed via the exported `MailService`. `WARD_EMAIL_*` config read once at boot;
    disabled by default (log-and-skip). Templated sends via `sendEmailTemplate`, backed by
    filesystem templates under `mail/templates/` read once at boot. First consumer: the auth
    module's password-recovery email.
- **[Routes](backend/routes.md)** — Per-endpoint backend route reference, one file per domain
  under `backend/routes/` ([auth.md](backend/routes/auth.md) and
  [admin.md](backend/routes/admin.md)), complementing the entity/event-focused `modules/` pages.

## Conventions

- **[Contributing](contributing.md)** — Commit guidelines (atomic, no unrelated changes,
  separate refactors) and PR standards (descriptive summary, description files when needed).
- **[Product Definitions](product.md)** — What Ward is, its module list (Auth/Mail implemented;
  `bank`, `protocol`, `car-performance`, `links` planned), cross-cutting decisions
  (login/session, user approval, admin tooling, mail, config, per-user data ownership) and what
  is still open per planned module. Read it before planning any issue that introduces new
  entities.
- **[Issue Enhancement](issue-enhancement.md)** — Checklist of concerns (`/enhance-issue` uses
  this) for fleshing out a vague issue idea before it reaches the `Created` stage.
- **[Arcanum Split Issue](arcanum-split-issue.md)** — Checklist of concerns
  (`/arcanum-split-issue` uses this) for breaking a broad issue into sub-issues.
- **[Environment Variables](environment-variables.md)** — Every env var Ward's production
  deployment needs: backend runtime (Render), the cache warmer, and CircleCI deploy-pipeline
  secrets — with each one marked as actually consumed by code or still reserved. Update it
  whenever a "reserved" var gets wired up or a new one is added.
- **[Deployment](deployment.md)** — Operator guide for tag releases: every CircleCI variable the
  deploy needs (where to set it, what it is for, how to get it, e.g. `ssh-keyscan` for
  `SSH_KNOWN_HOSTS`), plus rollout notes (host-key pinning must be set first, kept
  `_old_<epoch>` releases are pruned by hand). Links to `specs/deploy/` for the design.

## API caching

- **[API Caching](architecture/caching.md)** — Single source of truth for API caching: Tent
  shared-caches every 2xx `*.json` response unless it carries `X-Skip-Cache`; every route
  declares a `public`/`user-scoped`/`never` class with `@CachePolicy()` (enforced by a spec),
  which drives `X-Skip-Cache` and `Cache-Control`; 10s stale-while-revalidate; writes clear the
  collection/entity entries; only `public` GET endpoints may be warmed by Navi.

## External tooling

- **[External Tooling](external.md)** — Hub linking the full usage guides for the project-agnostic
  tools the project depends on: Tent (proxy), Navi (cache warmer), and navi-hey-client (Navi's
  CLI/library). Read the linked guide before making changes involving that tool.
- **[Cache Warmer](cache-warmer.md)** — How Ward uses Navi to warm the Tent proxy cache after
  each production release; used by the `cache` agent. Given Ward's multi-tenant model, most
  endpoints are excluded from warming by default. Also documents the per-user cache Tent is
  developing, expected to eventually replace `X-Skip-Cache` for user-scoped reads.

## Specs, Plans & Issues

- **[Specs](specs.md)** — Permanent hub for feature specs: temporary, agreed definitions of a
  multi-issue feature (one folder per feature under `specs/`) that its sub-issues build against,
  then fold into the permanent docs. Lists the active and completed specs; read it to find the
  source of truth for an in-progress feature.
- **[Plans](plans/)** — Implementation plans for ongoing or upcoming features, one directory per
  issue (`<issue_id>_<topic>/`).
- **[Issues](issues/)** — Detailed specs for open issues, one file per issue
  (`<issue_id>_<issue_name>.md`).
