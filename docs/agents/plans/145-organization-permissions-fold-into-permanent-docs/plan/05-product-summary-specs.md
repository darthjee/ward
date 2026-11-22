# Product, summary and specs hub
Update the high-level wording and mark #81 as folded.

- **`docs/agents/product.md`** — line ~71: "roles are stored but not enforced" → roles are
  enforced (reads for every member; everyday writes `user`; destructive/structural `admin`).
  "What's still open" (~141): drop the "stored but not enforced until #81" sentence (the
  remaining open items are member management #82 and closing #83). Line ~134 "(#81–#104)": keep
  the range wording accurate (#81 is closed by this PR — e.g. "#82–#104").
- **`docs/agents/summary.md`** — Organizations entry: "roles (stored, not enforced)" → "roles
  enforced per action (`@MinOrgRole`, `can` / `useCan`)".
- **`docs/agents/specs.md`** — Folded table: add a row "Organization permission system
  (owner/admin/user enforced); built by #143 and #144, folded by #145" → folded into
  `modules/auth/organizations.md`, `backend/routes/auth.md`, `backend/routes/bank.md`,
  `modules/bank.md`, `architecture/frontend.md`; Epic #81; follow-ups #148 (and #82, #95). In
  the Organizations row, remove #81 from the follow-up epics (or mark it folded with a link to
  the new row).

## Files to Change
- `docs/agents/product.md` — role wording, open items
- `docs/agents/summary.md` — Organizations entry
- `docs/agents/specs.md` — folded row for #81, Organizations row
