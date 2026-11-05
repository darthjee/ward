# Write accounts/transactions.md

Rewrite `docs/agents/specs/banking/accounts/transactions.md` from the skeleton into the
agreed definition of the **ledger**, **balances**, the **`Transaction` entity**, **currency**,
**categories** (deferred), and the transaction and settings routes. Content must match the
issue's `## Solution` exactly. Suggested sections:

1. **Banner** — "Owned by #29".
2. **Ledger** — a generic mechanism any `Account` can carry; regular accounts always have one;
   #30–#32 decide for their types.
3. **Balance** — computed, never stored, derived in SQL on read; running balance per row
   (MySQL 8 window function, over the whole account ledger before `LIMIT`); a stored /
   cached balance is only a future optimisation (rejected alternative noted here).
4. **Opening balance (anchor model)** — `openingDate` / `openingBalance` stored as two fields
   on `Account` (added by this file for every ledger-carrying type); "balance at the start of
   `openingDate`"; exactly one, created with the account, editable, never deletable (true by
   construction); virtual opening row always shown as the oldest row; effective amount
   `openingBalance − SUM(transactions dated before openingDate)`; backfilling never changes
   balances from the anchor onward. Include the worked example from the issue (anchor 10,000
   on 1 Nov, October backfilled +15,000 / −10,000 → opening 5,000, ledger 5,000 → 20,000 →
   10,000) and the known trade-off (wrong backfills absorbed silently; reconciliation epic).
   Rejected alternative: opening as a real transaction row.
5. **Future-dated transactions** — not allowed (date ≤ UTC today + 1 day, see Edge cases);
   bills (#33) cover "what's coming"; allowing them later needs no migration.
6. **Transaction entity** (`bank_transactions`) — the full field table (`accountId` from the
   URL, never moves; `organizationId` copied from the account; `date` `DATE`; signed `amount`,
   zero rejected; `description` trimmed max 255; `notes` max 2000; `createdByUserId` audit,
   not returned; timestamps). Editable and hard-deletable; read-only on archived accounts
   (link to `regular.md#archive-vs-delete`); order within a day by `id`. Attachments out of
   scope.
7. **Currency** — one ISO 4217 currency per account, none on transactions; editable only
   while the account has no transactions; full ISO list from
   `Intl.supportedValuesOf('currency')`, searchable select; default `BRL` via
   `BANK_DEFAULT_CURRENCY`, validated at boot; no conversion, aggregates grouped per currency;
   amounts stored as integer minor units (`BIGINT`) with the currency exponent from
   `Intl.NumberFormat`; API amounts are decimal strings (`"-1234.56"`), extra decimals → 400;
   `|amount|` capped at 10¹³ minor units. Rejected: `DECIMAL` amounts, curated currency list.
8. **Categories** — deferred to a future epic; no `categoryId`; adding a nullable one later
   needs no backfill. Rejected: categories now.
9. **Routes** — the Transactions table and the Settings table (`GET /settings.json` →
   `{ "default_currency": "BRL" }`, `user-scoped`, organization-scoped rather than public —
   rejected alternative), with cache classes; the shared *Rules* are those of
   `regular.md` (link) plus: a transaction of another account → 404; ledger response carries
   pagination metadata, 50 per page, newest first, virtual opening row on the last page.
   Transaction entry is inline in the ledger (rejected: modal / separate page).
10. **Performance & integrity** — index `bank_transactions (account_id, date, id)`; one
    `SUM … GROUP BY account_id` for list balances (no N+1); real FK
    `bank_transactions.account_id → bank_accounts.id ON DELETE RESTRICT`; no write rate limit;
    bodies never logged (link to `regular.md` data-sensitivity section).
11. **Edge cases** — "today" across timezones (UTC, +1 day tolerance); opening date any past
    date or today, backfilling before it allowed; transaction writes on an archived account →
    409; zero amount, too many decimals, over the cap → 400; over-long fields → 400; unknown /
    foreign / non-numeric ids → 404; last write wins.
12. **Reference** — Epic #26, #29, #28, #33 by URL; GitHub web URLs of `regular.md`,
    `auth/organizations.md`, `specs.md`.
13. **Required tests** — e.g.:
    - balance arithmetic: current balance = opening balance + transactions from the opening
      date onward; derived opening amount; backfilling before the anchor leaves balances from
      the anchor onward unchanged (the worked example as a test case);
    - running balance correct on every page, across page boundaries; newest first; order
      within a day by `id`; virtual opening row last on the last page; pagination metadata;
    - transaction validation: zero amount, extra decimals per currency (BRL vs JPY vs BHD),
      over the 10¹³ cap, date after UTC today + 1 day, blank / over-long description → 400;
      unknown fields and `accountId` / `organizationId` / `createdByUserId` in the body
      rejected;
    - archived account: create / edit / delete transaction → 409;
    - transaction of another account or organization → 404;
    - amounts serialised as decimal strings in the currency's exponent; `createdByUserId`
      absent from responses;
    - opening anchor editable via the account PATCH, never deletable;
    - `BANK_DEFAULT_CURRENCY` validated at boot (invalid code fails), `settings.json` returns
      it, organization-scoped (non-member → 404);
    - cache classes of each route;
    - UI: ledger columns, inline create / edit row, delete confirmation, amounts formatted with
      `Intl` in the account's currency, pagination.

## Files to Change

- `docs/agents/specs/banking/accounts/transactions.md` — replace the skeleton with the full
  spec.
