# Delete the spec folder and close the lifecycle

1. Check that every lasting point from `model.md`, `security.md`, `api/*.md` and `ui/*.md` now
   lives in a permanent doc. Then run `git rm -r docs/agents/specs/split-provider/`.
2. **`docs/agents/specs.md`:**
   - Remove the row from *Active specs*. The table then reads "none", the same way the
     lifecycle text describes it.
   - Add a *Completed specs* row:
     - Feature: "Split provider: a provider holds N recurring / one-off provider bills; specs
       were `specs/split-provider/`, removed by #126".
     - Folded into: [modules/bank/bills.md](modules/bank/bills.md),
       [modules/bank/provider-expense.md](modules/bank/provider-expense.md),
       [modules/bank/ui.md](modules/bank/ui.md),
       [backend/routes/bank.md](backend/routes/bank.md), [product.md](product.md).
     - Epic: [#119](https://github.com/darthjee/ward/issues/119).
     - Follow-up epics: the two step 01 epics plus
       [#101](https://github.com/darthjee/ward/issues/101).
3. **Link sweep:** run `grep -rn "specs/split-provider" docs/ AGENTS.md README.md CLAUDE.md`.
   Only `docs/agents/issues/` and `docs/agents/plans/` may still match. Also grep `bank_bills`
   and "seven thin resident controllers" across `docs/agents/` (excluding `issues/` and
   `plans/`), and fix any leftovers, e.g. `summary.md` descriptions of the bank pages if they
   say "derived from provider schedules".

## Files to Change
- `docs/agents/specs/split-provider/` — deleted (all 8 files).
- `docs/agents/specs.md` — Active specs → "none"; new Completed specs row.
- `docs/agents/summary.md` (if needed) — page descriptions that still describe one schedule per provider.
