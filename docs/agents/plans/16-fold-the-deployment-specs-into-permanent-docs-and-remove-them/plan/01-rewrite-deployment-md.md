# Rewrite deployment.md as the permanent deployment doc

Replace the links to `specs/deploy/` in `docs/agents/deployment.md` with the content they point
at. Check every section against `.circleci/config.yml` and the scripts:

- triggers (`tags_only` / `all_tags`) and the job graph, with the actual `requires`;
- the base-image matrix, `bin/image.sh` guards, the `version` file and the pin rules;
- where `deploy_frontend.sh` comes from (`darthjee/scripts:0.12.0`, via the images);
- Render: build from the tag branch, `backend/bin/server.sh`, `scripts/deploy.sh` flow,
  failure states, executor and hardening;
- SSH staging, `deploy_frontend.sh` actions and per-call variables, `setup_ssh`;
- proxy uploads, host-only files, extension exclude, frontend upload;
- release swap, `KEEP_OLD`, `cleanup`, rollback;
- security: host-key pinning, where secrets live, deploy-only key, paths, cache, known gaps;
- release steps: `scripts/bump_version.sh`, merge to `main`, push the tag;
- the provisioning checklist and the first-release checks.

## Files to Change
- `docs/agents/deployment.md` — becomes the permanent deployment doc
