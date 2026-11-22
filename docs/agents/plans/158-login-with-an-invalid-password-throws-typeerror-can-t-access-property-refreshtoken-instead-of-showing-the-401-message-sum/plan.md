# Plan: Login with an invalid password throws `TypeError: can't access property "refreshToken"` instead of showing the 401 message

Issue: [158-login-with-an-invalid-password-throws-typeerror-can-t-access-property-refreshtoken-instead-of-showing-the-401-message-sum.md](../../issues/158-login-with-an-invalid-password-throws-typeerror-can-t-access-property-refreshtoken-instead-of-showing-the-401-message-sum.md)

## Overview
Fix the frontend HTTP layer so a `401` from a public auth route surfaces as a normal `ApiError`
(no refresh, no retry, no session change), and so a failed session recovery on authenticated
routes rejects with a marked `ApiError` instead of resolving `undefined`. Consumers that relied
on the silent `undefined` are updated to recognise the session-expired rejection and stay
quiet next to the re-opened login modal. The work is frontend-only; the architect updates the
permanent docs at the end.

See [frontend.md](frontend.md) for the full plan.
