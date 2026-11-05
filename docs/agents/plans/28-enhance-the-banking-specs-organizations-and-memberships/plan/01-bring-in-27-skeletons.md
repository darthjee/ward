# Bring in #27's spec skeletons

#28 refines files that #27 creates, and #27 is not merged yet. Before any edit, make the #27
skeletons available on `issue-28`:

1. `git fetch origin`.
2. If #27 has been merged into `origin/main`, rebase `issue-28` onto `origin/main`.
3. Otherwise, rebase `issue-28` onto `origin/issue-27`, so the #28 PR is stacked on #27. Say so
   in the PR description ("depends on #27; merge #27 first"). Once #27 merges, rebase onto
   `main` again.
4. Check that `docs/agents/specs/auth/organizations.md`, `docs/agents/specs/auth/README.md` and
   `docs/agents/specs/banking/README.md` exist, and re-read them. If their section headings or
   index rows differ from what this plan quotes, adapt the later steps to the actual text.

This step only changes git history. No file is edited.

## Files to Change
- None. This step rebases the branch onto #27's spec skeletons.
