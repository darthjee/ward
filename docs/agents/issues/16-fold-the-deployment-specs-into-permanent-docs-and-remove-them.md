# Fold the deployment specs into permanent docs and remove them

## Context

Part of Epic #10 (deploy Ward), and the last sub-issue of that Epic. The deployment specs in
`docs/agents/specs/deploy/` were written up front (#12) to agree on the design. #13 (Tent
1.1.0 upgrade), #14 (backend server start) and #15 (deploy script and base images) have now
all been merged, so the pipeline is actually built. Following steps 3–4 of the spec lifecycle
in `docs/agents/specs.md`, the lasting content of the specs must be folded into Ward's
permanent documentation, and the specs themselves removed.

## What needs to be done

Docs:

- Turn **`docs/agents/deployment.md`** into the permanent deployment doc, holding the lasting
  content of the specs:
  - triggers and the job graph;
  - the images and their versioning;
  - where `deploy_frontend.sh` comes from;
  - Render and `bin/server.sh`;
  - proxy and frontend uploads;
  - the release swap, `KEEP_OLD`, `cleanup` and rollback;
  - security (host-key pinning, where secrets live);
  - the release steps: `scripts/bump_version.sh`, then merge to `main`, then push the tag;
  - the provisioning checklist.
- Update **`docs/agents/environment-variables.md`** §4 (CircleCI variables):
  - add `SSH_KNOWN_HOSTS`;
  - drop the "no Render service or SSH host exists yet" note once provisioning is done;
  - make every row match the final pipeline.
- Update any other permanent doc the specs affect (e.g. `docs/agents/architecture.md`,
  `docs/agents/cache-warmer.md` references to the release chain, `AGENTS.md` links), and link
  `deployment.md` from the doc indexes (`index.md`, `summary.md`).
- Delete `docs/agents/specs/deploy/`.
- In `docs/agents/specs.md`, move the deployment entry from *Active specs* to *Completed
  specs*, pointing at `deployment.md` and Epic #10.

## Depends on

#13, #14 and #15 must all be merged, so that the docs describe what was actually built (all
three are merged).

## Acceptance criteria

- [ ] `docs/agents/deployment.md` exists and matches `.circleci/config.yml` and the scripts.
- [ ] `docs/agents/specs/deploy/` no longer exists, and nothing links to it.
- [ ] `docs/agents/specs.md` lists the deployment specs under *Completed specs*.
