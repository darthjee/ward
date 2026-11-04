# Deployment

Operator guide for releasing Ward: which variables the deploy needs, where to set them, and
how to get their values. The full agreed design (job graph, staging, release swap, security)
lives in the deploy spec, [specs/deploy/](specs/deploy/README.md), and the canonical variable
list is [specs/deploy/environment.md](specs/deploy/environment.md). This page doesn't restate
them. It only tells the operator what to do.

## How a release runs

A release is a semver tag push (`\d+\.\d+\.\d+`). CircleCI publishes the base images, deploys
the backend to Render (`build-and-release`), stages the proxy, extension, configuration and
frontend on the SSH host, and then swaps the staging directory live (`release`). See
[architecture/infra.md](architecture/infra.md) for the job table.

The SSH jobs call `deploy_frontend.sh` from `darthjee/scripts:0.12.0`. It isn't in the repo.
It is on `PATH` in `darthjee/vite_ward-base` (`/usr/local/sbin/`) and `darthjee/tent:1.1.0`
(`/usr/sbin/`).

## CircleCI project variables

Set all of these under **CircleCI → Project Settings → Environment Variables**.

| Variable | What it is for | How to get the value |
|---|---|---|
| `SSH_HOST` | Hostname of the SSH deploy host (proxy + static files). | The hosting provider's panel. |
| `SSH_PORT` | SSH port of that host. | The hosting provider's panel (often `22`). |
| `SSH_USER` | User the deploy logs in as. | The deploy-only account on the host. |
| `SSH_PRIVATE_KEY` | Private key of that deploy-only account, written out by `setup_ssh`. | Generate a dedicated key pair (`ssh-keygen -t ed25519`), install the public key in the host's `authorized_keys`, and paste the private key here. |
| `SSH_KNOWN_HOSTS` | Pinned host key. Every SSH call then runs with `StrictHostKeyChecking=yes`. | `ssh-keyscan -p <SSH_PORT> <SSH_HOST>`. Check the fingerprint against the provider first, then paste the full output. |
| `SSH_REMOTE_DIR` | Live release path on the host. It is swapped on every release. | Absolute path the web server serves from. |
| `SSH_REMOTE_TEMP_DIR` | Prefix of each workflow's staging directory (`${SSH_REMOTE_TEMP_DIR}-<workspace id>`). | An absolute path on the same filesystem as `SSH_REMOTE_DIR`, so the swap is a plain `mv`. |
| `RENDER_API_KEY` | Authenticates the Render API calls that deploy the backend. | Render → Account Settings → API Keys. |
| `RENDER_SERVICE_NAME` | Render service to deploy. The default is `ward`. | The service name in the Render dashboard. |
| `DOCKER_ID_USER`, `DOCKER_HUB_USERNAME`, `DOCKER_HUB_PASSWORD` | Publish the base images to Docker Hub. | The Docker Hub account and an access token. |

The first-time host setup (`locals.php`, `.htaccess`, the deploy account) is a checklist in
[specs/deploy/provisioning.md](specs/deploy/provisioning.md).

## Rollout notes

- **Set `SSH_KNOWN_HOSTS` before the first tag.** The `setup_ssh` command fails on purpose when
  the variable is empty, so every SSH job (`upload_proxy_files`, `upload_extension`,
  `copy_proxy_configuration`, `upload_fe_files`, `release`) fails until it is set. Nothing goes
  live in that case, and the previous release keeps serving.
- **Old releases are kept.** `release` runs with `KEEP_OLD=true`, so the previous live directory
  stays as `${SSH_REMOTE_DIR}_old_<epoch>`. To roll back, `mv` it back on the host (see
  [specs/deploy/ssh/release.md](specs/deploy/ssh/release.md)). Nothing prunes these copies
  automatically, so delete the older ones by hand from time to time.
- **Staging is cleaned automatically.** After each release, `deploy_frontend.sh cleanup` removes
  `${SSH_REMOTE_TEMP_DIR}-*` directories older than 24h (`CLEANUP_MAX_AGE_MINUTES`, default
  1440). It keeps the current workflow's directory.
- **The extension excludes its tests.** `upload_extension` skips the patterns listed in
  `proxy/extension.exclude` (`tests/`) instead of deleting them from the checkout.
