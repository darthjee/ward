# Issue: Implement the accountant hand-off for provider-expense accounts — backend

## Description

Add the **accountant hand-off** for provider-expense accounts to the `bank` backend module:
the `sent_to_accountant_at` mark on charges, the preview route and the mark sent / unsent
routes. Split from #54, which adds the provider-expense account type itself.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

## Specs

- `docs/agents/specs/banking/accounts/provider-expense.md`: *Business expenses for the
  accountant*, *Hand-off routes*, *Validation* (hand-off), *Performance & security*,
  *Edge cases* 1–11, *Required tests* (Transactions, Hand-off preview, Mark sent / unsent)

## Scope

- The nullable `bank_transactions.sent_to_accountant_at` column and its migration.
- `sent_to_accountant_at` on transaction responses (see below).
- `GET <base>/accountant/charges.json` (preview) and `POST <base>/accountant/mark-sent.json` /
  `mark-unsent.json` (all-or-nothing, idempotent), in a new accountant controller mounted under
  both prefixes like every bank controller.
- Marking is allowed on archived accounts (spec edge case 5), while transaction create / edit /
  delete there stay `409`.
- **No CSV route**: the CSV is built client-side. No uploads and no attachments.

## Owning module and layout

Inside the lazy `bank` module — no new module, no cross-module access. New files sit flat in
`backend/src/bank/`, like every bank feature so far (DTOs in `bank/dto/`):

- **`accountant.controller.ts`** — `AccountantController`, a thin **resident** controller
  registered in `BankRoutesModule.controllers`, declared with `@OwnerScopedController('bank')`
  (both prefixes) and `@CachePolicy` per route. It parses the query DTO and the `@StrictBody()`
  mark body, loads the lazy module through `BankModuleLoader` and delegates.
- **`accountant.service.ts`** — `AccountantService`, in the **lazy** `BankModule` (`providers`
  and `exports`): the preview, and mark sent / unsent (one owner-scoped resolving query,
  classification into 404 / 400, one `UPDATE` inside a DB transaction).
- **`accountant-charges.query.ts`** — the preview's SQL, next to `ledger.query.ts`.
- **`dto/accountant-charges-query.dto.ts`** (`AccountantChargesQueryDto`) and
  **`dto/mark-charges.dto.ts`** (`MarkChargesDto`, `transaction_ids`).
- **Existing files touched** — `TransactionService.update` (clears the mark on a sign flip),
  `transaction-response.ts` and `ledger.query.ts` (the response key), `bank.module.ts` and
  `bank-routes.module.ts` (registration). `account.service.ts` (at ~293 of its 300-line limit)
  and the account-type handlers are **not** touched.

## Edge cases (decisions on points the spec leaves open)

Spec edge cases 1–11 apply as written. In addition:

- **Mark as unsent on an unflagged account.** `mark-unsent` answers `400` only for payments;
  charges of an account whose `for_accountant` was turned off can still be un-marked, so the
  marks kept by edge case 6 stay undoable. `mark-sent` keeps the full rule (payments and
  unflagged charges → `400`).
- **Sign flip on a sent charge.** Editing a sent charge so its amount becomes positive (a
  payment) clears `sent_to_accountant_at`; flipping it back makes it an unsent charge. Any other
  edit keeps the mark, as the spec says.
- **Hand-off date limit.** `from` / `to` may be up to UTC today + 1 day, the same limit as
  transaction dates in `transactions.md`, so a charge dated tomorrow can be exported. Later
  dates → `400`.
- **Charges before `opening_date`.** Included in the preview: it filters only by date range,
  active owner, `for_accountant` and sign.
- **Malformed `transaction_ids`.** An entry that is not a positive integer → `400` (validation),
  not `404`.

## Preview query parameters

`GET <base>/accountant/charges.json` validates its query with an `AccountantChargesQueryDto`,
built like `ListAccountsQueryDto`:

- **`from` / `to`** — required; each a real `YYYY-MM-DD` date not after UTC today + 1 day,
  checked with `isAllowedLedgerDate` from `ledger-date.ts` (no new date parser). Missing or
  invalid → `400 VALIDATION_FAILED`.
- **Range** — `from` after `to` → `400`; `from == to` (a single day) is allowed. The cap counts
  the difference: `to − from` ≤ 366 days (e.g. `2026-01-01` → `2027-01-02` is accepted), else
  `400`.
- **`include_sent`** — optional, `'true'` / `'false'` only (default `false`), like `archived` on
  the accounts list; any other value (`1`, `yes`, …) → `400`.
- A repeated parameter → `400`. Unknown parameters are ignored, as on the accounts list (the
  global `ValidationPipe` strips them).

## Which transactions the mark routes accept

Every posted id (after de-duplication) is resolved in one query scoped to the active owner, then
classified:

| Posted id | `mark-sent` | `mark-unsent` |
|---|---|---|
| Charge of a `for_accountant` provider-expense account (archived included) | stamped; an existing timestamp is kept | cleared |
| Charge of a provider-expense account with `for_accountant` off | `400` | cleared (see edge cases) |
| Payment of a provider-expense account | `400` | `400` |
| Any transaction of a regular, debt or investment account | `400` | `400` |
| Unknown id, another owner's, or the wrong context | `404` | `404` |
| Already-unsent charge (`mark-unsent`) | — | no-op, returns `null` |

