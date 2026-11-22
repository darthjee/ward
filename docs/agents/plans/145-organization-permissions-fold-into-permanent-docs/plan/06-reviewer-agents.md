# Reviewer agents
Teach the read-only reviewers the role rules so every new endpoint is checked.

Checks to add (same list in each place):
1. every owner-scoped write route declares a minimum role (`@MinOrgRole`); org routes outside
   the owner-scoped mechanism check it in the service (as `OrganizationService.rename`);
   record-dependent rules (payment-generated transactions) check it in the service and fail
   closed;
2. the role never comes from input — only the DB membership via `findRole`, re-read each
   request;
3. the non-member 404 comes before any 403;
4. the 403 body is uniform (`FORBIDDEN` / `Forbidden`, no resource or role named);
5. there is no `is_admin` bypass.

- **`.claude/agents/data-access.md`** — "User-or-organization-owned modules" list: add items
  for the checks above; reference `organizations.md` → Roles / Security rules.
- **`.claude/agents/security.md`** — "What to check" → authorization gaps: add the org-role
  checks; "Ward's current surface" if it lists guards, add `@MinOrgRole`.
- **`docs/agents/modules/auth/organizations.md`** — the "`data-access` checks" subsection gets
  the same items (coordinate with step 01).
- **`docs/agents/architecture/security.md`** — optional short "Organization roles" section
  linking to organizations.md, if it fits the page's scope.

`.claude/agents/*.md` has no specialist owner, so the architect edits it as fallback owner.

## Files to Change
- `.claude/agents/data-access.md` — role checks
- `.claude/agents/security.md` — role checks
- `docs/agents/modules/auth/organizations.md` — `data-access` checks subsection
- `docs/agents/architecture/security.md` — optional pointer
