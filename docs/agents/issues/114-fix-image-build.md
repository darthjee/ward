# TS18036 — `AccountService` fails to build: class decorator combined with `static #private`
**Labels:** `bug`, `backend`, `build`, `auth`
**Component:** `backend/src/auth/account.service.ts`
**Severity:** Blocking — production deploy fails
## Summary
`yarn build` (`nest build`) aborts on `backend/` because `AccountService` declares both a class decorator (`@Injectable()`) and `static #private` members. TypeScript rejects this combination with `TS18036`. The failure blocks `base_prod_build` in the Docker image chain, so no backend image is published and the Render deploy cannot go live.
## Symptom
```
src/auth/account.service.ts:24:1 - error TS18036: Class decorators can't be used
with static private identifier. Consider removing the experimental decorator.
24 @Injectable()
    ~~~~~~~~~~~~~

Found 1 error(s).
```

## Expected behavior

- `yarn build` (`nest build`) in `backend/` succeeds, so `base_prod_build` publishes the backend image and the Render deploy can go live.
- This class of error is caught on every push (CI build job) and at lint time (ESLint rule), never first at release time.

## Acceptance criteria

- [ ] `backend/src/auth/account.service.ts` has no `static #` members; `assertValidLocale` and `isCredentialChange` are file-private module-level functions with unchanged behavior.
- [ ] `yarn build` in `backend/` exits 0 and emits `dist/main.js`.
- [ ] Existing `AccountService` unit specs and the account e2e spec pass without modification.
- [ ] `.circleci/config.yml` has a per-push `backend_build` job running `yarn build`, and `build-and-release`, `upload_proxy_files` and `upload_fe_files` all require it.
- [ ] `backend/eslint.config.mjs` has the `no-restricted-syntax` rule banning `static #private` members in decorated classes; `yarn lint` passes.

## Root-cause validation

Reproduced locally against `31d4ef1` (the `0.2.0` tag, same commit Render built):

- `nest build` (TypeScript 5.9.3, `tsconfig.build.json`) fails with exactly the one error seen in the Render log — `src/auth/account.service.ts:24:1 TS18036` — and **nothing else**: it is the only production-build error.
- On a scratch copy, changing only the two helpers from `static #assertValidLocale` / `static #isCredentialChange` to `private static assertValidLocale` / `private static isCredentialChange` (and their `AccountService.#…` call sites) makes `nest build` exit 0 and emit `dist/main.js`.
- `account.service.ts` is the only file under `backend/src` that uses `static #`.

Why it slipped through:

- Jest compiles with `@swc/jest`, which strips types without type-checking, so specs pass.
- CI runs `yarn test`/`yarn lint` on every push, but `nest build` only runs inside the Docker image build, which is gated to semver tag pushes — so the error first surfaced at release time.
- Side finding: a full `tsc --noEmit` (which, unlike `nest build`, includes test files) also reports ~10 pre-existing type errors in `src/**/tests/**` (e.g. `in-memory-repo.ts`, `calendar.e2e-spec.ts`). They do not affect the production build, but any CI typecheck guard must decide whether to cover tests.

## Fix approach

Move the two stateless helpers out of the `AccountService` class body into module-level functions at the bottom of `backend/src/auth/account.service.ts`:

- `static #assertValidLocale(locale: unknown): void` → `function assertValidLocale(locale: unknown): void`
- `static #isCredentialChange(dto: UpdateAccountDto): boolean` → `function isCredentialChange(dto: UpdateAccountDto): boolean`
- Update the call sites in `updateAccount` (`AccountService.#…` → plain calls).
- Keep their behavior and JSDoc unchanged; do not export them (still file-private).

Why this over the alternatives:

- It matches the existing convention for stateless helpers in services (`transaction.service.ts`, `accountant.service.ts`, `bill.service.ts`, `session-status.service.ts`).
- `private static` would also build, but its privacy is TypeScript-only, and the `sort-class-members` ESLint rule (`[static-methods]` before properties/constructor) would force relocating them to the top of the class.
- Instance `#private` methods would work with decorators, but neither helper uses `this`.

