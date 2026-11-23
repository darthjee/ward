# Create the issues, link them to #85 and order them

Push each draft, in order 1 to 5, as a native sub-issue of #85:

```bash
<arcanum-split-issue>/scripts/create_sub_issue.sh "$REPO_PATH" 85 docs/agents/issues/85_0N_<slug>.md
```

Record the `ID=` of each one. Before you start, list #85's sub-issues
(`gh api graphql` `subIssues` on issue 85) so that a re-run never creates a duplicate.

After all five exist:

- Edit the bodies of issues 2 to 5 (`gh issue edit <n> --body-file ...`) so that their
  dependencies use real numbers (`Depends on #<1>`, and so on). Also edit #157's body, or add a
  comment, to state that it depends on the five new issues.
- Reorder #85's sub-issues so that the five new ones sit before #157
  (`gh api -X PATCH repos/darthjee/ward/issues/85/sub_issues/priority` with `sub_issue_id` /
  `before_id`, using the issues' REST `id`, not their number). This step is best effort: if the
  API refuses, note it in the PR description and continue.
- Check the result: #85 lists #152 to #157 plus the five new issues, each new one has the
  `Spawned` label, and none carries a pipeline label from #156 (`Refined`, `Ready`, ...).

Then delete the local `docs/agents/issues/85_*.md` drafts.

## Files to Change

- None in the repository. GitHub only: five new issues, body edits, #85's sub-issue order, and
  #157's dependency note.
