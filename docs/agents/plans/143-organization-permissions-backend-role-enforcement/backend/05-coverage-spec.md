# Coverage spec for undeclared owner-scoped writes

Make owner-scoped writes closed by default. Any `POST`, `PATCH`, `PUT` or `DELETE` handler that
is owner-scoped (handler or class `IS_OWNER_SCOPED_KEY`) and has no `MIN_ORG_ROLE_KEY` metadata
fails CI.

- Extend `RouteEntry` in `core/tests/cache-policy.coverage.spec.ts` with
  `minOrgRole: metadataOf(MIN_ORG_ROLE_KEY, handler, controller)`.
- If the file gets crowded, move the route discovery (`findControllerFiles`, `routesOf`,
  `RouteEntry`) into `core/tests/support/route-discovery.ts`. Put the new check in
  `core/tests/min-org-role.coverage.spec.ts`. This is preferred, since the existing spec is
  already 304 lines and covers two concerns.
- The check: `ownerScoped && !READ_METHODS.includes(httpMethod) && minOrgRole === undefined` →
  violation, listed as `Controller#handler METHOD path`.
- Add a fixture controller, `UndeclaredOrgRoleController` (owner-scoped `@Post` with no role),
  and assert that the check flags it. Follow the existing fixture pattern.
- Add a sanity check that `@MinOrgRole` values are valid `OrgRole` members.
- Add `ProviderBillsController` and `ProviderBillPaymentsController` to `KNOWN_CONTROLLERS`
  while there.
- Update the header comment to mention the role check.

The rename route (`OrganizationController`) is not owner-scoped, so this spec does not cover it.
Step 08's e2e covers it.

This spec fails until step 06 declares the roles. Land step 06 in the same commit, or right
after it.

## Files to Change
- `backend/src/core/tests/support/route-discovery.ts` — new (optional): discovery code shared by both coverage specs.
- `backend/src/core/tests/min-org-role.coverage.spec.ts` — new coverage spec and fixture.
- `backend/src/core/tests/cache-policy.coverage.spec.ts` — reuse the shared discovery; `KNOWN_CONTROLLERS`; header comment.
