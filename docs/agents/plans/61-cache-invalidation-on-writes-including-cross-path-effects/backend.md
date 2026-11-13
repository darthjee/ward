# Backend Plan: Cache invalidation on writes, including cross-path effects

Main plan: [plan.md](plan.md)

## Shared contracts

What this agent must produce:

- The header `X-Cache-Invalidate`, sent **only on successful responses**. Emit it in an rxjs `tap`
  after the handler returns, never before `next.handle()`.
- **Value format:** a comma-separated list of absolute paths, joined with `', '`. Each path must
  have no query, no `..`, and must not be `/`.
- **Owner-scoped bank writes:**
  - a personal owner (`ownerContext.kind === 'user'`) emits `/bank`;
  - an organization owner (`ownerContext.kind === 'organization'`) emits
    `/orgs/<ownerContext.organizationId>/bank`.
  - The base segment comes from the controller's `PATH_METADATA[0]`, which is `bank` today. Don't
    hardcode `bank`.
- **Organization writes:**
  - `POST /orgs.json` emits `/orgs.json`;
  - `PATCH /orgs/:orgId.json` emits `/orgs.json, /orgs/<parsed numeric orgId>.json`.
  - Never emit `/orgs`.
- **No-invalidation writes:** auth, authorization-request and admin writes emit no header.

## Steps

- [01 — Add the invalidation declaration](backend/01-invalidation-declaration.md)
- [02 — Emit X-Cache-Invalidate from an interceptor](backend/02-invalidation-interceptor.md)
- [03 — Enforce declarations in the coverage spec](backend/03-coverage-spec.md)
- [04 — E2E specs for the header](backend/04-e2e-specs.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)

## Notes

- **Effect today.** Every bank and org GET is `user-scoped` today, so it is never cached. The header
  only takes effect once #60 lands. It is still emitted and tested now.
- **Test apps.** The bank and auth test apps register the global interceptors by hand. A new
  interceptor must be added there as well as in `app.module.ts`, or the e2e specs won't see the
  header.
- **Admin search.** `POST /admin/users/search.json` is a read sent as a POST. Declare it "none"
  like the rest of admin.
- **Error responses.** Don't set the header in the existing pre-handler `response.set(...)` block
  of `CachePolicyInterceptor`. That block runs for error responses too.
