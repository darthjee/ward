# Recheck header forwarding and refresh proxy docs

1. **Header forwarding recheck.** `docs/agents/architecture/security.md:56` says the
   `default_proxy` handler forwards every incoming header unchanged (`getallheaders()` into the
   curl executor), as verified on `tent:0.10.4`, and asks for a recheck on upgrade.
   - Inspect `ProxyRequestHandler` in the `darthjee/tent:1.1.0` image, for example
     `docker-compose run --rm --entrypoint sh ward_proxy -c 'grep -rn getallheaders /var/www/html'`.
   - Confirm that `Origin`, `Sec-Fetch-Site` and `Host` still reach the backend.
   - Update the tag in the sentence to `1.1.0`. If the behaviour changed, report it to the
     architect immediately as a blocking security finding instead of only editing the doc.
2. **`docs/agents/external/how-to-use-tent.md:3`:** "Minimum version: 0.10.4" →
   `1.1.0`, with the release link updated to `.../releases/tag/1.1.0`.
3. **`docs/agents/specs/deploy/ssh/proxy.md`:** it already describes the 1.1.0 target state.
   Change it only if step 02 forced a decision (for example a new `vendor/` path or
   interface alignment). Record that decision there, as the issue requires.
4. Optional: `proxy/extension/lib/middlewares/CacheControlMiddleware.php:14` mentions
   "Tent 0.9.1" historically. This is prose, not a pin. Leave it unless it now reads as wrong.

## Files to Change

- `docs/agents/architecture/security.md` — Tent version in the header-forwarding sentence,
  after the recheck.
- `docs/agents/external/how-to-use-tent.md` — minimum version and link.
- `docs/agents/specs/deploy/ssh/proxy.md` — only if step 02 changed a decision.
