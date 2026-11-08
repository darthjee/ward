/**
 * Route tables for the context-aware hash router. Each table is an ordered `[path, page key]`
 * list matched top-to-bottom, so more specific paths must be listed before their more generic
 * siblings.
 */

/**
 * Personal-only routes, matched first against the full path (so `/orgs/new` is never read as an
 * organization id). `'/'` → `'home'` stays last.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_PERSONAL = [
  ['/orgs/new', 'org-new'],
  ['/recover-password', 'reset-password'],
  ['/admin/users/:id/edit', 'admin-user-edit'],
  ['/admin/users', 'admin-users'],
  ['/account/authorization-requests', 'authorization-requests'],
  ['/account/my-account', 'my-account'],
  ['/', 'home'],
];

/**
 * Organization-only routes, matched against the path left after the `/orgs/<id>` prefix.
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_ORG_ONLY = [
  ['/', 'org-overview'],
  ['/edit', 'org-edit'],
];

/**
 * Context-aware routes, valid both as Personal (`/x`) and under an organization (`/orgs/<id>/x`).
 * Modules register their own paths here (e.g. `['/bank/accounts', 'bank-accounts']`).
 *
 * @type {Array<Array<string>>}
 */
export const ROUTES_CONTEXT = [];
