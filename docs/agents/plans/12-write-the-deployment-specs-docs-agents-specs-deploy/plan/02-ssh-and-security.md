# SSH and security specs

Write `ssh/staging.md` (workflow-scoped staging dir, `deploy_frontend.sh` actions and per-call
variables, `setup_ssh` command with the `SSH_KNOWN_HOSTS` guard), `ssh/proxy.md` (Tent 1.1.0
pins, three upload jobs, host-only `locals.php`/`.htaccess` via `copy_files`,
`proxy/extension.exclude` with `EXCLUDE_FROM`), `ssh/frontend.md` (`build` → `dist/` →
`<staging>/static/`, no `generate_folder`), `ssh/release.md` (swap gating, `KEEP_OLD=true`,
pruning, `cleanup` with default 1440 min, rollback) and `security.md` (host-key pinning, secret
locations, deploy-only key, staging outside web root, public-only proxy cache, no
`get_env_vars` in CI, MySQL TLS gap tracked in #11).

## Files to Change
- `docs/agents/specs/deploy/ssh/staging.md` — new
- `docs/agents/specs/deploy/ssh/proxy.md` — new
- `docs/agents/specs/deploy/ssh/frontend.md` — new
- `docs/agents/specs/deploy/ssh/release.md` — new
- `docs/agents/specs/deploy/security.md` — new
