# Consult the reviewer agents

Before writing any concern file, dispatch the four read-only reviewer agents in parallel, each
with the epic body of #119 (`gh issue view 119`), the issue file, and the specific question for
its concern. Their answers become the decisions written in steps 03–07; record any revision of
the epic's starting positions.

- **`product-owner`** — confirm the product decision to reverse "No standalone recurring bills"
  (`modules/bank/bills.md`), the "one provider, N bills" concept, `for_accountant` staying on the
  provider, the provider-list "N bills · sums per frequency" column, and the Future epics list
  (per-transaction bill link; archiving an individual bill while keeping its history; combined
  calendar across owners #101 against the new occurrence shape).
- **`security`** — confirm or revise the epic's *Performance and security* section: owner-scoped
  uniform `404` (unknown / foreign / other-context / archived-provider / debt ids),
  `provider_account_id` locked on `recurring` bills (`409 PROVIDER_BILL_PROVIDER_LOCKED`),
  one-offs movable unless paid, `:dueDate` validated per bill (generator check vs `due_date`
  equality), `FOR UPDATE` lock per bill, `PayingAccountResolver` generic `422`, the 50-recurring
  cap (`409 PROVIDER_BILL_LIMIT`), the existing 366-day / 1000-occurrence caps checked on
  occurrences, the single-query calendar load and the indexes, and `notes` never in occurrence
  payloads.
- **`data-access`** — confirm the visibility rules: personal provider bills owner-only, global
  admin gets no access, every org member has full access on `/orgs/:orgId/bank` until #81;
  response fields of `ProviderBill` and `source_bill: { id, description }`; the transition
  payload of provider-expense details (schedule fields read from the single recurring bill,
  `null` with zero or several).
- **`cache`** — confirm the cache class of every new / changed route (GETs `user-scoped` via
  `OwnerScopedController`, writes `@CachePolicy(CacheClass.Never)` with `InvalidatesOwner()`),
  that the owner-prefix invalidation (`/bank` or `/orgs/:id/bank`) covers the new
  `provider-bills/...` paths and the aliases, and that Navi warms none of them.

## Files to Change

- None (read-only consultation; findings feed steps 02–07).
