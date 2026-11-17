# Cross-check and finalize

Review the whole folder before committing:

- Every file ends with **Reference** (GitHub web URLs `https://github.com/darthjee/ward/blob/main/...`
  or issue URLs — no local paths) and **Required tests** sections.
- Error codes, column names, route shapes and sub-issue numbers (#121–#126) are identical across
  `model.md`, `migration.md`, `security.md`, `api/*.md`, `ui/*.md` and the README.
- The README index links every file, and the sub-issue → file map matches what each file
  actually covers.
- The four open concerns are each explicitly marked decided (caching in `api/*.md`, ownership
  and performance & security in `security.md`, testing split in the README), noting any
  revision of the epic's starting positions.
- `docs/agents/specs.md` *Active specs* lists `split-provider`; no root file, `index.md` or
  `summary.md` links to the feature folder directly. Check whether
  `docs/agents/folder-structure.md` lists `docs/agents/specs/`; if it describes `specs.md` as the
  hub only, leave it unchanged.
- Optionally re-dispatch `product-owner` / `security` for a quick read-only pass on the written
  files if step 01 produced revisions.

## Files to Change

- Any file under `docs/agents/specs/split-provider/` needing consistency fixes.
- `docs/agents/folder-structure.md` — only if it enumerates `docs/agents/` subfolders and lacks
  `specs/`.
