# Feature Specs

Permanent hub for **feature specs**: temporary, agreed definitions of a multi-issue feature that
its implementation sub-issues build against. This hub is never deleted; the feature folders it
lists are.

## Purpose

`docs/agents/specs/<feature>/` holds one feature's definition while its sub-issues are being
built. While the folder exists, it is the **source of truth** for that feature: implementation
issues read it instead of making their own decisions about the data model, API, security or UI.

A spec folder is not a plan and not an issue file:

| Folder | Holds | Lifetime |
|---|---|---|
| `issues/` | One issue's description | Until that issue is merged |
| `plans/` | One issue's implementation steps | Until that issue is merged |
| `specs/<feature>/` | The shared definition several issues and plans point at | Until the feature's last sub-issue folds it into the permanent docs |

## Lifecycle

1. A feature's **first** sub-issue writes the specs under `docs/agents/specs/<feature>/` and adds
   an entry to [Active specs](#active-specs) below.
2. The implementation sub-issues build against the specs. A sub-issue that changes a decision
   updates the spec **in the same PR**.
3. The feature's **last** sub-issue folds the lasting content into the permanent docs
   (`product.md`, `modules/`, `backend/routes/`, `environment-variables.md`, …).
4. Before the spec folder is removed, that last sub-issue **creates a GitHub epic for each
   entry in the feature's [Future epics](#conventions) section**, so nothing deferred is lost.
   The created epics' URLs are recorded where the lasting docs mention the deferred concern,
   and in the "Follow-up epics" column of the [Completed specs](#completed-specs) entry.
5. That last sub-issue then deletes `docs/agents/specs/<feature>/` and moves its entry from
   [Active specs](#active-specs) to [Completed specs](#completed-specs), pointing at the permanent
   docs that now hold it.

This hub itself is **permanent**: it is never deleted, even when no spec is active. When no
feature is in progress, [Active specs](#active-specs) reads "none".

Root instruction files (`AGENTS.md`, `CLAUDE.md`) and the doc indexes (`index.md`, `summary.md`)
link to this hub, never to a feature's spec folder. When a spec is added, moves or completes, only
this file changes.

## Conventions

- **One `README.md` per feature**: overview, purpose, scope, the product decision behind it, and
  an index linking every other file in the folder.
- **Files split by concern** (e.g. `model.md`, `api/…`, `security.md`, `ui/…`), so each
  implementation sub-issue reads only what it needs. The `README.md` maps sub-issues to files.
- **Subfolders for variants or areas** (e.g. `api/auth.md`, `api/admin.md`).
- **Every file ends with**:
  - a **Reference** section — external sources linked by their GitHub web URL
    (`https://github.com/<owner>/<repo>/blob/main/<path>`, commits and issues by URL), **never** a
    local file-system path;
  - a **Required tests** section, next to the rules it verifies.
- **Future epics**: a feature's `README.md` may have a `## Future epics` section listing every
  concern the specs defer, each with enough detail to seed an epic (what it covers, the decisions
  it must respect, the spec file it comes from). Deferred concerns are recorded there and **not**
  opened as GitHub issues while the spec is active; the epics are created at fold time (see
  [Lifecycle](#lifecycle)).
- Specs describe **decisions**, not code. They name existing code only to point at the file or
  convention to change.

## Active specs

None.

## Completed specs

Features whose specs were folded into the permanent docs, and where their definition lives now.

| Feature | Folded into | Epic | Follow-up epics |
|---|---|---|---|
| Deployment (Render backend, SSH-hosted proxy and frontend, tag-driven CircleCI release); specs were `specs/deploy/`, removed by #16 | [deployment.md](deployment.md), [environment-variables.md](environment-variables.md) §4 | [#10](https://github.com/darthjee/ward/issues/10) | — |
| Bank module (`bank`: accounts, business expenses, bills); specs were the `banking` feature folder, removed by #58 | [modules/bank.md](modules/bank.md) and [modules/bank/](modules/bank/), [backend/routes/bank.md](backend/routes/bank.md), [product.md](product.md) | [#26](https://github.com/darthjee/ward/issues/26) | [#85](https://github.com/darthjee/ward/issues/85), [#86](https://github.com/darthjee/ward/issues/86), [#87](https://github.com/darthjee/ward/issues/87), [#88](https://github.com/darthjee/ward/issues/88), [#89](https://github.com/darthjee/ward/issues/89), [#90](https://github.com/darthjee/ward/issues/90), [#91](https://github.com/darthjee/ward/issues/91), [#92](https://github.com/darthjee/ward/issues/92), [#93](https://github.com/darthjee/ward/issues/93), [#94](https://github.com/darthjee/ward/issues/94), [#95](https://github.com/darthjee/ward/issues/95), [#96](https://github.com/darthjee/ward/issues/96), [#97](https://github.com/darthjee/ward/issues/97), [#98](https://github.com/darthjee/ward/issues/98), [#99](https://github.com/darthjee/ward/issues/99), [#100](https://github.com/darthjee/ward/issues/100), [#101](https://github.com/darthjee/ward/issues/101), [#102](https://github.com/darthjee/ward/issues/102), [#103](https://github.com/darthjee/ward/issues/103), [#104](https://github.com/darthjee/ward/issues/104) |
| Organizations (`auth` module; a dependency of `bank`); specs were the `auth` feature folder, removed by #58 | [modules/auth/organizations.md](modules/auth/organizations.md) and [modules/auth.md](modules/auth.md), [backend/routes/auth.md](backend/routes/auth.md#organization-routes), [product.md](product.md) | [#26](https://github.com/darthjee/ward/issues/26) | [#81](https://github.com/darthjee/ward/issues/81), [#82](https://github.com/darthjee/ward/issues/82), [#83](https://github.com/darthjee/ward/issues/83), [#84](https://github.com/darthjee/ward/issues/84) |
| User approval (optional admin approval of new registrations, plus the session-lookup gate it needs); specs were `specs/user-approval/`, removed by #7 | [modules/auth/user-approval.md](modules/auth/user-approval.md) | [#1](https://github.com/darthjee/citadel/issues/1) | — |