- **Precedence** — ownership first: when a request mixes `404` and `400` ids, the answer is
  `404`, so nothing is revealed about ids the owner can't see. Either way nothing is stamped or
  cleared (all-or-nothing).
- **`400` body** — the standard `VALIDATION_FAILED` envelope, its message naming the rejected
  ids (e.g. "transactions 7, 9 are not hand-off charges"). Only the owner's own ids appear in it.

## Concurrency in the mark routes

Mark sent / unsent run inside one DB transaction, and the owner-scoped resolving query locks the
posted transaction rows with `SELECT … FOR UPDATE OF t` (only `bank_transactions`, at most 1000
rows — not the accounts or details). The 404 / 400 checks and the `UPDATE` therefore see the same
rows:

- a concurrent `DELETE` or `PATCH` of one of those charges waits for the mark to commit, then
  runs (a `PATCH` that flips the sign then clears the mark, per the edge cases), so a payment is
  never stamped and the reply always lists every posted id;
- a `for_accountant` toggle racing with the mark is not locked out — harmless, since spec edge
  case 6 keeps existing marks either way.

The e2e / integration specs need not reproduce the race; a unit spec asserts the lock is
requested.

## Preview response shape

`GET <base>/accountant/charges.json` answers an envelope with one row per charge; the charge's
own fields sit at the top level and the provider's data under a nested `account` object:

```json
{
  "charges": [
    {
      "id": 7,
      "date": "2026-10-05",
      "description": "Charge",
      "amount": "-129.90",
      "sent_to_accountant_at": null,
      "account": {
        "id": 12,
        "name": "Vivo Fibra",
        "bank_name": "Vivo",
        "provider_tax_id": "02.558.157/0001-62",
        "currency": "BRL"
      }
    }
  ]
}
```

- `account.id` lets the hand-off page link each row to its provider detail page.
- `account` carries only these five fields: no owner fields, no `account_number`, no balance.
- `amount` is in the account currency's exponent, as every amount; `sent_to_accountant_at` is
  an ISO timestamp or `null`.
- An empty range answers `{ "charges": [] }`.

## Where `sent_to_accountant_at` shows up

- **Transaction responses** — ledger rows (`GET …/transactions.json`) and the `POST` / `PATCH`
  transaction responses carry `sent_to_accountant_at` **only** when the account is
  `provider_expense` **and** the amount is negative: the ISO timestamp, or `null` when unsent.
- On payments of provider-expense accounts and on every row of other account types the key is
  **absent** (not `null`), so their responses stay byte-identical. Never on the virtual opening
  row.
- The decision lives in the serializers of `transaction-response.ts`, which already receive the
  account; `ledger.query.ts` always selects `t.sent_to_accountant_at` (no per-type SQL, no extra
  query).
- **Mark routes reply** — `POST <base>/accountant/mark-sent.json` and `mark-unsent.json` answer
  `200` with the posted ids (after de-duplication) and their resulting mark:

  ```json
  { "charges": [ { "id": 7, "sent_to_accountant_at": "2026-11-09T12:00:00.000Z" } ] }
  ```

  Re-marking an already-sent charge returns its original timestamp; `mark-unsent` returns
  `null` for every id.

## Backward compatibility

- **Migration.** One new migration adds the nullable `bank_transactions.sent_to_accountant_at`
  (existing rows `NULL`, no backfill), after #54's details migration. Existing migrations and
  their specs (including `bank-create-transactions`, which asserts the column is absent from
  that migration) stay untouched.
- **Other account types unchanged.** Ledger and transaction responses of regular, debt and
  investment accounts, and of payments, stay identical; their existing specs must pass
  unchanged.
- The generic transaction body keeps rejecting `sent_to_accountant_at` (`400`).

## Docs

Updated in the same PR as the code:

1. **`docs/agents/specs/banking/accounts/provider-expense.md`** — record every decision of this
   issue next to the rule it refines, marked "(decided in #71)": the edge cases above; which
   transactions the mark routes accept (other account types → `400`), the 404-before-400
   precedence and the `400` message naming the rejected ids; the preview query rules
   (`include_sent` only `true` / `false`, `to − from` ≤ 366 days, `from == to` allowed, unknown
   parameters ignored); the row lock in the mark routes; the preview `{ charges }` envelope with
   the nested `account`; the mark routes' `200` reply; and `sent_to_accountant_at` being absent
   (not `null`) outside provider charges. The file layout is not recorded in the spec.
2. **`docs/agents/specs/banking/accounts/transactions.md`** (`sentToAccountantAt` row) — add the
   exception: a `PATCH` that turns a sent charge positive also clears the mark.
3. **`docs/agents/backend/routes/bank.md`** — `sent_to_accountant_at` on the transaction response
   and ledger rows, an *Accountant hand-off* section (three routes, query parameters, bodies,
   replies, caps, errors, cache classes), and the intro's controller list ("three thin resident
   controllers" → four, adding `AccountantController`).
4. **`docs/agents/backend/routes.md`** — the Bank line of the index gains "the accountant
   hand-off".
5. **`docs/agents/architecture/backend.md`** (`bank_transactions` row of the tables list) — the
   nullable `sent_to_accountant_at` `DATETIME` column, no index.

## Depends on

- #54 (provider-expense accounts — backend).

## Acceptance criteria

- The backend *Required tests* of `provider-expense.md` for Transactions, Hand-off preview and
  Mark sent / unsent are covered by Jest specs, and they pass.
- The `security`, `data-access` and `cache` reviews raise no unresolved violations.
