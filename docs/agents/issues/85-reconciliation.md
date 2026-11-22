# Issue: Reconciliation

## Description

Reconciliation lets the user match an account's ledger against their bank statement. Each reconciliation is a **statement checkpoint** (statement date + statement balance): the user ticks the ledger rows present on the statement, Ward shows the difference live, and finishing (only at difference 0) marks those rows as **cleared** and locks their balance-affecting fields.

This is an **Epic**, delivered spec-first (see *Epic split*).

Origin: deferred by the bank / organization specs of Epic #26, folded into the permanent docs by #58. Related: #29.

Decisions it must respect:

- Balances stay computed from the ledger and the opening anchor (never stored).
- Transactions stay editable and hard-deletable until this exists; this epic decides what a cleared transaction locks.
- Opening anchor: https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/transactions.md#opening-balance-anchor

## Problem

The opening balance is an anchor, so backfilling never changes balances from the anchor onward. The known trade-off: a wrongly backfilled transaction is **silently absorbed** into the history before the anchor instead of surfacing as a mismatch against the bank statement. Ward also has no way to record that the ledger agreed with the bank at a given date, so nothing protects already-verified rows from later edits or deletes.

## Expected Behavior

- On any account (all four types, not archived), the user can start a reconciliation for a statement date and balance, tick the matching ledger rows, see the live difference, and finish only when it is 0.
- Rows cleared by a finished statement have `amount`/`date` locked and cannot be deleted (409 `TRANSACTION_CLEARED`); description and notes stay editable.
- Mistakes surface: uncleared rows dated inside an already reconciled period carry a warning badge, and the next reconciliation shows them as a difference.
- The latest finished statement can be undone (reopened), which unlocks its rows.

## Solution

### Scope

**In scope — flag + statement checkpoint:**

- A per-transaction cleared marker on `Transaction`: a nullable `reconciliationId` FK to the statement that ticked it (see statement lifecycle).
- A per-account **statement checkpoint** record (`Reconciliation` / statement): `statementDate`, `statementBalance`, `reconciledAt`.
- Reconcile workflow: the user starts a reconciliation for a statement date and balance, ticks the ledger rows present on the statement, and Ward shows the **difference** (statement balance − cleared balance) live. Finishing is only allowed at difference 0, and stamps the ticked rows as cleared by that statement.
- A mismatch — e.g. a wrongly backfilled transaction absorbed by the opening anchor — therefore surfaces as a non-zero difference instead of passing silently.
- Rows reconciled into a finished statement are the natural candidates for locking (exact lock rule decided separately).

**Out of scope:**

