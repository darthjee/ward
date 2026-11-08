# Pure helpers: id parser, page parser, pagination envelope

Add small, unit-tested helpers so the controllers and services stay thin.

## Id parser

- Generalise `parseOrgId` into `parseId(raw)` in `core/parse-id.ts`:
  - it accepts `/^[1-9][0-9]*$/` up to 2147483647;
  - anything else throws `ownerNotFound()`, so the 404 body is identical to the one for an
    unknown id.
- Keep `parseOrgId` as a thin wrapper, or make it call `parseId`, so #46's behaviour and specs
  stay unchanged.
- Use it for `:accountId` and `:transactionId`. Never use `ParseIntPipe`, which answers 400.

## Page parser and pagination

Add both to `bank/pagination.ts`. This is the project's first pagination convention, so keep
the shape generic.

- `parsePage(raw)`:
  - `undefined` gives 1;
  - a string matching `/^[1-9][0-9]*$/` gives that number;
  - anything else, including `0`, negative numbers, `abc` and `1.5`, throws
    `BadRequestException`, which the filter turns into a 400 with the standard error body.
- `buildPagination(page, perPage, totalCount)` returns
  `{ page, per_page, total_pages, total_count }`. `total_pages` is `max(1, ceil(totalCount / perPage))`,
  so an empty ledger has exactly one page, the one that holds the opening row.
- `LEDGER_PER_PAGE = 50`.

## Tests

- Unit specs for each helper.
- The existing `parse-org-id.spec.ts` must still pass unchanged.

## Files to Change

- `backend/src/core/parse-id.ts` — new: `parseId`.
- `backend/src/core/parse-org-id.ts` — delegate to `parseId`, with no behaviour change.
- `backend/src/core/tests/parse-id.spec.ts` — new.
- `backend/src/bank/pagination.ts` — new: `parsePage`, `buildPagination`, `LEDGER_PER_PAGE`.
- `backend/src/bank/tests/pagination.spec.ts` — new.
