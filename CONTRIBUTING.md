# Contributing to SHEPATH

## Workflow

Use a short, task-based branch name: `feat/segment-evidence`, `fix/map-layout` or `chore/repository-cleanup`. Describe the behavior changed and the checks performed in each pull request.

Preserve published commit history. Keep changes focused, and avoid unrelated formatting or dependency upgrades.

## Local development

Follow [Windows startup](docs/WINDOWS_STARTUP.md). Keep existing working environments intact; use an isolated environment for dependency changes. Never commit credentials, local environment files or virtual environments.

## Validation

For frontend changes, run the relevant tests from `frontend/`, then check types and the production build when application behavior changes:

```sh
npm test
npx tsc --noEmit
npm run build
```

Check changed components with ESLint. Repository-wide lint debt remains open; do not describe a targeted check as a clean full-project lint result.

Backend and capability-check commands are in the startup guide. Use the intended Python interpreter with the required geographic dependencies. Keep provider calls deliberate because they consume routing quota.

Documentation-only changes need link and whitespace checks rather than a full application test run.

## Geographic data

Preserve pinned artifacts, manifests, geometry identities and source attribution. Do not regenerate geographic files or change hashes as part of cosmetic cleanup. Keep historical validation records so results remain traceable.

## Interface language

Use mapped evidence and unknown-data language. Do not present record counts as a safety score or describe planned functionality as implemented.
