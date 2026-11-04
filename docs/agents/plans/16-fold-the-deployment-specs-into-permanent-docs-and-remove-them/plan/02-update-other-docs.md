# Update environment-variables.md and the other permanent docs

- `environment-variables.md` §4: drop the "no Render service or SSH host exists yet" note (point
  at the provisioning checklist instead), fix the `DOCKER_ID_USER` row (all four base images are
  pushed; only the app image is never published), make the `RENDER_SERVICE_NAME` and `SSH_*`
  rows name the jobs that read them, and mark the Navi rows as not used by the pipeline. §3:
  drop the claim that CircleCI has warm-up jobs.
- `architecture/infra.md`: drop the "backend images not published" claim, and link
  `deployment.md`.
- `cache-warmer.md`: the CI section describes jobs that don't exist. Say there is no warm-up job
  in the release pipeline yet.
- `architecture.md`, `AGENTS.md`, `summary.md`: update the `deployment.md` descriptions (it is no
  longer only an operator guide and no longer links to the specs). `index.md` already links it.

## Files to Change
- `docs/agents/environment-variables.md`
- `docs/agents/architecture/infra.md`
- `docs/agents/cache-warmer.md`
- `docs/agents/architecture.md`
- `docs/agents/summary.md`
- `AGENTS.md`
