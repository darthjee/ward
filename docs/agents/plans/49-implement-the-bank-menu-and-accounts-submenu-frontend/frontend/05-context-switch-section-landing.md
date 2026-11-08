# Context switcher lands on the section list

Make a switch from a bank page land on the same section's list in the new context
(`ui/menu.md`), and keep the item `href` equal to the click target.

- `ContextSwitcher.jsx`: compute `switchTarget = switchTargetFor(window.location.hash)` (step 01;
  read the hash SSR-safely, e.g. `typeof window === 'undefined'` → `''`) on render. The component
  remounts on context change (the `Fragment` key in `AppHelper`) and also re-renders on route
  change via `useOwnerContext()`'s `page`, so the target stays current.
- `onPick = (picked) => controller.pick(picked, userId, switchTarget)` — the controller already
  supports a `switchTarget` and remembers the context before navigating.
- `ContextSwitcherHelper.jsx`: accept the target function and use `href={switchTarget(itemContext)}`
  instead of the hard-coded `landingFor(itemContext)` (default to `landingFor` to keep other
  callers unchanged).

Specs: from `#/orgs/3/bank/accounts/12/edit` picking Personal → `#/bank/accounts`; from
`#/bank/accounts?archived=true` picking org 5 → `#/orgs/5/bank/accounts`; from
`#/account/my-account` → `#/orgs/5` (landing); item hrefs match in each case.

## Files to Change
- `frontend/assets/js/components/common/header/contextSwitcher/ContextSwitcher.jsx` — pass the section-aware `switchTarget`
- `frontend/assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelper.jsx` — hrefs from the target function
- `frontend/specs/assets/js/components/common/header/contextSwitcher/ContextSwitcherSpec.js` — landing / href cases (use `fakeWindow` for the hash)
- `frontend/specs/assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelperSpec.js` — href uses the given target
