# Security

Security rules for the deployment. The known-hosts guard is owned by
[#15](https://github.com/darthjee/ward/issues/15); the rest is cross-cutting.

## Host-key pinning

- The SSH host's public key is pinned in the CircleCI variable `SSH_KNOWN_HOSTS` (output of
  `ssh-keyscan`, see [provisioning.md](provisioning.md)); SSH connections verify the host
  against it instead of trusting on first use.
- **Guard**: the `setup_ssh` command fails when `SSH_KNOWN_HOSTS` is empty, before the key file
  is written ([ssh/staging.md](ssh/staging.md)). Every SSH job goes through it.

## Where each secret lives

| Secret | Lives in | Never in |
|---|---|---|
| Backend runtime secrets (`WARD_SECRET_KEY`, `WARD_MYSQL_*`, `WARD_EMAIL_*`, …) | Render service environment | CircleCI, the repository |
| Proxy configuration (`configuration/locals.php`) and `.htaccess` | The SSH host only | CircleCI, the repository |
| Deploy credentials (`RENDER_API_KEY`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, Docker Hub) | CircleCI project variables | Render, the repository |

CI holds **deploy credentials only**: it never needs a backend runtime secret.

## SSH key and paths

- Use a **deploy-only SSH key**: a dedicated key pair for the deploy user, used for nothing else,
  limited to the deploy directories.
- Keep the staging directories (`${SSH_REMOTE_TEMP_DIR}-*`) and the kept releases
  (`${SSH_REMOTE_DIR}_old_*`) **outside the web root**, so neither is ever served.

## Cache

- The Tent proxy cache holds **public responses only**. User-scoped responses carry
  `X-Skip-Cache` and are never cached (see `cache-warmer.md`); the deploy does not change that.

## Render environment

- CI **never calls `render.sh get_env_vars`**, so the Render service's secrets are never read
  into, or printed in, CI logs.

## Known gaps

- **TLS to MySQL is missing**: the backend connects to the database without TLS. Tracked in
  [#11](https://github.com/darthjee/ward/issues/11).

## Reference

- `deploy_frontend.sh` 0.12.0: https://github.com/darthjee/docker/blob/main/scripts/0.12.0/home/sbin/deploy_frontend.sh
- Epic and DB TLS follow-up: https://github.com/darthjee/ward/issues/10, https://github.com/darthjee/ward/issues/11

## Required tests

Manual (first tag release):

- With `SSH_KNOWN_HOSTS` empty, every SSH job fails at `setup_ssh`; with a wrong host key, the
  connection is refused.
- No CI job log prints a backend runtime secret, and no job calls `get_env_vars`.
- Neither a staging directory nor a kept release is reachable over HTTP.
- A user-scoped response is not served from the proxy cache.
