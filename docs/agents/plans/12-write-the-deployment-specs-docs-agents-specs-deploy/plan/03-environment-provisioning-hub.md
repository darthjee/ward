# Environment, provisioning and specs hub entry

Write `environment.md` (every variable and host-only file, grouped by CircleCI project, Render
service and SSH host files, with purpose and reader) and `provisioning.md` (manual checklist for
the Render service, SSH host and CircleCI variables, first tag, #10 acceptance criteria). Then
replace "none" under *Active specs* in `docs/agents/specs.md` with an entry for
`specs/deploy/` linking Epic #10.

## Files to Change
- `docs/agents/specs/deploy/environment.md` — new
- `docs/agents/specs/deploy/provisioning.md` — new
- `docs/agents/specs.md` — add the *Active specs* entry