The instance `#private` methods (`#applyLocaleOnly`, `#applyCredentialChange`, `#loadUser`, …) are unaffected — TS18036 only concerns `static #` members on a decorated class.

## CI check

Make CircleCI run the backend production build on every push, so errors like TS18036 fail the pipeline before a release tag instead of during the image build:

- Add a new `yarn_project` instance to the `test` workflow in `.circleci/config.yml`, alongside `backend_tests`/`backend_checks`:
  - `name: backend_build`, `dir: backend`, same `image` as the other backend jobs, `script: build`, `step_name: Build`, same `requires` and `filters: *all_tags`.
- Add `backend_build` to the `requires` of every tag-only job that already gates on the backend checks — `build-and-release`, `upload_proxy_files` and `upload_fe_files` — so no release artifact is built or uploaded from a commit whose backend does not build.
- Run `yarn build` (`nest build` with `tsconfig.build.json`) rather than a separate `tsc --noEmit` script: it is exactly what the Docker image runs, so CI and the production build stay in step.

Out of scope: type errors in backend test files (`src/**/tests/**`, excluded from `tsconfig.build.json`) and type-checking tests in CI are tracked in #115.

## Lint rule

Add a `no-restricted-syntax` rule to the `files: ['**/*.ts']` block of `backend/eslint.config.mjs` (the backend config does not use `no-restricted-syntax` yet), so the problem is reported by the editor and `yarn lint` before CI's build job:

```js
'no-restricted-syntax': ['error', {
  selector: "ClassDeclaration[decorators.length>0] > ClassBody > :matches(MethodDefinition, PropertyDefinition)[static=true][key.type='PrivateIdentifier']",
  message: 'static #private members are not allowed in decorated classes (TS18036). Use a module-level function instead.',
}],
```

- Only decorated classes are restricted; `static #` in plain classes stays allowed.
- Covers both static private methods and static private fields.
- Verified against the current `account.service.ts`: it reports both offending members (lines 94 and 100), and must report nothing once the fix is applied.

## Scope

**In scope**

1. Code fix — move `assertValidLocale` / `isCredentialChange` in `backend/src/auth/account.service.ts` to module-level functions (see Fix approach).
2. CI — new per-push `backend_build` job (`yarn build`), required by `build-and-release`, `upload_proxy_files` and `upload_fe_files` (see CI check).
3. Lint — `no-restricted-syntax` rule in `backend/eslint.config.mjs` (see Lint rule).

**Out of scope**

- Type errors in backend test files and type-checking tests in CI — tracked in #115.
- Version bump, release tag and Render redeploy — done manually by the maintainer after merge.
- A frontend `vite build` CI job — the frontend is plain JS and shows no comparable problem.
- Moving the `circleci_ward-base` image pin from 0.1.0 to 0.2.0 — tracked by its own note in `.circleci/config.yml`.

## Testing strategy

The code change is a behavior-preserving refactor, already covered by `src/auth/tests/account.service.spec.ts` (including the locale and credential-change paths) and `src/auth/tests/auth.controller.account.e2e-spec.ts`.

1. No new unit specs: the existing `AccountService` and account e2e specs must pass **unchanged** (needing to edit them would signal a behavior change).
2. `yarn build` in `backend/` exits 0 and emits `dist/main.js`.
3. `yarn lint` passes with the new rule; before the code fix, the rule flags both static private members (already verified).
4. On the PR, the new `backend_build` CircleCI job runs and passes, and `build-and-release`, `upload_proxy_files` and `upload_fe_files` require it.
5. Optional: build the production Docker image locally; otherwise the post-merge tag build confirms it.

No dedicated ESLint `RuleTester` spec for the selector — overkill for a single `no-restricted-syntax` entry.

## Other considerations

- **Edge cases** — none beyond the above; the helpers are pure and stay file-private.
- **Backward compatibility** — no API, data, or behavior change.
- **Performance & security** — none; same logic. CI gains one extra job (~a `yarn install` + a few seconds of `nest build`).
- **Owning module** — Auth module (`backend/src/auth/`), plus CI/infra (`.circleci/config.yml`) and backend lint config. No new module.
- **Data sensitivity** — none touched.
- **Memory footprint** — no runtime change.
- **Caching** — no new or changed routes.
