# Provisioning

One-time manual setup by the maintainer before the first tag. Not implemented by any sub-issue.

## Render service

- [ ] Runtime **Docker**, **Git-backed** (this repository), Dockerfile
      `dockerfiles/production_ward/Dockerfile`.
- [ ] **Auto-deploy off**: CI moves the deploy branch and triggers the deploy
      ([render.md](render.md)).
- [ ] Docker command **`bin/server.sh`**.
- [ ] Environment variables from [environment.md](environment.md#render-service).
- [ ] The database already exists; only its connection variables are set.
- [ ] The service name matches `RENDER_SERVICE_NAME` (default `ward`).

## SSH host

- [ ] Create a deploy-only user and key pair; install the public key
      ([security.md](security.md#ssh-key-and-paths)).
- [ ] Create the parent directories of `SSH_REMOTE_DIR` and `SSH_REMOTE_TEMP_DIR`, outside the
      web root for staging and kept releases; point the web server at `SSH_REMOTE_DIR`.
- [ ] Create `${SSH_REMOTE_DIR}/configuration/locals.php` (from `locals.php.sample`, with
      `$backendHost` set to the Render URL) and `${SSH_REMOTE_DIR}/.htaccess`.
- [ ] Run `ssh-keyscan -p <port> <host>` and store its output as `SSH_KNOWN_HOSTS`.

## CircleCI

- [ ] Set every variable in [environment.md](environment.md#circleci-project).
- [ ] Push the first semver tag.
- [ ] Walk the acceptance criteria of #10: every **Required tests** section of this folder's
      files (see the [index](README.md#index)).

## Reference

- Kerghan pipeline: https://github.com/darthjee/kerghan/blob/main/.circleci/config.yml
- Epic: https://github.com/darthjee/ward/issues/10

## Required tests

Manual:

- The Render service exists with auto-deploy off and Docker command `bin/server.sh`.
- `locals.php`, `.htaccess` and `SSH_KNOWN_HOSTS` are in place before the first tag.
- The first tag release passes every manual check of the other files.
