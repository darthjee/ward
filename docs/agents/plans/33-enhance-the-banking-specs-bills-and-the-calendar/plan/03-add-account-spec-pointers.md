# Add pointers in the account specs

The issue limits the account specs to **one-line pointers to `bills.md`**. Do not rewrite their
field tables, routes or tests. Each edit replaces the "left to #33" or "flagged for #33" wording
with a short "Resolved by #33 — see bills.md#..." pointer. Do this after step 01, so the anchors
already exist.

- `accounts/debt.md`:
  - `## Instalments and bills` (around line 110): replace the "left entirely to #33" sentence
    with a one-line pointer to `../bills.md` (recurrence model / schedule fields). Keep the
    bullet list of exposed fields.
  - `dueDay` row in the Fields table (line 76): change "(applied by #33)" into a pointer to the
    clamp rule in `../bills.md#recurrence-model`.
  - Edge case 9 (around lines 266–267): turn it into a one-line pointer saying the clamp is
    defined in `bills.md`.
  - The `## Resolved questions` entry (around line 274) may get a link to `bills.md` as well.
- `accounts/provider-expense.md`:
  - `## Charges and bills` (around line 193): replace "left entirely to #33" with a pointer to
    `../bills.md`. Replace the "**Flagged for #33:** whether paying a bill records a charge, a
    payment, or both" sentence with a one-line resolution pointer: paying records a payment plus
    an optional charge ("Also record the charge"); see `../bills.md#paying-a-bill`.
  - `dueDay` row (line 93): the same clamp pointer as in debt.md.
- `accounts/regular.md`:
  - The "**No events** emitted or consumed for now; bills (#33) decide…" bullet (around lines
    212–214) becomes "No events emitted or consumed; paying a bill is an in-module service call
    in one DB transaction (see `../bills.md#owning-module`)."

## Files to Change
- `docs/agents/specs/banking/accounts/debt.md` — pointers in *Instalments and bills*, the
  `dueDay` row, edge case 9 (clamp).
- `docs/agents/specs/banking/accounts/provider-expense.md` — pointers in *Charges and bills*
  (charge-vs-payment resolved) and the `dueDay` row.
- `docs/agents/specs/banking/accounts/regular.md` — the event vs direct call bullet points to
  `bills.md`.
