# Add the typecheck script
Add `"typecheck": "tsc --noEmit -p tsconfig.json"` to `backend/package.json` scripts (near `build`/`lint`). `tsconfig.json` already includes `src/**/*.ts`, so specs, `tests/` support files and integration specs are all covered. Confirm `docker-compose run --rm --no-deps ward_tests yarn typecheck` exits 0, and that `yarn lint`, `yarn test` and `yarn build` still pass.

## Files to Change
- `backend/package.json` — new `typecheck` script
