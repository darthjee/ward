# Delete the spec folder and move its specs.md entry

Delete `docs/agents/specs/deploy/`. In `docs/agents/specs.md`, set *Active specs* to "none" and
add the deployment row to *Completed specs*, pointing at `deployment.md` and Epic #10. Then grep
the repo for `specs/deploy` to confirm nothing links to it any more (the issue and plan files
for #16 excepted; they are removed on merge).

## Files to Change
- `docs/agents/specs/deploy/` — deleted
- `docs/agents/specs.md` — entry moved to *Completed specs*
