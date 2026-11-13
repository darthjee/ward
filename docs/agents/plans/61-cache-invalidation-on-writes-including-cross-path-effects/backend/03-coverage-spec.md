# Enforce declarations in the coverage spec

Extend `backend/src/core/tests/cache-policy.coverage.spec.ts` so that any non-GET route without an
invalidation declaration fails the build.

1. In `routesOf(controller)`, add two fields to each route entry:
   - `httpMethod`, from `Reflect.getMetadata(METHOD_METADATA, handler)`, a `RequestMethod`;
   - `invalidation`, from `metadataOf(INVALIDATION_KEY, handler, controller)`. This checks the
     handler first, then the class, so it picks up the class-level owner default and "none".
2. Add these assertions:
   - every route whose `httpMethod` is not `GET` or `HEAD` has a defined `invalidation`;
   - every owner-scoped route's invalidation is `owner`, unless it is overridden explicitly.
3. Prove the check works. Add a fixture controller (a plain `@Controller('fixture-plain')` with an
   undeclared `@Post`) and assert that the "undeclared write" check flags it. This follows the
   existing `ViolatingOwnerScopedController` fixture pattern.

## Files to Change

- `backend/src/core/tests/cache-policy.coverage.spec.ts`: the new fields, assertions and fixture.
