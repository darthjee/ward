# Plan: Write the deployment specs (docs/agents/specs/deploy/)

Issue: [12-write-the-deployment-specs-docs-agents-specs-deploy.md](../../issues/12-write-the-deployment-specs-docs-agents-specs-deploy.md)

## Overview

Docs-only, architect-owned. Create the deployment feature specs under
`docs/agents/specs/deploy/` (README, pipeline, images, render, ssh/{staging,proxy,frontend,release},
security, environment, provisioning) recording the decisions agreed in Epic #10, and register
them under *Active specs* in `docs/agents/specs.md`. No pipeline, script or code changes.

## Context

Epic #10 (deploy Ward) splits into sub-issues #13–#16 plus manual provisioning. Following the
feature-spec lifecycle in `docs/agents/specs.md`, this first sub-issue writes the specs that
#13–#15 build against and #16 folds into the permanent docs. The issue file lists every file,
its content, the five pinned decisions, the required-tests shape, and the allowed reference URLs.

## Steps

- [01 — Overview, pipeline, images and Render specs](plan/01-overview-pipeline-images-render.md)
- [02 — SSH and security specs](plan/02-ssh-and-security.md)
- [03 — Environment, provisioning and specs hub entry](plan/03-environment-provisioning-hub.md)

## Notes

- Every spec file ends with a **Reference** section (GitHub web URLs only, from the issue's
  *Reference sources* table) and a **Required tests** section (automated checks that must stay
  green + manual first-release verification steps).
- Specs describe decisions, not code; existing files are named only to point at what changes.
- No specialist agent has work; the infra agent is consulted read-only for the current state of
  the pipeline, Dockerfiles and scripts so the specs name existing files accurately.
- Acceptance: no files change outside `docs/agents/specs/deploy/` and `docs/agents/specs.md`
  (besides the issue/plan artifacts, removed before merge).
