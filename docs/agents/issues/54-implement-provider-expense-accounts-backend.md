# Issue: Implement provider-expense accounts — backend

## Description

Add **provider-expense** accounts to the `bank` backend module.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

The accountant hand-off (the `sent_to_accountant_at` mark, the preview and the mark sent /
unsent routes) was split out to #71, which builds on this issue.

## Specs

- `docs/agents/specs/banking/accounts/provider-expense.md`: *Ledger and balance*, *Fields*
  (except `sentToAccountantAt`), *Recording charges and payments*, *Routes and permissions →
  Accounts*, *Validation* (accounts), *Edge cases* 12–14 and the closing paragraph, *Required
  tests* (Account routes, DB)

## Scope

- `bank_provider_expense_details` and its migration. `type: "provider_expense"` is accepted on
  the account routes together with the `provider_expense` object (`GET ?type=provider_expense`,
  create, detail, PATCH with partial merge; `type` immutable).
- Recording charges and payments through the generic transaction routes, and the ledger /
  balance rules.
- **Not here:** `sent_to_accountant_at` and the hand-off routes (#71); bills-related fields
  (#56, bills and the calendar — backend).

## Edge cases (decisions on points the spec leaves open)

Spec edge cases 12–14 and the closing paragraph (no object on POST still creates a details row,
frequency switching, wrong-type deep links) apply as written. The other edge cases belong to
#71.

## `provider_tax_id`

Free text, at most 32 characters (spec). Treated like `bank_name` / `branch`: trimmed, blank →
`null`; no format check (it is not always a CNPJ).

## Currency change and `expected_amount`

Same as #50's `instalment_amount` (see `DebtAccountHandler`, which receives `previousCurrency`
through `AccountTypeContext`):

- A `currency` change (allowed only before any transaction, as in `regular.md`) rescales the
  stored `expected_amount` like `opening_balance`: its decimal value is kept and rescaled to the
  new currency's exponent (e.g. `200.00` BRL → `200` JPY). When it cannot be represented →
  `400` (e.g. `12.50` BRL → JPY).
- When the same PATCH also sends `expected_amount`, the stored value is not rescaled; the sent
  value is validated against the new currency's decimals and amount bound (`null` clears it).

## PATCH paired rules on the merged state

Mirror #50's debt rules (`backend/src/bank/account-types/debt-details.ts`) for
`charge_frequency` ↔ `due_month`, reusing its merge helpers where possible: the rule is checked
on the stored details with the request merged on top, not on the request body alone.

| Stored | PATCH `provider_expense` | Result |
|---|---|---|
| yearly, `due_month` 3 | `{ due_day: 10 }` | ok, unchanged |
| yearly, `due_month` 3 | `{ due_month: 7 }` | ok |
| yearly, `due_month` 3 | `{ due_month: null }` | `400` (yearly needs a month) |
| yearly, `due_month` 3 | `{ charge_frequency: "monthly" }` | ok, `due_month` cleared automatically |
| yearly, `due_month` 3 | `{ charge_frequency: "monthly", due_month: 5 }` | `400` |
| monthly | `{ due_month: 5 }` | `400` |
| monthly | `{ charge_frequency: "yearly" }` | `400` (no month) |
| monthly | `{ charge_frequency: "yearly", due_month: 5 }` | ok |

- `charge_frequency` (default `monthly`) and `for_accountant` (default `true`) are not nullable:
  `null` → `400`. Every other field accepts `null` to clear it.
- On create, the same rules apply to the defaults with the request merged on top (e.g.
  `{ charge_frequency: "yearly" }` without `due_month` → `400`).

## Backward compatibility

Additive, as the spec says. In practice:

- **"Type without a handler" specs.** `provider_expense` is currently the example of a type
  without a handler (`accounts.e2e-spec.ts`, `account.service.spec.ts`,
  `account-type.registry.spec.ts`). Once this issue lands every type has a handler, so remove
  `provider_expense` from those `400` cases, keep the unknown-type cases (`savings`, `nope`,
  `''`), and make the registry spec resolve all four types. The handler interface is unchanged,
  so regular, debt and investment code is not touched.
- **Migration.** One new migration after `20261108120019` creates
  `bank_provider_expense_details`. Existing migrations and their specs stay untouched.
- **Other account types unchanged.** Their responses and existing specs must pass unchanged.
- **Frontend.** No change here: `accountTypeGuard` treats a type with no section as not found,
  so a provider account deep-linked under the Accounts routes shows "not found" until the
  Providers frontend issue lands.

## Docs

Updated in the same PR as the code (as #50 did):

1. **`docs/agents/specs/banking/accounts/provider-expense.md`** — record this issue's decisions
   next to the rule they refine, marked "(decided in #54)": the `expected_amount` rescale, the
   paired rules on the merged state and the non-nullable `charge_frequency` /
   `for_accountant`.
2. **`docs/agents/specs/banking/accounts/regular.md`** ("Type without a handler on create") —
   all four types are now accepted; only an unknown type → `400`.
3. **`docs/agents/backend/routes/bank.md`** — `provider_expense` in the `type` lists and a
   *Provider-expense object* section (as Debt / Investment).

## Depends on

- #48 (bank module, regular accounts and transactions — backend).

## Acceptance criteria

- The backend *Required tests* of `provider-expense.md` for Account routes and DB are covered
  by Jest specs, and they pass.
- The `security` and `data-access` reviews raise no unresolved violations.
