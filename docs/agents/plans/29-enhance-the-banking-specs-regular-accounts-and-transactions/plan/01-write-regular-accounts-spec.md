# Write accounts/regular.md

Rewrite `docs/agents/specs/banking/accounts/regular.md` from the skeleton into the agreed
definition of regular accounts and of the **fields and rules common to every account type**.
Content must match the issue's `## Solution` exactly. Suggested sections:

1. **Banner** — "Owned by #29"; note that debt / investment / provider-expense files (#30–#32)
   add only their type-specific fields and reuse everything here.
2. **Summary / Decisions** — keep the existing decisions (type `regular`, belongs to an
   organization, only type in the main list, defines the common fields).
3. **Common account fields** — the full table from the issue (`id`, `organizationId` from the
   URL never the body, `type` fixed after creation, `name` trimmed / max 255 / unique within the
   organization case-insensitively among non-archived accounts, `bankName`, `branch`,
   `accountNumber` masked in lists `•••• 1234`, `currency` (link to the Currency rules in
   `transactions.md`), `archivedAt`, `notes`, `createdByUserId`, `createdAt`/`updatedAt`). Add
   the length limits (`name` 255; `bank_name`, `branch`, `account_number` 64; `notes` 2000;
   over → 400, never truncated). Mention that `openingDate` / `openingBalance` are added by
   `transactions.md` for ledger-carrying types (link).
4. **Name uniqueness** — DB-enforced via generated column
   `active_name_key = IF(archived_at IS NULL, LOWER(name), NULL)` + unique index on
   `(organization_id, active_name_key)`; duplicate key → 409 on create / rename / unarchive.
5. **Archive vs delete** — archive / unarchive semantics, hidden by default with *Show
   archived*, still reachable, read-only while archived (only unarchive and rename), unarchive
   409 on name clash; hard delete only with no transactions (opening anchor does not count),
   else 409 pointing to archive; DB `ON DELETE RESTRICT` covers the race; no cascade delete.
6. **Accounts submenu UI** — List, Detail, Create / Edit pages exactly as in the issue (routes
   `/orgs/:orgId/bank/accounts…`, columns, sort by name, no pagination, empty state, detail
   header and actions, archived banner, ledger summary linking to `transactions.md` for
   ledger behaviour, inline transaction form, create/edit fields, currency select defaulting
   to `BANK_DEFAULT_CURRENCY`, locked once there are transactions, opening defaults, `type`
   hidden).
7. **Routes and permissions — Accounts** — the Accounts routes table (method, route, purpose,
   cache class) plus the shared *Rules* (JWT, `/api/orgs/:orgId/bank`, `@OrgScoped()`, `.json`,
   404-never-403, server-side masking in the list, bodies never accept `organizationId` /
   `accountId` / `createdByUserId` / `type` on PATCH / computed fields, whitelist
   `ValidationPipe`, every member can do everything while roles are not enforced,
   `snake_case`). State that `transactions.md` reuses these rules.
8. **Data sensitivity & ownership** — financial data; members only, global admin gets no
   access; never stored: bank credentials, card numbers, CVVs, no bank connections; account
   number not encrypted at rest (rationale, TLS #11); `createdByUserId` stored, not returned;
   bodies never logged (method, route, status only).
9. **Owning module** — `bank` lazy tier, `bank_` prefix, `bank_accounts`; lazy loading via
   `LazyModuleLoaderService#loadOnFirstRequest()`; depends on `auth` only through
   `@OrgScoped()`; logical references for `organization_id` / `created_by_user_id`; no events;
   `modules/bank.md` is created by the fold issue. Also *Backward compatibility* (none) and
   *Memory footprint* (no idle cost, `Intl` for currency data).
10. **Edge cases** — the account-related ones: name clash → 409, archived account edits other
    than `name` → 409, currency change with transactions → 409, delete with transactions →
    409, over-long fields → 400, unknown / foreign / non-numeric ids → 404, last write wins.
11. **Alternatives considered** — the account-side rejected options: cascade delete (vs
    archive), field-level encryption of the account number (vs plain).
12. **Reference** — Epic #26, owning sub-issue #29, #28 and #11 by URL, and the GitHub web
    URLs of `auth/organizations.md` and `specs.md`.
13. **Required tests** — derive from the rules, grouped (backend API / frontend UI), e.g.:
    - create: defaults (`type` regular, currency from `BANK_DEFAULT_CURRENCY`), non-`regular`
      type → 400, missing/blank/over-long name → 400, unknown fields → 400, `organizationId`
      taken from the URL;
    - name uniqueness: case-insensitive clash among active accounts → 409 on create, rename,
      unarchive; archived names do not clash;
    - list: regular only, sorted by name, archived hidden unless `archived=true`, account
      number masked, balance per account (single grouped query), `createdByUserId` absent;
    - detail: full account number, current balance; foreign / unknown / non-numeric id → 404;
    - PATCH: `type` rejected; currency change with transactions → 409; archived account only
      accepts `name` (else 409);
    - archive / unarchive; delete with no transactions succeeds, with transactions → 409;
    - every route rejects non-members (404) and has its documented cache class / `X-Skip-Cache`;
    - UI: list columns, *Show archived* toggle, empty state, detail actions (Delete only when no
      transactions, archived banner with Unarchive / Rename only), create / edit form defaults
      and currency lock.

## Files to Change

- `docs/agents/specs/banking/accounts/regular.md` — replace the skeleton with the full spec.
