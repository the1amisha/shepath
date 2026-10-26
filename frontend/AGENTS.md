# Frontend contribution guidance

- Preserve published Git history. Use new commits rather than force-pushing, rebasing or squashing already published commits.
- Keep the frontend compatible with the FastAPI backend and preserve the explicit live/mock distinction.
- Load Leaflet inside the map component effect so browser-only map code stays outside SSR evaluation.
- Preserve route identity, evidence provenance, unknown-data labels and failure handling.
- Use task-based branch names such as `feat/segment-evidence`, `fix/map-layout` or `chore/repository-cleanup`.
- See [CONTRIBUTING.md](../CONTRIBUTING.md) for validation and data-handling rules.
