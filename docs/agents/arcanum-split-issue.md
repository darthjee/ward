# Arcanum Split Issue

A checklist of concerns to consider when splitting a broad issue into sub-issues via `/arcanum-split-issue`. Not exhaustive — adjust or extend the list for this project's needs.

- **Sub-issue granularity** — is each sub-issue independently workable, or does it still depend on another sub-issue landing first?
- **Standalone clarity** — does each sub-issue stand on its own, without requiring the reader to have the parent issue open to understand it?
- **Shared contracts** — interfaces, schemas, or config keys touched by more than one sub-issue, and who owns getting them right first.
- **Sequencing** — is there a natural order sub-issues should be implemented/merged in, or can they proceed in parallel?
- **Responsible agents** — which specialist agent(s) each sub-issue is likely to fall to.
- **Backend/frontend split** — typically one sub-issue for the backend module (entities, migrations, routes) and one for the frontend client and pages, backend first.
- **Module boundaries** — keep each sub-issue inside a single module where possible; cross-module work goes through exported services or events.
