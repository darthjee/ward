# Backend route docs
Document the minimum role of every write route and the 403 response.

- **`docs/agents/backend/routes/auth.md`** — Organization routes shared behavior: add the 403
  (uniform body). `PATCH /orgs/:orgId.json`: Auth → "JWT, `admin` or `owner`"; Errors gain
  `403 FORBIDDEN`; document the order 400 body → 404 membership → 403 role and that the check is
  in `OrganizationService.rename` (not `@MinOrgRole`, the route is not owner-scoped).
  `POST /orgs.json`: no role gate. GETs: any member.
- **`docs/agents/backend/routes/bank.md`** —
  - Shared rules: replace "404, never 403" with "404 before 403": every miss is the uniform 404
    (unchanged list); a member whose role is too low gets the uniform 403 (quote the body), only
    after the 404 resolve, so a 403 never discloses anything to a non-member. Personal context
    counts as `owner`. Link to [Organizations → Roles](../../modules/auth/organizations.md#roles).
  - Add a "Minimum role" rule/table (the matrix from plan.md) or a "Min role" column/line in each
    route section's table (follow whichever shape the sections use); note the payment-generated
    transaction PATCH needs `admin`.
  - Error codes table: add `403 FORBIDDEN` (role too low; payment-generated transaction edit by
    `user`).
- **`docs/agents/architecture/backend.md`** — optional short pointer next to "Admin Guard" /
  error responses: `OwnerContextGuard` + `@MinOrgRole` → 403, distinct from `AdminGuard`;
  link to organizations.md.

## Files to Change
- `docs/agents/backend/routes/auth.md` — rename route role, 403, shared behavior
- `docs/agents/backend/routes/bank.md` — shared rules, per-route minimum role, 403 error code
- `docs/agents/architecture/backend.md` — short pointer to the org-role 403
