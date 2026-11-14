# Routing, section registry and Bank menu

Wire the new pages in. The route table serves both `/bank` and `/orgs/:orgId/bank`.

## Wiring

- **`ROUTES_CONTEXT`.**
  - Add `['/bank/calendar', 'bank-calendar']` and
    `['/bank/calendar/month', 'bank-calendar-month']`.
  - Matching is by segment count, and the query is dropped by `hashPath`, so `?m=` does not
    affect it.
- **`SECTIONS_CONTEXT`.**
  - Add `['/bank/calendar', '/bank/calendar']`, so switching context from either calendar page
    lands on the Calendar list in the new context.
  - Update the "then #77 Calendar" comment.
- **`PAGES` in `AppHelper.jsx`.** Add `['bank-calendar', <BankCalendarList />]` and
  `['bank-calendar-month', <BankCalendarMonth />]`.
- **`BANK_MENU_ENTRIES`.**
  - Append `['Calendar', '/bank/calendar']` after Providers.
  - Fix the stale "#57 Calendar" comment.

## Specs to update

- `BankMenuHelperSpec`: the exact entries and their order.
- `HashRouteResolverSpec`: both hashes under `/bank` and `/orgs/5/bank`, with and without
  `?m=`.
- `sectionTargetSpec`: the context switch from the calendar list and from the month view.
- `AppHelperSpec`: the page key to component mapping.

## Files to Change
- `frontend/assets/js/utils/routing/routes.js`: the route rows and the section row.
- `frontend/assets/js/components/helpers/AppHelper.jsx`: the `PAGES` entries.
- `frontend/assets/js/components/common/header/bankMenu/helpers/BankMenuHelper.jsx`: the menu
  entry.
- `frontend/specs/assets/js/components/common/header/bankMenu/helpers/BankMenuHelperSpec.js`
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js`
- `frontend/specs/assets/js/utils/routing/sectionTargetSpec.js`
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js`
