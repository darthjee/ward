# Apply the Required tests gap review and name the lifecycle e2e spec

Using the confirmed gaps from step 01, add each missing case to the Required tests section of the
file that owns the rule (not all to one file):

- lifecycle and formula gaps → `model.md` § Required tests (units) or `api/reconciliations.md`
  § Required tests (e2e of the reconciliation routes);
- lock-matrix and anchor/currency-lock gaps → `api/existing-routes.md` § Required tests;
- bound, ownership and cache gaps → `security.md` § Required tests;
- UI gaps → `ui/reconcile.md` or `ui/ledger.md` § Required tests (Jasmine only).

Then name the dedicated lifecycle e2e spec in `api/reconciliations.md` § Required tests, as a
separate bullet from `reconciliations.e2e-spec.ts`. Suggested name:
`backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts` (or the name the `backend` agent
recommended). It runs one scenario under **both** base paths (`/bank` and `/orgs/<id>/bank`):

1. start a statement;
2. tick and untick rows, checking the live difference;
3. finish at difference 0;
4. the locks on the cleared rows: PATCH `amount`/`date` → 409 `TRANSACTION_CLEARED`, DELETE →
   409, a description edit allowed, and the anchor/currency lock on the account → 409;
5. undo (the rows unlock, and the ticks are kept on the reopened statement);
6. cancel (the ticks are dropped, the rows are uncleared, and the anchor lock is released when
   no statement remains).

State that `reconciliations.e2e-spec.ts` keeps per-route, per-error-code and check-order
coverage, while the lifecycle spec covers the end-to-end flow. Also state that neither spec
changes `accountant.e2e-spec.ts` or the bill-payment specs.

In `ui/reconcile.md` and `ui/ledger.md`, keep the "Jasmine specs mirroring the source paths"
framing, add any confirmed UI gaps, and state explicitly that the frontend adds no e2e tooling.

## Files to Change

- `docs/agents/specs/reconciliation/api/reconciliations.md`: the new lifecycle e2e spec bullet,
  plus any confirmed route/lifecycle gaps.
- `docs/agents/specs/reconciliation/api/existing-routes.md`: confirmed lock-matrix and
  anchor/currency-lock gaps.
- `docs/agents/specs/reconciliation/model.md`: confirmed unit gaps (formulas, eligibility,
  auto-untick past `statementDate`).
- `docs/agents/specs/reconciliation/security.md`: confirmed bound, ownership or cache gaps, if
  any.
- `docs/agents/specs/reconciliation/ui/reconcile.md`: confirmed reconcile-mode Jasmine gaps.
- `docs/agents/specs/reconciliation/ui/ledger.md`: confirmed ledger/history Jasmine gaps.
