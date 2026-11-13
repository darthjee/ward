# Emit X-Cache-Invalidate from an interceptor

Add `backend/src/core/cache-invalidation.interceptor.ts` (`CacheInvalidationInterceptor`).
Keeping it separate from `CachePolicyInterceptor` gives each interceptor a single concern.

## Behaviour

1. **Skip reads.** If the request method is GET or HEAD, return `next.handle()` untouched.
2. **Read the declaration** with
   `reflector.getAllAndOverride(INVALIDATION_KEY, [context.getHandler(), context.getClass()])`.
   If it is missing or `none`, return `next.handle()` untouched. The coverage spec, not the
   runtime, enforces that a declaration exists.
3. **Resolve the paths:**
   - **`owner`:**
     - Read `base = Reflect.getMetadata(PATH_METADATA, context.getClass())`. Take the first
       entry, for example `'bank'`, and strip any leading or trailing `/`.
     - Read `request.ownerContext`, which `OwnerContextGuard` has already set.
     - For `kind: 'user'`, the path is `/${base}`.
     - For `kind: 'organization'`, the path is `/orgs/${organizationId}/${base}`.
     - If `ownerContext` is missing, emit nothing. This is defensive.
   - **`paths`:** call `build(request)`.
4. **Sanitise.** Drop any path that does not start with `/`, is `/`, or contains `?`, `#` or a
   `..` segment.
5. **Set the header after success.** Use
   `next.handle().pipe(tap(() => response.set('X-Cache-Invalidate', paths.join(', '))))`, and set
   it only when the list is non-empty.
   - Setting it inside `tap` means exceptions never carry it.
   - If headers have already been sent, for example on a streamed response, skip it. No Ward write
     streams today.
6. **Export the header name** as a constant, for example `CACHE_INVALIDATE_HEADER` in
   `core/cache-class.ts` or the new file.

## Registration

Register the interceptor as an `APP_INTERCEPTOR` in `backend/src/app.module.ts`, next to
`CachePolicyInterceptor`. Add it to both test app builders too, so the e2e specs exercise it.

## Unit spec

Add `backend/src/core/tests/cache-invalidation.interceptor.spec.ts`. It covers:

- the personal and organization prefixes;
- GET passthrough;
- `none`;
- explicit paths;
- no header on a thrown error;
- an unsafe path being dropped.

## Files to Change

- `backend/src/core/cache-invalidation.interceptor.ts`: new interceptor.
- `backend/src/app.module.ts`: register it as `APP_INTERCEPTOR`.
- `backend/src/bank/tests/support/build-bank-test-app.ts`: register it in the bank test app.
- `backend/src/auth/tests/support/build-auth-test-app.ts`: register it in the auth test app.
- `backend/src/core/tests/cache-invalidation.interceptor.spec.ts`: new unit spec.
