# SHEPATH Phase 7C Stage 2A — Reproducible Windows Startup

Date: October 11, 2026 (Asia/Calcutta). Scope: local Windows development and demonstration readiness only. Reviewed Phase 7C Stage 1 and Phase 7A/7B before editing.

## Outcome

Added an authoritative Windows guide, safe committable configuration examples and a bounded local capability checker. All frontend API clients now use explicit shared configuration with clear missing/invalid URL guidance. Configuration is resolved when an action requests data, so missing configuration does not crash the landing page during service construction.

**Fresh-clone reproducibility is not yet verified.** No dependencies were installed or updated; no working environment was deleted or reinstalled. The guide proposes a separate `backend/.venv-demo` and documents the approval requirement before an isolated installation. The current backend interpreter still lacks geographic packages; the checker correctly reports this rather than declaring readiness from health alone.

## Changes

### Documentation and private configuration

- `docs/WINDOWS_STARTUP.md` is the authoritative Windows 11/VS Code guide: tested Python 3.11.9, Node v24.18.0, npm 11.16.0; declared runtime floors; fresh-checkout commands; self-contained geographic installation; private credential handling; backend 8011/frontend 8080; bounded preflight; deliberate quota-consuming live test and exact-geometry evidence POST; troubleshooting and manual demo checklist.
- Root README now provides a project/architecture entry point and links to the guide. Frontend README replaces obsolete screenshot/setup instructions and links to the same guide. Historical reports remain unchanged.
- `backend/.env.example` contains an empty `HEIGIT_API_KEY`, with no actual credential. `frontend/.env.example` specifies API mode and `http://127.0.0.1:8011`; it was previously an ignored local example pointing to 8000 and is now available for Git review.
- Root `.gitignore` adds exceptions for only `/backend/.env.example` and `/frontend/.env.example`; real environment files, backups and other example-like files remain ignored. It also ignores exactly `/backend/.venv-demo/`, the proposed isolated environment location.
- Copy instructions check destination existence before copying. Existing `backend/.env` and `frontend/.env.local` were not changed or printed. No credential value appears in the report, checker output or examples.

### Explicit API configuration

`frontend/src/lib/routing/apiBaseUrl.ts` now trims/normalizes the configured URL and rejects missing/blank, malformed, non-HTTP(S), credential-bearing, query-bearing or fragment-bearing values without echoing the input. Guidance names `frontend/.env.local`, local port 8011 and the need to restart/rebuild.

Live routes, saved comparison and dynamic evidence all use that resolver. The silent 8000 fallback is removed. `ApiRoutingService` defers environment resolution until `getRoutes`; saved comparison resolves before its network-error wrapper, and evidence resolves before its request lifecycle wrapper. Configuration errors therefore retain their actionable message instead of becoming generic CORS/network errors. Explicit constructor URL injection remains available for existing adapter callers/tests.

No journey screen, map geometry handling, route ordering, preference effect, selection logic or geographic calculation was changed. Dynamic response ID/ordered-coordinate verification, cancellation and sequential busy retries remain in place. Saved results remain a separate domain and are never fallback evidence for newly generated routes. No Linux separator fix was implemented.

### Capability checker

Run from the repository root using the interpreter/environment intended for the backend:

```powershell
.\backend\.venv\Scripts\python.exe -B scripts\check_local_capabilities.py
```

For the proposed self-contained environment, substitute `.venv-demo` only after approved installation.

The default command reports four independent results:

1. Health: loopback GET `/health`, checking service/status.
2. Saved comparison: loopback GET `/pilot/ranchi/comparison`, checking available/three routes.
3. Geographic dependencies: imports Shapely, pyproj and osmium in a child of the selected interpreter and checks declared versions.
4. Routing prerequisites: checks private credential presence with the backend's process-environment precedence; explicitly says **CONFIGURED, NOT LIVE-VERIFIED**. An empty process override is treated as absent rather than bypassed with the file value.

No routing-provider request or evidence POST is made. There is no default quota-consuming action. Actual live and dynamic dataset validation are separate deliberate manual steps in the guide. Dependency success refers to the checker interpreter, not the environment of a different already-running server; it does not certify dataset integrity or evidence availability.

Each probe has a 12-second subprocess deadline; total probe budget is 48 seconds plus process overhead. HTTP has a 4-second socket timeout, a 2 MiB response limit, no redirects and no inherited proxy use. Only HTTP loopback bases with an explicit port are accepted. Environment-file inspection has a 64 KiB size bound. Private values, raw responses, tracebacks and child stderr are suppressed. The checker does not import the backend application or load variables into `os.environ`.

Exit 0 means the four prerequisite checks passed, not live-provider/browser/dataset acceptance; exit 1 means at least one failed, and invalid arguments exit 2. Tests exercise endpoint contracts, URL restrictions, credential precedence/nonmutation/redaction, import failure and child deadline/output suppression.

## Validation performed

