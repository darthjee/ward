# Plan: Implement the Bank menu and Accounts submenu — frontend

Issue: [49-implement-the-bank-menu-and-accounts-submenu-frontend.md](../../issues/49-implement-the-bank-menu-and-accounts-submenu-frontend.md)

## Overview

Build the first usable part of the bank module in the frontend: the Bank menu (Accounts entry
only), the context-switch section registry, `BankClient`, reusable bank helpers under
`components/resources/bank/common/`, and the regular-account pages with their ledger. Every
decision in the issue (menu scope, switch landing, amount input, currency select, ledger UX,
error handling, testing strategy) is implemented as written; the specs under
`docs/agents/specs/banking/` are the source of truth.

## Context

- Specs: `docs/agents/specs/banking/ui/menu.md`, `docs/agents/specs/banking/accounts/regular.md`,
  `docs/agents/specs/banking/accounts/transactions.md` (UI sections and *Frontend* Required tests).
- Backend (#48) is merged under `backend/src/bank/`. `<base>` is `/bank` or `/orgs/:orgId/bank`
  (no `/api` prefix — same as the other clients):

  | Method | Path | Success |
  |---|---|---|
  | GET | `<base>/accounts.json?type=regular&archived=false\|true` | `AccountResponse[]` sorted by name (`archived=true` **includes** archived) |
  | POST | `<base>/accounts.json` | 201 `AccountResponse` |
  | GET | `<base>/accounts/:accountId.json` | `AccountResponse` (full `account_number`) |
  | PATCH | `<base>/accounts/:accountId.json` | `AccountResponse` |
  | DELETE | `<base>/accounts/:accountId.json` | 204 |
  | POST | `<base>/accounts/:accountId/archive.json` / `unarchive.json` | 200 `AccountResponse` |
  | GET | `<base>/accounts/:accountId/transactions.json?page=N` | ledger envelope |
  | POST | `<base>/accounts/:accountId/transactions.json` | 201 `TransactionResponse` |
  | PATCH / DELETE | `<base>/accounts/:accountId/transactions/:transactionId.json` | `TransactionResponse` / 204 |
  | GET | `<base>/settings.json` | `{ "default_currency": "BRL" }` |

  - `AccountResponse`: `{ id, type, name, bank_name, branch, account_number, currency,
    opening_date, opening_balance, balance, archived_at, notes, created_at, updated_at }`;
    amounts are decimal strings. Create / update / archive / unarchive responses carry a **masked**
    `account_number` (`•••• 1234`).
  - Ledger envelope: `{ transactions: [{ id, date, amount, description, notes, balance }],
    opening: { date, amount, balance } | null, pagination: { page, per_page, total_pages,
    total_count } }`; `opening` only on the last page; `total_count` counts real transactions.
  - Create body: `name`, `bank_name`, `branch`, `account_number`, `currency`, `opening_date`,
    `opening_balance`, `notes`. Transaction body: `date`, `amount` (signed decimal string),
    `description`, `notes` (`null` clears). Unknown and owner fields (`user_id`,
    `organization_id`) are rejected with 400.
  - Errors: `{ error: { code, message, details? } }` → `ApiError(status, message, code, details)`.
    404 `NOT_FOUND`; 409 `ACCOUNT_NAME_TAKEN`, `ACCOUNT_HAS_TRANSACTIONS`, `ACCOUNT_ARCHIVED`,
    `CURRENCY_LOCKED`; 400 `VALIDATION_FAILED` (with `details`) or `BAD_REQUEST` (no `details`).
- Existing frontend pieces to reuse: `utils/context/ownerContext.js` (`contextPath`,
  `contextHash`, `landingFor`, `hashPath`, `splitOrgPrefix`, `stripContextPrefix`),
  `utils/routing/routes.js` (`ROUTES_CONTEXT`, empty today), `Router.extractContextParams`,
  `components/helpers/AppHelper.jsx` (`PAGES` map), `client/ApiClient.js`
  (`getJson`/`postJson`/`patchJson`/`deleteJson`; `undefined` = session expired),
  `client/pickDefined.js`, `components/common/notFound/NotFound.jsx`,
  `components/common/forms/helpers/FormFieldsHelper.jsx`, the header
  (`components/common/header/`) and the context switcher
  (`components/common/header/contextSwitcher/`), and the organization pages as the structural
  model (`components/resources/organizations/pages/` with `controllers/` and `helpers/`, loader +
  `build...LoadEffect`, injected setters).
- Specs harness: `renderToStaticMarkup` (effects never run), so behaviour is tested through
  controllers, loaders and exported effect builders, using `fetchSequence`, `renderedOutput`,
  `renderCapturingHandlers`, `fakeWindow`, `flushMicrotasks` from `frontend/specs/support/`.
  Good models: `OrganizationPagesSpec.js`, `OrganizationEditControllerSpec.js`,
  `OrganizationsClientSpec.js`.

## Steps

- [01 — Routing: query parser, page keys and section registry](frontend/01-routing-and-section-registry.md)
- [02 — Bank common helpers: amounts, currency list, page query](frontend/02-bank-common-helpers.md)
- [03 — BankClient](frontend/03-bank-client.md)
- [04 — Bank menu in the header](frontend/04-bank-menu.md)
- [05 — Context switcher lands on the section list](frontend/05-context-switch-section-landing.md)
- [06 — Shared bank components: CurrencySelect, pagination, error alert](frontend/06-bank-common-components.md)
- [07 — Accounts list page](frontend/07-accounts-list-page.md)
- [08 — Account new and edit pages](frontend/08-account-new-edit-pages.md)
- [09 — Account detail page and ledger](frontend/09-account-detail-and-ledger.md)

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Never run `yarn` on the host; always go through the `ward_fe` service.
- **400 without `details`**: amount / opening-balance / page errors are `BAD_REQUEST` with no
  `details`; the UI shows `details` when present and falls back to `error.message` otherwise.
- **Archived rename**: on an archived account the edit page must PATCH **only `name`** — any
  other present field (even unchanged) gives 409 `ACCOUNT_ARCHIVED`. On a non-archived account,
  send `currency` only when it changed (or always the same value — the backend accepts the same
  currency even when locked), but never a different one while locked.
- **Masked responses**: create / update / archive / unarchive return a masked `account_number`;
  after them, navigate or re-fetch the detail instead of displaying the write response.
- `archived=true` on the list means "include archived"; archived rows are identified by
  `archived_at != null` and shown with an "Archived" badge.
- `ui/menu.md`'s "shows all five entries" test is completed by #51, #53, #55 and #57; #49 covers
  only the menu mechanics and the Accounts entry.
- Architect follow-up (docs, not frontend scope): update `docs/agents/architecture/frontend.md`
  — add the `bank/` area, `BankClient`, the section registry and the shared hash-query helper,
  and fix the stale "no React Bootstrap/UI kit chosen yet" line (react-bootstrap is in use).
- ESLint warns at complexity 10 / max-lines 300; keep pages thin (logic in controllers/helpers)
  and split helpers to stay under the limits. JSDoc `require-*` rules are errors outside specs.
  Use `Map` lookups instead of object indexing (Codacy `detect-object-injection`).