- Statement import (OFX/CSV upload, automatic matching).
- Cross-account / linked-transfer reconciliation (#86).
- Currency conversion (#88).
- Auto-creating missing transactions from the statement.

**Alternatives considered:**

- *Flag only* (cleared flag + cleared balance, compared by eye) — rejected: Ward never knows the statement balance, so it cannot surface a mismatch itself.
- *Flag + statement + import* — rejected for this epic: parsers, fuzzy matching and an upload surface are a much larger, separate concern.

### Edge cases

- **Rows before the opening anchor** — a statement's cleared balance is computed from the anchor: only transactions dated on or after `openingDate` can be cleared, and `statementDate` must be on or after `openingDate`. The backfilled history before the anchor stays unreconcilable.
- **Editing the opening anchor** — once any finished statement exists on the account, `openingDate` and `openingBalance` are locked (409 `ACCOUNT_RECONCILED`); undo the statements first to change them.
- **Backfilling into a reconciled period** — allowed. The new transaction stays uncleared, the next reconciliation surfaces it as a difference, and the ledger shows a warning badge on uncleared rows dated on or before the last finished `statementDate`.
- **Archived accounts** — no starting, finishing or undoing a reconciliation (409 `ACCOUNT_ARCHIVED`); existing cleared marks stay visible.
- **Payment-generated transactions** — clearable like any row. While such a transaction is cleared, undoing or deleting the bill payment that generated it is blocked (409), consistent with the lock rule.
- **Provider-expense accountant hand-off** — `sentToAccountantAt` and the cleared marker are independent; no interaction.
- **Currency change** — no change needed: currency is already locked once any transaction exists.
- **Zero-row statement** — allowed (confirms a period with no activity).
- **Same-day ordering** — a statement covers rows dated on or before `statementDate`; same-day rows not yet posted by the bank are simply left unticked. No time-of-day handling.
- **Concurrency** — one open reconciliation per account; starting a second answers 409.

### What "cleared" locks

A transaction cleared into a **finished** statement:

- **`amount` and `date` are locked** — a `PATCH` that actually changes either answers 409 `TRANSACTION_CLEARED` (sending the unchanged value is accepted, so forms that send every field keep working).
- **`description` and `notes` stay editable.**
- **Delete is blocked** — 409 `TRANSACTION_CLEARED`.
- **No role bypasses the lock**, `admin` included; the only way to change a locked field or delete the row is to undo the statement first (see statement lifecycle), fix it, and reconcile again.
- **Payment-generated transactions** follow the same lock, plus the rule that the generating bill payment cannot be undone or deleted while its transaction is cleared.

Rows merely ticked in an **open** reconciliation are not locked: they stay editable and deletable, and the live difference updates accordingly.

Alternatives considered:

- *Full lock* (no edit at all) — rejected: blocks harmless typo fixes in description/notes.
- *Soft lock* (edit allowed, row un-cleared, statement flagged broken) — rejected: reintroduces the silent drift this epic exists to remove.

### Statement lifecycle

States: **`open`** → **`finished`**; undoing a finished statement returns it to `open`.

- **Start** — `statementDate` + `statementBalance`. Rules: at most one `open` statement per account (409); `statementDate` ≥ `openingDate`; `statementDate` strictly after the last finished statement's date (409 — statements stay chronological); `statementDate` at most UTC today + 1 day.
- **While open** — the user ticks/unticks rows dated ≥ `openingDate` and ≤ `statementDate` not already cleared by an earlier statement. `statementDate` and `statementBalance` stay editable; moving `statementDate` earlier automatically unticks rows that fall outside it. Ticks are persisted server-side (resume later; other organization members see the same state).
- **Difference** — `statementBalance` − (opening anchor + SUM of cleared rows + SUM of ticked rows). The cleared balance is always anchor + SUM(all cleared rows); no per-statement opening balance is stored.
- **Finish** — only when the difference is 0 (otherwise 409 `RECONCILIATION_UNBALANCED`); stamps `reconciledAt`, and its rows become cleared and locked.
- **Undo** — only the **latest** finished statement, and only when no statement is `open` (cancel it first). Undo reopens the statement keeping its ticks; its rows unlock.
- **Cancel** — an `open` statement can be deleted, dropping its ticks. A finished statement must be undone first.
- **Editing a finished statement** — not allowed; undo (reopen) it, then edit.
- **History** — a per-account list of statements (date, balance, `reconciledAt`, row count), newest first, using the standard `pagination` block. No audit log in this epic.

**Storage** — ticks are a nullable `reconciliationId` FK on `Transaction`: a row is *ticked* when linked to the `open` statement and *cleared* when linked to a `finished` one. Undo is a state change only.

### UI workflow

Built on the shared `bank/common` detail page and ledger, so it works for every account type without per-type copies.

- **Entry point** — a **Reconcile** button in the detail header (next to Edit / Archive), hidden on archived accounts and role-gated. With an `open` statement it reads **Continue reconciliation**.
- **Start** — a small form with **Statement date** (defaults to today, no future dates) and **Statement balance** (same amount input as the ledger, in the account's currency). On a **debt**, the statement balance is typed as the positive amount owed and negated, like its opening balance.
- **Reconcile mode** — on the same detail page, not a separate page:
  - a sticky **summary bar** above the ledger: statement date, statement balance, cleared balance, **Difference** (highlighted unless 0), and the actions **Finish** (enabled only at 0), **Edit statement**, **Cancel**;
  - a **checkbox column** on the ledger, enabled only for eligible rows (≥ `openingDate`, ≤ `statementDate`, not cleared by an earlier statement); ineligible rows dimmed, no checkbox on the opening row;
  - a **Show only uncleared** toggle (local filter on the eligible range, independent of #90);
  - **tick all on page / untick all** shortcuts;
  - each tick is saved immediately (optimistic toggle, reverted on error); the server's response returns the updated difference;
  - the inline transaction form stays usable, so a missing transaction can be added and ticked on the spot.
- **Normal ledger** — cleared rows show a **✓ cleared** marker (tooltip with the statement date); their amount and date are read-only in inline edit and Delete is hidden (the server's 409 remains the backstop). Uncleared rows dated on or before the last finished `statementDate` show a warning badge (e.g. "Not on reconciled statement of 31 Oct"). The header shows **Last reconciled: <date> · <balance>** under the current balance.
- **History** — a **Statements** section on the detail page: date, balance, `reconciledAt`, row count, newest first, paginated. The latest finished statement has an **Undo** action (confirmation modal), available only when no statement is open.
- **Errors** — `RECONCILIATION_UNBALANCED`, `TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED` and the other 409s go through the existing error alert with friendly messages.

Out of scope for this epic: drilling from a statement in the history to a ledger filtered to its rows.

### Epic split

This is an Epic, delivered in the project's spec-first sequence:

1. **Initial spec writing** — turn the decisions above into reconciliation specs (data model, routes, lifecycle, lock rules, UI).
2. **Spec enhancement issues** — one or more issues refining the specs and answering the concerns not settled here: roles (who may start, tick, finish, undo, cancel), backward compatibility / migration, testing strategy, performance & security, owning module, memory footprint, caching (cache class of each new route, Navi warming), mismatch surfacing beyond the difference bar and warning badge, and checkpoint-anchors as an alternative.
3. **Create the implementation issues** — an issue whose job is to break the finished specs into implementation sub-issues (backend, frontend, cache, …).
4. **Fold specs into permanent docs** — fold the specs into `docs/agents/modules/bank/` (and related docs) as needed, and remove the temporary specs.

## Benefits

- Wrong or missing transactions surface as an explicit difference against the bank statement instead of being absorbed by the opening anchor.
- Verified history is protected from accidental edits and deletes, with an explicit undo path.
- The user (and organization members) can see when an account was last reconciled and at what balance.