| Check | Result |
|---|---|
| `npm.cmd test -- --maxWorkers=1` from frontend | **93 passed in 13 files**, exit 0, 80.76 s. Includes eight new shared-configuration cases and existing five-step/mock/API/evidence/saved isolation regressions. |
| `python.exe -B -m unittest discover -s scripts -p test_check_local_capabilities.py -v` using existing backend venv | **5 passed**, 0.033 s. No external provider used; unit tests mock HTTP/import failures. |
| Standalone `.\node_modules\.bin\tsc.cmd --noEmit` | Passed, exit 0. |
| `npm.cmd run build` | Initial sandbox run failed on Windows `spawn EPERM`; approved outside-sandbox rerun **passed**, exit 0, client/SSR/Nitro output. No installation was used to resolve it. |
| Targeted ESLint on six touched/new routing TypeScript files | Passed, exit 0, with `prettier/prettier` disabled for this semantic check. This is not a claim that repository-wide lint passes. |
| Checker with existing `backend/.venv` | Health PASS; saved PASS (three routes); dependencies FAIL (geographic imports unavailable); routing CONFIGURED, NOT LIVE-VERIFIED. Overall exit **1**, the expected honest failure for the known environment gap. |
| Git ignore review | Real `.env`/`.env.local`, `.env.backup` and other example-like names remain ignored; only the two exact examples are unignored. |
| Git scope/whitespace checks | Only files listed below changed/created by this task; `git diff --check` passed. Geographic/backend application source, dependency manifests, datasets and previous reports have no task edits. |

Commands (existing environments; no installs):

```powershell
Set-Location D:\shepath
.\backend\.venv\Scripts\python.exe -B -m unittest discover -s scripts -p test_check_local_capabilities.py -v
.\backend\.venv\Scripts\python.exe -B scripts\check_local_capabilities.py
Set-Location frontend
npm.cmd test -- --maxWorkers=1
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run build
.\node_modules\.bin\eslint.cmd src/lib/routing/apiBaseUrl.ts src/lib/routing/apiBaseUrl.test.ts src/lib/routing/apiRoutingService.ts src/lib/routing/apiRoutingService.test.ts src/lib/routing/routeEvidence.ts src/lib/routing/savedPilot.ts --rule 'prettier/prettier: off'
```

Build warnings remain for the 515.44 kB minified / 157.15 kB gzip main chunk, tsconfig-path plugin guidance and ignored `inlineDynamicImports`. The build creates ignored local output; nothing was deployed.

## Checks not executed and remaining limitations

- **No fresh installation or clean-clone run.** The concrete proposed venv/install/import and npm-ci commands are in the guide; execution requires approval under the user's restriction. No approval was inferred or installation attempted. Existing backend web dependencies remain unpinned in requirements, so a full transitive reproducibility guarantee is not claimed.
- No package install into the working backend, no deletion of environments, no server restart or live provider POST. Current running service environment/commit provenance remains unverified. The checker is not a replacement for deliberate route and evidence acceptance.
- No new backend/geographic regression run: backend application/calculation source is unchanged, and this stage's checker tests are separate. Prior results remain in the Phase 7A/7B reports; they are not recounted as fresh Stage 2A passes.
- No full repository lint rerun or formatting cleanup; Phase 7A's 6,334 formatting errors/six warnings remain historical unresolved debt. The targeted semantic check intentionally excludes formatting and does not certify global lint cleanliness.
- No new browser, mobile, keyboard-only, screen-reader or failure-injection session. DOM regressions do not prove rendered focus/map/accessibility behavior.
- Linux artifact-path portability and production configuration/deployment are deliberately deferred. The Windows guide does not repair the known POSIX path issue.
- Credential presence is not validity, quota or provider-network availability. No secret values were exposed. Saved availability is not live routing, and successful imports are not source integrity/coverage checks.
- Responsible disclosures remain unchanged: historical OSM mapped records and proximity do not establish real-world personal safety, current operation, sidewalk continuity, lighting conditions or exact walked-street attributes.

## Files changed by Stage 2A

Modified tracked files:

1. `.gitignore`
2. `README.md`
3. `frontend/README.md`
4. `frontend/src/lib/routing/apiBaseUrl.ts`
5. `frontend/src/lib/routing/apiRoutingService.ts`
6. `frontend/src/lib/routing/apiRoutingService.test.ts`
7. `frontend/src/lib/routing/routeEvidence.ts`
8. `frontend/src/lib/routing/savedPilot.ts`

Newly available/untracked deliverables:

9. `backend/.env.example` — new secret-free example.
10. `frontend/.env.example` — existing ignored example updated and narrowly unignored.
11. `docs/WINDOWS_STARTUP.md`
12. `frontend/src/lib/routing/apiBaseUrl.test.ts`
13. `scripts/check_local_capabilities.py`
14. `scripts/test_check_local_capabilities.py`
15. `PHASE_7C_STAGE_2A_REPORT.md`

`PHASE_7C_STAGE_1_STARTUP_AUDIT.md` was already untracked at entry and was left unchanged. No existing environment/credential files, tests outside the listed frontend test, dependency declarations, geographic files or historic reports were modified. No commit or push.

Final review commands: `git status --short --untracked-files=all` and `git diff --check`. Untracked report/script/example files also received whitespace checks because ordinary Git diff omits untracked content. Git's LF-to-CRLF advisory is not a whitespace failure.
