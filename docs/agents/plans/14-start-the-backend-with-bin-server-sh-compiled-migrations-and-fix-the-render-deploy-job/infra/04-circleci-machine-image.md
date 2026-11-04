# Run build-and-release on ubuntu-2204
In `.circleci/config.yml`, change the `build-and-release` job (L245–254) from `machine: true` to:

```yaml
machine:
  image: ubuntu-2204:current
```

This matches Kerghan and `docs/agents/specs/deploy/pipeline.md` L47, and it provides curl ≥ 7.76 (for
`--fail-with-body`) and `jq`. Rewrite the job comment (L241–244) to say why the pinned image is used. Keep the
steps order: `scripts/deploy.sh update_deploy_branch`, then `scripts/deploy.sh deploy`.

## Files to Change
- `.circleci/config.yml`: set the `build-and-release` machine image and update its comment.
