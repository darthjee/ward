# Backend Plan: TS18036 — `AccountService` fails to build: class decorator combined with `static #private`

Main plan: [plan.md](plan.md)

## Shared contracts

- Keep `backend/package.json`'s `"build": "nest build"` script unchanged. CI's new `backend_build` job runs it.
- After this change, `yarn build` must exit 0 and emit `dist/main.js`. The infra agent's `backend_build` job relies on that.

## Implementation Steps

### Step 1 — Move the static private helpers to module-level functions
In `backend/src/auth/account.service.ts`, `@Injectable()` (line 24) decorates a class that declares:
- `static #assertValidLocale(locale: unknown): void` at lines 94-98
- `static #isCredentialChange(dto: UpdateAccountDto): boolean` at lines 100-102

TypeScript rejects that combination with TS18036.

- Delete both members from the class body.
- Re-add them, with identical bodies, as non-exported module-level functions at the bottom of the file, after the class's closing brace (currently line 168):
  - `function assertValidLocale(locale: unknown): void`
  - `function isCredentialChange(dto: UpdateAccountDto): boolean`
  
  This matches the convention in `bank/transaction.service.ts` and `bank/bill.service.ts`.
- Neither helper has JSDoc today. Add JSDoc with `@param` and `@returns` (only for `isCredentialChange`), following the module-level helpers in `bank/transaction.service.ts`, so the `jsdoc/*` lint rules pass.
- Update both call sites in `updateAccount`:
  - line 85: `AccountService.#assertValidLocale(dto.locale)` becomes `assertValidLocale(dto.locale)`
  - line 87: `AccountService.#isCredentialChange(dto)` becomes `isCredentialChange(dto)`
- Their dependencies (`isUserLocale`, `ErrorCodes`, `UnprocessableEntityException`, `INVALID_LOCALE_MESSAGE`) are already imported or defined at module level.
- Leave the instance `#private` methods untouched. TS18036 only applies to `static #` members.

### Step 2 — Add the ESLint guard
In `backend/eslint.config.mjs`, add this entry to the `rules` object of the main `files: ['**/*.ts']` block (rules start around line 100; for example next to the `eqeqeq`/`no-var`/`prefer-const` group). The file has no `no-restricted-syntax` yet.

```js
'no-restricted-syntax': ['error', {
  selector: "ClassDeclaration[decorators.length>0] > ClassBody > :matches(MethodDefinition, PropertyDefinition)[static=true][key.type='PrivateIdentifier']",
  message: 'static #private members are not allowed in decorated classes (TS18036). Use a module-level function instead.',
}],
```

The rule restricts only decorated classes, and it covers both static private methods and static private fields. Optionally, check it before Step 1 is applied: it should flag lines 94 and 100. After Step 1, `yarn lint` must be clean.

## Files to Change
- `backend/src/auth/account.service.ts` — move `assertValidLocale` and `isCredentialChange` out of the class into file-private module-level functions, and update their two call sites.
- `backend/eslint.config.mjs` — add the `no-restricted-syntax` rule that bans `static #private` members in decorated classes.

## CI Checks
- `backend`: `docker-compose run --rm ward_tests yarn build` must exit 0 and emit `dist/main.js` (new CI job: `backend_build`).
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`).
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`). The run must pass without any spec edits.
- `backend`: e2e/integration specs, including `src/auth/tests/auth.controller.account.e2e-spec.ts` (CI job: `backend_integration`).

## Notes
- Do not modify `src/auth/tests/account.service.spec.ts` or `src/auth/tests/auth.controller.account.e2e-spec.ts`. If either needs a change, the refactor has altered behavior.
- Add no new unit specs and no ESLint `RuleTester` spec.
- `backend/src/bank/tests/account.service.spec.ts` covers a different class (bank `AccountService`) and does not apply here.
- Never run `yarn`/`node` on the host. Always go through `docker-compose run --rm ward_tests ...`.
