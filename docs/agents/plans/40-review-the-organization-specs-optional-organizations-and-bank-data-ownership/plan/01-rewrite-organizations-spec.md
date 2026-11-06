# Rewrite the organizations spec

Rewrite `docs/agents/specs/auth/organizations.md` so that organizations are optional and the
generic user-or-organization-owned contract is defined. `auth` must stay free of bank details:
no `bank_accounts` column names and no bank route list here, only "e.g. `bank`".

Section by section:

- **Header**: add a line saying the spec was revised by
  [#40](https://github.com/darthjee/ward/issues/40), next to the #28/#27 attribution.
- **Summary**:
  - Drop "auto-created at registration".
  - State that organizations are optional and zero organizations is the normal state.
  - Replace "active organization" with "active context (Personal or an organization)".
  - Say that bank data is user-or-organization-owned and the other modules stay user-owned.
- **Permissions**: remove "(including the auto-created one)". Add that personal data is
  owner-only: organization members never see it, even members of an organization the user
  belongs to, and neither does the global `is_admin`.
- **Ownership**: remove the auto-created reference. The creator through `POST /orgs.json` is the
  owner.
- **Auto-created organization**: **remove the whole section.** In its place, add a short
  "Creating an organization" section:
  - registration touches only `users`;
  - users create organizations later through `POST /orgs.json`, from the "Create organization"
    entry in the context switcher.
- **Joining an organization**: change "at registration or through `POST /orgs.json`" to
  "through `POST /orgs.json`".
- **Active organization**: rename it to **Active context**.
  - The contexts are Personal (API `/api/<module>/...`, UI `/<module>/...`) and each
    organization (API `/api/orgs/:orgId/<module>/...`, UI `/orgs/:orgId/<module>/...`).
  - The switcher lists Personal, each organization and a "Create organization" entry. Selecting
    one navigates to that context's URL.
  - Fallback when no context is in the URL: the last used context remembered in the browser,
    otherwise Personal.
  - Remove the "first organization by creation date" step and the zero-organizations empty
    state. With zero organizations the switcher shows Personal plus "Create organization".
  - Keep the per-request membership check (404 for non-members) for organization routes.
- **Backfill**: still not needed. Drop the sentence that depends on auto-creation.
- **Data ownership**: replace the two module kinds with:
  - **User-owned modules** (`protocol`, `car-performance`, `links`, and the existing ones):
    every record belongs to one user through `userId`.
  - **User-or-organization-owned modules** (`bank`):
    - every owner-root record has exactly one owner, either a user or an organization. It is
      stored as two nullable logical references with a DB check that exactly one is set,
      indexed, and with no physical FK across module tables;
    - child records inherit the owner through their root and never store a copy;
    - `user_id` means owner, never creator: an organization record has `user_id = NULL`;
    - there is no `created_by` column;
    - organization data outlives its creator.
  - Each module page states its kind.
  - Global `is_admin` covers accounts only.
- **`data-access` checks**:
  - Rename the subsection to cover user-or-organization-owned modules.
  - Every query is filtered via the `OwnerContext`.
  - Personal queries use only the JWT user.
  - Organization routes verify membership of `:orgId`.
  - No owner fields are read from input or written to output.
  - Unknown id, wrong context and non-member all get a uniform 404 with identical bodies.
  - Keep the note that `product.md` and `data-access.md` are updated at fold time.
- **Entities**: unchanged. Reword the closing note about the logical reference to say "the
  owner references of user-or-organization-owned modules".
- **Routes**: the `/orgs` table is unchanged. Replace the last bullet: such modules are mounted
  under both `/api/<module>/...` (personal) and `/api/orgs/:orgId/<module>/...` (organization),
  serving the same logic.
- **Edge cases**:
  - Remove "Registration atomicity" and "Username change".
  - Reword "Pending user" (nothing is created; they cannot log in until approved) and
    "Denied user" (personal data is kept but unreachable; organization data outlives them).
  - Remove the auto-created clause from "Organization name". Keep the 255-character limit.
  - Change "Stale remembered organization" to "Stale remembered context": forget it and fall
    back to Personal.
  - Add:
    - zero organizations is the normal case;
    - personal routes never carry a user id;
    - wrong context returns 404;
    - owner fields in the body are rejected by the whitelist `ValidationPipe`;
    - both-or-neither owners is impossible (DB check);
    - child records are reached only through their root in its context;
    - leaving an organization (once it exists) loses access to its data, with personal data
      unaffected;
    - deferred: personal data on a future user deletion.
- **Security**:
  - Keep JWT, minimal responses and XSS.
  - Replace "Single membership check" with **one owner-context guard**: a personal route takes
    the owner from the JWT user, never from the URL or body; an organization route runs the
    membership check on `:orgId`, with 404 for non-members. Services receive only an
    `OwnerContext`, never a raw id.
  - Responses never expose owner fields.
  - Caching: personal routes have no owner in the URL, so they **must** be `user-scoped` and
    send `X-Skip-Cache`, with no exception. Organization routes stay `user-scoped`.
- **Owning module**:
  - Remove the "Auto-creation … registration transaction" bullet.
  - Replace the `@OrgScoped()` guard with **`@OwnerScoped()`** in `core`, backed by a DI token
    that `auth` implements (same pattern as `SESSION_LOOKUP`). It resolves the `OwnerContext`
    for both prefixes. Keep `OrganizationService` exported.
  - Change "`bank` stores `organizationId`" to "`bank` stores its owner as logical references
    (see the banking README)".
- **Out of scope / deferred**:
  - Add "moving a record between owners" and "sharing a personal record with an organization"
    (Future epics).
  - Change "moving any module other than `bank` to organization scope" to "… making any module
    other than `bank` user-or-organization-owned".
- **Reference**: add the #40 issue URL and the #41 follow-up URL.
- **Required tests**:
  - Backend:
    - Remove the registration-creates-organization, pending-user, rollback and username-change
      tests.
    - Add:
      - registration creates no organization or membership;
      - `@OwnerScoped()` resolves the JWT user on personal routes and runs the membership check
        on organization routes;
      - unknown id, wrong context and non-member return identical 404s;
      - owner fields in the body are rejected;
      - responses contain no owner fields;
      - the DB check rejects both-or-neither owners;
      - personal routes are `user-scoped` and send `X-Skip-Cache`;
      - a global admin gets no personal data from others.
  - Frontend:
    - The switcher lists Personal, the organizations and "Create organization", and navigates
      to the right URL.
    - The fallback order is last used context, then Personal.
    - A stale context falls back to Personal.
    - With zero organizations, only Personal and "Create organization" are shown.
    - Names are rendered escaped.

## Files to Change
- `docs/agents/specs/auth/organizations.md` — the rewrite described above
