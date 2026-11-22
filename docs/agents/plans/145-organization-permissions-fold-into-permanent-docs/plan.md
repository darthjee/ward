# Plan: Organization permissions: fold into permanent docs

Issue: [145-organization-permissions-fold-into-permanent-docs.md](../../issues/145-organization-permissions-fold-into-permanent-docs.md)

## Overview
Docs-only fold of the *Organization permission system* epic
([#81](https://github.com/darthjee/ward/issues/81)) into the permanent docs, now that backend
role enforcement (#143, PR #146) and the role-gated frontend (#144, PR #147) have merged. Every
"stored but not enforced" / "deferred to #81" mention is replaced by the enforced rules. The new
backend mechanisms (`@MinOrgRole`, the role on `OwnerContext`, the role-returning lookup port,
the coverage spec, the payment-generated check) and frontend mechanisms (`can`, `useCan`,
`role`/`refreshRole`, `PermissionEvents`, the `forbidden` error kind, `PermissionDenied`) get
documented. The reviewer agents learn the role rules. No code changes.

All work is in the `architect` scope (`docs/agents/` plus `.claude/agents/*.md`, which falls to
the architect as fallback owner). No specialist agent has work.

## Context
The plan folders of #143 and #144 were removed when they merged; the source of truth is the
merged code. The facts below were gathered from the code by the `backend` and `frontend`
agents and are the reference for every step.

### Backend facts (paths under `backend/src/`)
- **Roles** — `core/org-role.ts`: `OrgRole = { USER: 'user', ADMIN: 'admin', OWNER: 'owner' }`,
  ranked `user < admin < owner`; `hasMinRole(role, min)`; `orgRoleForbidden()` (a plain
  `ForbiddenException`). `auth/entities/organization-membership.entity.ts` re-exports it as
  `MembershipRole`. `OrgRole` lives in `core/` so `core` never imports `auth`. Code wording:
  `user` "may read and do everyday writes", `admin` "may also do destructive and structural
  writes", `owner` "the organization's creator".
- **`OwnerContext`** (`core/owner-context.ts`): `{ kind: 'user'; userId }` or
  `{ kind: 'organization'; organizationId; role: OrgRole }`. `ownerRole(ctx)` returns `owner`
  for the personal context. `OwnerScope` is the same union without `role`, taken by
  `ownerWhere()` / `ownerSqlWhere()` and record-derived owners.
- **Port** — `ORGANIZATION_MEMBERSHIP_LOOKUP` (`core/organization-membership-lookup.ts`),
  interface `OrganizationMembershipLookup#findRole(userId, orgId): Promise<OrgRole | null>`
  (`null` = not a member / no such org). Implemented by `OrganizationService.findRole` (one
  lookup on the unique `(organization_id, user_id)` index), wired with `useExisting` in
  `auth/auth.module.ts`. Replaces the earlier membership-only answer (`isMember`).
- **`@MinOrgRole(role)`** (`core/min-org-role.decorator.ts`, metadata key `minOrgRole`, method or
  class). `OwnerContextGuard` resolves the context (404 path first), then reads the metadata
  (`getAllAndOverride`, handler then class) and throws the 403 when `!hasMinRole(ownerRole(ctx),
  min)`. Role re-read from the DB on every request, no caching, no `is_admin` bypass.
- **403 body** (uniform): `{ "error": { "code": "FORBIDDEN", "message": "Forbidden" },
  "statusCode": 403, "timestamp": ... }` — names neither the resource nor the required role.
  Guard 404/403 carry no cache headers (already in `architecture/caching.md`).
- **Coverage spec** — `core/tests/min-org-role.coverage.spec.ts`, closed by default: every
  owner-scoped route that is not `GET`/`HEAD` must declare `@MinOrgRole` with a valid `OrgRole`;
  discovery must find at least one such route and all `KNOWN_CONTROLLERS`; a fixture controller
  proves the check. No exemptions list. Route discovery is shared with
  `cache-policy.coverage.spec.ts` in `core/tests/support/route-discovery.ts`.
- **Payment-generated transactions** — `bank/transaction.service.ts` `#assertMayEdit` on
  `PATCH` transaction: below `admin`, `PaymentGeneratedQuery.isPaymentGenerated(owner, id)`
  (`bank/payment-generated.query.ts`, one owner-filtered `EXISTS` over `bank_bill_payments`'
  `payment_transaction_id` / `withdrawal_transaction_id` / `charge_transaction_id`) → uniform
  403. Fails closed for any role below admin. Not applied on DELETE (admin-only anyway).
- **Bank route matrix** (both `/bank/...` and `/orgs/:orgId/bank/...`):

  | Method | Path (after `bank/`) | Min role |
  |---|---|---|
  | POST | `accounts.json` | admin |
  | PATCH / DELETE | `accounts/:accountId.json` | admin |
  | POST | `accounts/:accountId/archive.json`, `.../unarchive.json` | admin |
  | POST | `accounts/:accountId/transactions.json` | user |
  | PATCH | `accounts/:accountId/transactions/:transactionId.json` | user (admin if payment-generated) |
  | DELETE | `accounts/:accountId/transactions/:transactionId.json` | admin |
  | POST / PATCH | `bills.json`, `bills/:id.json` | user |
  | DELETE | `bills/:id.json` | admin |
  | POST | `accounts/:accountId/occurrences/:dueDate/payment.json`, `bills/:id/payment.json` | user |
  | DELETE | `accounts/:accountId/occurrences/:dueDate/payment.json`, `bills/:id/payment.json` | admin |
  | POST | `accounts/:accountId/provider-bills.json` | user |
  | PATCH | `provider-bills/:id.json` | user |
  | DELETE | `provider-bills/:id.json` | admin |
  | POST | `provider-bills/:id/occurrences/:dueDate/payment.json` | user |
  | DELETE | `provider-bills/:id/occurrences/:dueDate/payment.json` | admin |
  | POST | `accountant/mark-sent.json`, `accountant/mark-unsent.json` | user |

  Pattern: everyday writes (transactions, bills, payments, accountant marks) need `user`; every
  DELETE (incl. undoing a payment) and every account-structure write need `admin`; nothing needs
  `owner`. Every GET is open to every member.
- **Org routes** — `PATCH /orgs/:orgId.json` is not owner-scoped and has no `@MinOrgRole`:
  `OrganizationService.rename` checks `hasMinRole(membership.role, ADMIN)` → 403. Order: 400
  body, then 404 membership, then 403 role. `POST /orgs.json` has no role gate (caller becomes
  `owner`); both GETs are open to members.
- **Tests** — `bank/tests/org-roles.e2e-spec.ts` (per-role matrix; fixtures
  `bank/tests/support/owner-matrix.ts`, `seedOrgRoles()`, `UNIFORM_403`),
  `core/tests/org-role.spec.ts`, `auth/tests/organization.controller.rename.e2e-spec.ts`.

### Frontend facts (paths under `frontend/assets/js/`)
- **`can(role, action)`** — `utils/permissions/orgPermissions.js` exports `ROLES`, `ACTIONS`,
  `can`. Ranked user=1 < admin=2 < owner=3, `MIN_ROLE` map; unknown/`null` role or unknown
  action → `false`. Actions: `WRITE` (user), `UNDO_PAYMENT`, `EDIT_PAYMENT_TRANSACTION`,
  `MANAGE_ACCOUNTS`, `RENAME_ORGANIZATION`, `DELETE` (all admin). `EDIT_PAYMENT_TRANSACTION`
  is defined but unused (see #148).
- **`useCan(action)`** — `components/common/ownerContext/hooks/useCan.js`, returns
  `can(useOwnerContext().role, action)`. Also
  `components/resources/bank/common/form/hooks/useManageAccountsGate.js` → `{ forbidden, allowed }`
  (`forbidden` only once the role is known).
- **Owner context** — `OwnerContextProvider.jsx` `buildOwnerContextValue` adds
  `role` (personal → `owner`; org → that org's `role` from `GET /orgs.json`; else `null` while
  loading / not listed) and `refreshRole` (= `refreshOrgs`). No separate role request.
  `DEFAULT_OWNER_CONTEXT` has `role: null`, `refreshRole: () => Promise.resolve()`.
- **`PermissionEvents`** — `client/PermissionEvents.js`, window event `permission:forbidden`,
  `emitForbidden()` / `onForbidden(listener)` (returns unsubscribe). Emitted by
  `client/ApiClient.js` `sendJson` on any 403 (before throwing the `ApiError`). Listened to by
  `components/common/ownerContext/controllers/forbiddenRefreshEffect.js`
  (`buildForbiddenRefreshEffect`), mounted by the provider with `refreshOrgs`; an in-flight flag
  collapses bursts into one refresh.
- **`forbidden` error kind** — `components/resources/bank/common/bankErrors.js` `classifyError`
  maps 403 to `{ kind: 'forbidden', ... }` with `PERMISSION_DENIED_MESSAGE = "You don't have
  permission to do this"` (exported by `components/common/PermissionDenied.jsx`).
  `BankErrorAlert.jsx` renders it as a plain danger alert, no Retry (Retry only for
  `transient`). `OrganizationEditController.js` shows the same message on a 403.
- **Hidden for `user`** (nothing hidden for admin/owner): account-list "New" button and
  empty-list call to action; account detail Edit/Rename, Archive/Unarchive (`MANAGE_ACCOUNTS`)
  and Delete (`DELETE`); ledger transaction Delete (Edit stays); bill-history Undo and its
  column; provider-bill Delete; bill-form Delete; calendar Undo on settled entries (Pay/Skip
  stay); organization overview Rename.
- **`PermissionDenied`** (`components/common/PermissionDenied.jsx`, warning alert) — rendered
  when a `user` opens by URL the New/Edit pages of accounts, debts, investments and providers
  (the Edit page skips its load), and `OrganizationEdit` (`#/orgs/:orgId/edit`; renders nothing
  while `role === null`).
- **Known limitation** — `LedgerTableHelper.jsx` always shows Edit, so a `user` sees Edit on
  payment-generated transactions; the backend answers 403 and the UI shows the permission
  message. Follow-up [#148](https://github.com/darthjee/ward/issues/148).

## Steps

- [01 — Organizations page](plan/01-organizations-page.md)
- [02 — Backend route docs](plan/02-backend-route-docs.md)
- [03 — Bank module docs](plan/03-bank-module-docs.md)
- [04 — Frontend architecture doc](plan/04-frontend-architecture.md)
- [05 — Product, summary and specs hub](plan/05-product-summary-specs.md)
- [06 — Reviewer agents](plan/06-reviewer-agents.md)
- [07 — Final sweep](plan/07-final-sweep.md)

## CI Checks
Docs only; no backend/frontend/proxy job is affected. Keep the repo's Markdown conventions
(line width as in surrounding text, relative links that resolve).

## Notes
- No code changes; hiding the Edit button on payment-generated transactions stays in #148.
- The PR closes both #145 and the epic: `Closes #145` and `Closes #81`.
- The member-management rules (admin manages only `user` members; owner manages admins,
  transfers ownership and closes the organization) are **target** rules for #82/#83, not
  built — document them as such.
- `architecture/caching.md` already mentions the `@MinOrgRole` 403; link to it instead of
  repeating.
