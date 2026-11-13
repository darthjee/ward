# Remove the spec folders and update `specs.md`

Finish the lifecycle.

1. **Check the fold is complete.** Go through each spec file heading by heading (the list is
   in the [plan Context](../plan.md#spec-files-and-where-each-one-goes)). Confirm that every
   lasting decision has a home in the new pages, and every divergence is recorded.
2. **Delete the folders** with `git rm -r docs/agents/specs/banking docs/agents/specs/auth`.
3. **Update `docs/agents/specs.md`**:
   - *Active specs*: replace both rows with a single "none" line, as the hub describes.
   - *Completed specs*: add two rows in the same style as the existing ones:
     - **Bank module** (`bank`: accounts, business expenses, bills); specs were
       `specs/banking/`, removed by #58. Folded into:
       - `modules/bank.md` and `modules/bank/`;
       - `backend/routes/bank.md`;
       - `product.md`.

       Epic #26. Follow-up epics: issues 5–24 from step 01.
     - **Organizations** (`auth` module); specs were `specs/auth/`, removed by #58. Folded
       into:
       - `modules/auth/organizations.md` and `modules/auth.md`;
       - `backend/routes/auth.md`;
       - `product.md`.

       Epic #26. Follow-up epics: issues 1–4 from step 01.

     Write the spec folder names as plain text (`specs/banking/`), not as links. Like the
     existing rows, `specs.md` is the one place that may name the removed folders.
4. **Run the acceptance check** over tracked files:
   `git grep -n "specs/banking\|specs/auth" -- AGENTS.md .claude .github docs/agents ':!docs/agents/issues' ':!docs/agents/plans'`.

   Only `docs/agents/specs.md` may match. The issue's literal grep expects nothing at all, so
   check whether the Completed specs rows trip it. If they do, rephrase them, for example
   "specs were the `banking` and `auth` feature folders", so the grep returns nothing. Also
   check for broken relative links into the deleted folders:
   `grep -rn "specs/" docs/agents --include=*.md` should match only `specs.md` links and
   `frontend/specs` paths.

## Files to Change
- `docs/agents/specs/banking/` — delete (all files)
- `docs/agents/specs/auth/` — delete (all files)
- `docs/agents/specs.md` — Active specs reads "none"; two new Completed specs rows with follow-up epics
