# Docs (architect)

This step is owned by the **architect** (`docs/agents/` is outside the frontend scope). Run it
after steps 01–05 land. Document the public-route opt-out and the reject-on-expiry contract:

- `docs/agents/architecture/frontend.md`
  - "Auth flow": replace "reacts to a `401` transparently..." with this. Default routes do one
    refresh-and-retry. On failure they clear `AuthSession`, open the modal, and **reject** with
    the original 401's `ApiError` marked `sessionExpired: true`. `AccountsClient`'s public
    methods (list them) pass `{ skipAuthRecovery: true }`, so a 401 rejects as a plain `ApiError`
    with no session change.
  - "Login modal": a wrong password shows the backend's `Invalid username or password`, next to
    the existing `403 USER_DENIED` note.
  - "API errors": replace "Any non-`401` failure" with every failure, including the
    `sessionExpired` field and the `isSessionExpired(error)` helper. Add the rule that consumers
    stay silent on session expiry, and the bank `classifyError` `sessionExpired` kind.
- `docs/agents/flow.md` "Session renewal": add that public auth routes never attempt renewal and
  that the awaiting call rejects when renewal fails.
- `docs/agents/backend/routes/auth.md`: next to "A `403` never triggers the frontend
  `ApiClient`'s refresh-and-retry", add that the `401` answers of the `@Public()` auth routes
  don't trigger it either.

## Files to Change
- `docs/agents/architecture/frontend.md`
- `docs/agents/flow.md`
- `docs/agents/backend/routes/auth.md`
