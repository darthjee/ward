# Update the README sub-issue map

Edit `docs/agents/specs/reconciliation/README.md`:

- **§ Sub-issue → file map**: replace the sentence "The implementation sub-issues do not exist
  yet; phase 3 creates them. The rows are TBD." with one saying that phase 3 (#156) created
  them. Replace every TBD row with a link to the issue
  (`[#N](https://github.com/darthjee/ward/issues/N) — backend migration and entity`) and the
  confirmed file list from step 01, without "likely". Add a **Depends on** column
  (1: —; 2: #1; 3: #1; 4: #2; 5: #3; fold #157: all five). Change the fold row to
  `[#157](https://github.com/darthjee/ward/issues/157)`, reading all files and § Future epics.
- Replace the "likely split suggested for phase 3 to confirm" list with the confirmed order:
  #1 → #2 and #3 in parallel → #4 (after #2) and #5 (after #3) → #157. Backend before frontend.
  State that no cache/Navi issue was created, because Navi warms nothing for this feature.
- **§ Delivery, item 3**: link #156 and mark it complete, naming the five issues.
- Leave the other sections alone (the Testing overview table already maps the Required tests).

All links must be GitHub web URLs, following the specs convention in `docs/agents/specs.md`.
`docs/agents/specs.md` itself does not change: the Active specs row stays until #157.

## Files to Change

- `docs/agents/specs/reconciliation/README.md` — sub-issue map, phase-3 order and Delivery item 3.
