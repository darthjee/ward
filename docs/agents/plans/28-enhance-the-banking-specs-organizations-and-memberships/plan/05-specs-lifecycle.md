# Describe the Future-epics lifecycle rule in specs.md

Update the permanent hub `docs/agents/specs.md` so that deferred work survives a spec's
removal:

- **Conventions**: add a bullet saying a feature's `README.md` may have a `## Future epics`
  section. It lists every concern the specs defer, with enough detail to seed an epic.
  Deferred concerns are recorded there and **not** opened as GitHub issues while the spec is
  active.
- **Lifecycle**: between the current step 3 (fold into permanent docs) and step 4 (delete the
  folder), add a step: **before the spec folder is removed, create a GitHub epic for each entry
  in its Future epics section**. Renumber the following step. Also say that the created epics'
  URLs are recorded where the lasting docs mention the deferred concern, and in the
  [Completed specs](#completed-specs) entry, e.g. in a new "Follow-up epics" column or in the
  Folded-into cell. Pick one option and apply it to the table header. Fill the existing rows
  with "—".
- Keep the rest of the file unchanged, including the Active specs table added by #27.

## Files to Change
- `docs/agents/specs.md` — Future epics convention, the new lifecycle step, and where the
  follow-up epic links are recorded in Completed specs.
