# Update the provider-bills UI spec doc

Update the "## Provider list column" section of
`docs/agents/specs/split-provider/ui/provider-bills.md` to match the shipped behaviour. This doc
lives under `docs/agents/` (architect scope), but the issue asks for it as part of this change.
- Change the example to `3 bills · R$ 250,00 / month + R$ 1.200,00 / year` (spaced `/ month` /
  `/ year` wording, matching `formatExpected`). It currently reads `/mo` / `/yr`.
- Keep the existing rules: zero parts are omitted, recurring bills without `expected_amount` count
  toward N but not the sums, one-offs are excluded from the sums, `—` with no bills, and sums are
  in the provider's single currency.
- Add these rules:
  - `null` and `"0.00"` sums both count as zero.
  - A missing `bills_summary` gives an **empty** cell, not `—`.
  - The cell is right-aligned.
  - Each part stays whole on one line and the cell wraps only between parts.
  - Archived providers follow the same rules.
  - Singular `1 bill` and plural `N bills`.

## Files to Change
- `docs/agents/specs/split-provider/ui/provider-bills.md`: "Provider list column" section
