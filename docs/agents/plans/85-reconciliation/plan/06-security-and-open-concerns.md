# Security, open concerns and testing

Write `docs/agents/specs/reconciliation/security.md` and finish the README's testing
overview.

**Decided content:**

- **Ownership** — statements inherit the owner through their account and never store an owner
  column. Every route resolves the account owner-scoped first (uniform 404 for a foreign,
  wrong-context or non-member id; global `is_admin` gets no bypass). A ticks body may only
  name transactions of the same account: a foreign id → 404 and the whole batch is rejected.
- **Data sensitivity** — statement balances are financial data. Bodies are never logged.
  Statement responses never contain owner fields.
- **Input bounds** — ticks arrays at most 50 ids each, ids through `parseId`-style
  validation, amounts at most 10¹³ minor units, dates ≤ UTC today + 1 day.
- **Cache** — no route is `public`. GETs are `user-scoped`, writes `never` with
  `InvalidatesOwner()`. Navi warms nothing.
- **Memory / module** — owned by the lazy `bank` module. It adds no dependency and no
  always-on code beyond one resident controller. The difference is a single `SUM` query, not
  in-memory work, so it fits the 512 MB Render tier.

**`## Open concerns`** — the concerns the epic defers to phase 2. Each gets a recommended
default marked *provisional*:

- **Roles** — start, edit, tick and finish need `user` (everyday writes); cancel and undo need
  `admin` (they discard or reverse, like every DELETE and payment undo).
- **Backward compatibility / migration** — the change is additive with no backfill (see
  `model.md`). The only behaviour change for existing users is the anchor lock, and it starts
  only after their first finished statement.
- **Performance** — the indexes `(reconciliation_id)` and `(account_id, statement_date)`. The
  ledger `LEFT JOIN` adds one indexed lookup per row. Worst case of the cleared-balance `SUM`
  is the account's whole ledger, the same as `currentBalance()`.
- **Mismatch surfacing beyond the difference bar and the badge** — recommend none in this
  epic (no notifications, no account-list badge).
- **Checkpoint anchors as an alternative** (each finished statement becomes a new anchor for
  balances) — recommend rejecting: it would change the computed balance model. Keep it listed
  for phase 2 to confirm.
- **Account list payload** — whether `last_reconciliation` / `open_reconciliation_id` are
  needed on the list, or only on the detail.

**README testing overview** — a table mapping each future implementation area (migration,
reconciliation API, locks on existing routes, frontend reconcile mode, frontend ledger and
history) to the Required tests named in the other files. Also note that the existing
`accountant.e2e-spec.ts` and bill-payment specs must stay green.

Then check every file in `docs/agents/specs/reconciliation/`:

- it ends with Reference (GitHub URLs only, never local paths) and Required tests;
- it links back to the README;
- it uses error codes consistent with the API files.

## Files to Change
- `docs/agents/specs/reconciliation/security.md` — new; ownership, sensitivity, bounds, cache, memory, open concerns.
- `docs/agents/specs/reconciliation/README.md` — add the testing overview and link to the open concerns.
