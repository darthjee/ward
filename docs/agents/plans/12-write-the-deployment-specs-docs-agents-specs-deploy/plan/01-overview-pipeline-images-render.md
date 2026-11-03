# Overview, pipeline, images and Render specs

Write `docs/agents/specs/deploy/README.md` (overview, scope in/out, the five scope decisions,
file index, sub-issue map from the issue), `pipeline.md` (semver-tag-only deploy jobs requiring
test/lint, job graph, job images), `images.md` (base-image matrix, guards, version rules,
`0.1.0` → `0.2.0` bump, `deploy_frontend.sh` sourced from images, no backend/standalone image)
and `render.md` (Render build from tag branch, `bin/server.sh` migrate-then-serve, `deploy.sh`
flow and failure states, `ubuntu-2204:current` executor, `curl --fail-with-body`, empty
service-id guard).

## Files to Change
- `docs/agents/specs/deploy/README.md` — new
- `docs/agents/specs/deploy/pipeline.md` — new
- `docs/agents/specs/deploy/images.md` — new
- `docs/agents/specs/deploy/render.md` — new
