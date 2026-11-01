# Issue Enhancement

A checklist of concerns to consider when fleshing out a vague issue idea (tagged `Idea`/`Writting`) before it reaches the `Created` stage. Not exhaustive — adjust or extend the list for this project's needs.

- **Scope boundaries** — what's explicitly in scope and what's explicitly out.
- **Alternative solutions** — other ways to solve the same problem, and why this one was chosen.
- **Edge cases** — inputs, states, or timing the happy path doesn't cover.
- **Backward compatibility** — whether this breaks existing behavior, data, or integrations.
- **Testing strategy** — how the change will be verified.
- **Performance & security considerations** — anything relevant to load, latency, or attack surface.
- **Owning module** — which module owns this, whether it needs a new module (and its tier — lazy by default), and whether it touches another module's data (only through DI or events, see `architecture/modular-pattern.md`).
- **Data sensitivity & ownership** — personal or financial data (bank, protocols, …) and who may see or edit it.
- **Memory footprint** — whether it fits the Render free tier's 512 MB (new always-on code, heavy dependencies, large in-memory work).
- **Caching** — the cache class of each new route (`public`/`user-scoped`/`never`) and whether Navi should warm it.
