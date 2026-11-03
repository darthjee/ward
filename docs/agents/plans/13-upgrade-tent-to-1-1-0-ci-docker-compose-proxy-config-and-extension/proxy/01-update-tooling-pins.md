# Update proxy tooling and agent doc pins

Move the stale Tent tags in the proxy agent tooling to `1.1.0`:

- `.claude/scripts/check_proxy.sh:5`: `darthjee/tent:0.10.1` → `darthjee/tent:1.1.0` (the
  `php -l` container).
- `.claude/agents/proxy.md`:
  - Lines 34, 37 and 117: `darthjee/tent:0.10.1` → `darthjee/tent:1.1.0`.
  - Line 105 (`proxy_tests` description): `darthjee/tent-test:0.10.0` →
    `darthjee/tent-test:1.1.0`.

## Files to Change

- `.claude/scripts/check_proxy.sh` — lint image tag.
- `.claude/agents/proxy.md` — `php -l` example tags and the `proxy_tests` image description.
