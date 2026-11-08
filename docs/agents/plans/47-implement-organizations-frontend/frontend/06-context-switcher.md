# Context switcher in the header

Layout (react-bootstrap, same CJS deep imports as `HeaderHelper`):

```text
[Ward] [Personal ▾]            Admin Users  My account ▾  Logout
```

- Split today's single `Nav className="me-auto"`: the switcher sits in a left `Nav` right after
  `Navbar.Brand`; Admin, My account and Logout move to a right-aligned `Nav` (`ms-auto`). The login
  link layout while logged out stays as it is.
- `ContextSwitcher` returns `null` while logged out or pending.
- `NavDropdown` with `renderMenuOnMount` (so static-markup specs see the items):
  - title: "Personal", or the active organization's name (from `orgs` by `context.orgId`), truncated
    with `text-truncate` + a max width, full name in `title`. If the active org is not in the list,
    show a neutral title — never a name from storage;
  - items: **Personal**; `NavDropdown.Divider`; each org by name (active one checked, e.g. a
    bootstrap-icons check); `NavDropdown.Divider`; **+ Create organization** → `#/orgs/new`;
  - zero orgs → Personal, divider, Create organization only;
  - `orgsError` → Personal and Create organization still shown, plus an inline error item.
  - The role is not shown.
- `ContextSwitcherController.pick(context)` (injectable storage and navigate): Personal →
  `rememberPersonal(userId)` **before** setting the hash to `landingFor(PERSONAL)`; organization →
  remember it, then navigate to `landingFor(org)`. On pages with no organization variant (all pages
  in this issue) the target is the landing; leave a hook (e.g. an optional per-page `switchTarget`)
  for module pages in #49 per `banking/ui/menu.md` *Context*, without implementing module behaviour.
- Names are React text only.

Specs: items (with and without orgs, active one checked), hidden logged out / pending, inline error,
escaped names (`<script>` renders as text), truncation class + `title`, Personal stored before
navigation (order asserted), org pick navigates to `#/orgs/<id>`, Create link href. Update
`HeaderHelperSpec` for the new layout.

## Files to Change
- `frontend/assets/js/components/common/header/contextSwitcher/ContextSwitcher.jsx` — new.
- `frontend/assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelper.jsx` — new.
- `frontend/assets/js/components/common/header/contextSwitcher/controllers/ContextSwitcherController.js` — new.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — insert switcher, left/right `Nav`s.
- `frontend/assets/js/components/common/header/Header.jsx` — pass `loggedIn` / `pending` to the switcher.
- Matching specs under `frontend/specs/assets/js/components/common/header/...`.
