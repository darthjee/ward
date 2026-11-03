# Update infra agent docs and architecture/spec pages

Update the docs that describe the images, so no stale Tent pin remains in the infra area:

- `.claude/agents/infra.md`:
  - Line 35 (`ward_proxy`): `darthjee/tent:0.10.1` → `darthjee/tent:1.1.0`.
  - Line 36 (`proxy_lint`): `darthjee/tent-test:0.10.4` → `darthjee/tent-test:1.1.0`.
  - Add or adjust `proxy_tests` if it is listed.
  - While editing the table, also fix the stale `ward_navi` tag (`1.5.1` → `1.6.1`, matching
    `docker-compose.yml`).
- `docs/agents/architecture/infra.md`:
  - Line 113 (`proxy_extension_tests`): `tent-test:0.10.4` → `tent-test:1.1.0`.
  - Lines 117, 119 and 120 (`upload_proxy_files`, `upload_extension`,
    `copy_proxy_configuration`): `tent:0.10.4` → `tent:1.1.0`.
- `docs/agents/specs/deploy/pipeline.md`, line 53: the sentence "Today the SSH jobs run on
  `tent:0.10.4` and `vite_ward-base:0.0.1` …" goes stale. Reword it so the SSH jobs are on
  `tent:1.1.0`. Keep the `vite_ward-base` part as still pending, because that is another issue.

## Files to Change

- `.claude/agents/infra.md` — Tent and tent-test tags in the services table (and the
  `ward_navi` tag).
- `docs/agents/architecture/infra.md` — CI job image table.
- `docs/agents/specs/deploy/pipeline.md` — the "Today the SSH jobs run on …" sentence.
