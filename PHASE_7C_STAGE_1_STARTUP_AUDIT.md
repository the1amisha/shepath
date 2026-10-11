# SHEPATH — Phase 7C, Stage 1: Startup & Deployment Readiness Audit

Date: October 11, 2026 (Asia/Calcutta). Repository: `D:\shepath`.

Inspected HEAD: `1d9af9940cd0b9dfa5600c2cb4484015d7f1d224`. Working tree was clean at entry. Relative to the Phase 7A/7B source baseline `cc74715`, only the two reports were added; application source is unchanged.

## 1. Executive summary

**Ready for a rehearsed desktop college prototype demonstration on the existing configured Windows machine; not yet verified as a reproducible fresh-clone installation or a production deployment.** Phase 7B records a successful manual five-step Doranda journey. This audit independently confirms that the existing local health, saved-comparison and frontend HTTP endpoints respond, but does not claim a new browser walkthrough, live routing test or cold start.

The geographic data required for the demonstrated features is present in Git. The principal startup problem is environment/configuration reproducibility, rather than an absent regional dataset: the backend virtual environment currently lacks all three geographic packages, and prior successful evidence runs used packages from a second local environment. Backend URL defaults also differ from the documented 8011 demo port.

**A newly identified deployment blocker is Windows-specific artifact path handling in the dynamic evidence verifier.** All six extraction manifest artifact names contain backslashes; the verifier directly passes them to `Path`, which treats those characters as literal filename characters on POSIX. A conventional Linux checkout with ordinary directory paths would therefore fail dynamic dataset initialization. This is established by source and a path-semantics probe, not a Linux runtime test. The saved comparison already normalizes separators. Do not modify the pinned manifest to work around this issue.

The production frontend build is currently Cloudflare-targeted SSR output, while the backend requires a separate Python ASGI process, native geographic dependencies and repository-relative files. A successful frontend build does not deploy or package that backend. Hosting topology, public HTTPS API configuration, production CORS and process/resource supervision remain unimplemented or unverified.

No Critical issue was established within this audit's scope. High findings below prevent a reliable portable handoff or deployment. No fixes, installations, environment changes, credential changes, deployments, commits or pushes were performed.

## 2. Evidence boundaries and checks performed

Evidence labels used below: **V** = executed local check; **S** = source/configuration inspection; **H** = historical report; **P** = pending verification.

| Evidence | Result and boundary |
|---|---|
| V — Git baseline/diff | HEAD above; initially clean. `git diff cc74715 HEAD --stat` lists only Phase 7A and 7B reports. |
| V — Installed runtime metadata | Backend Python 3.11.9; Node v24.18.0; npm 11.16.0. Package versions/requirements inspected without installation or application import. |
| V — Backend environment inventory | FastAPI 0.142.2, Pydantic 2.13.5, Starlette 1.7.0, httpx 0.28.1, Uvicorn 0.54.0. Shapely, pyproj and osmium are absent from this environment. |
| V — Geographic environment metadata | Existing `data/ranchi_safety/.pbf_venv/Lib/site-packages` contains Shapely 2.1.2, pyproj 3.7.2 and osmium 4.3.1. Metadata presence is not a new native-import or compatibility test. |
| V — Configuration checks | Local frontend file has API mode and base URL matching `http://127.0.0.1:8011`. Only allowlisted configuration comparisons were printed. Backend `.env`, frontend `.env.local` and frontend `.env.example` exist, are untracked and ignored. Backend secret contents were not read. |
| V — Audit-shell state | No `PYTHONPATH`, `VITE_API_BASE_URL`, `VITE_ROUTING_PROVIDER` or `HEIGIT_API_KEY` override was present in this tool process. This does not inspect or change existing server process environments. |
| V — Local HTTP, existing servers | `GET http://127.0.0.1:8011/health`: HTTP 200, `ok`, `shepath-backend`; `GET /pilot/ranchi/comparison`: HTTP 200, `available`, three routes; `GET http://127.0.0.1:8080/`: HTTP 200, HTML contains SHEPATH. No browser hydration/map check implied. These requests do not call the routing provider. |
| V — Selected data inventory/hashes | Six extraction artifacts, six feature artifacts and one comparison artifact: all 13 tracked, present and matching their manifest SHA-256 values. Boundary and saved-route JSON paths are also tracked. This targeted check is not full geometric reconstruction or a new endpoint parity test. |
| V/S — POSIX path probe | Six extraction artifact keys contain backslashes; `PurePosixPath` treats the first key as one path component. Combined with verifier source, this identifies a Linux portability defect without running Linux. |
| V/S — Existing build metadata | Local ignored `.output/nitro.json` says `cloudflare-module`; generated worker configuration points to `index.mjs`. These are existing artifacts, not a fresh build or proof of deployed readiness. |
| H — Phase 7A | 205 tests passed: 85 frontend, 40 backend, 80 geographic; TypeScript/build passed; lint failed with 6,334 formatting errors and six fast-refresh warnings. Existing-service smoke passed; cold startup did not, because ports were occupied. |
| H — Phase 7B | User-reported manual backend checks and complete desktop Albert Ekka Chowk → Doranda walkthrough passed, including selected Route 2, evidence and restart. Browser/version, viewport, exact startup transcript and timed duration were not supplied. |

Reviewed `README.md`, `frontend/README.md`, Phase 7A/7B reports, backend API/setup documentation, source/configuration, frontend scripts/clients/map, geographic loader/verifier/manifests, ignore rules, attributes and relevant installed build-tool metadata. No new test suite, build, live-route/evidence POST, server launch, browser test, clean clone, download or deployment was performed. Python inspection used `-B` to avoid bytecode writes. Only this report was created.

## 3. Current architecture and dependencies

### Request flow

1. React/TanStack Start supplies the five-step interface. Vite serves local development; Leaflet is loaded inside a browser effect. Preference choices are explicitly a preview and do not alter route ordering or evidence.
2. In API mode, the browser posts origin/destination and walking mode to FastAPI `/route`. The backend reads a server-side HeiGIT credential, geocodes with Pelias and requests openrouteservice directions. It returns geometry in `[latitude, longitude]` order plus distance/duration.
3. The frontend submits each exact route geometry sequentially to `/pilot/ranchi/route-evidence`. The backend lazily loads the pinned local pilot, verifies artifacts/reconstructed geometry and analyzes a nominal 100 m buffer in EPSG:32645. The client verifies echoed ID and full ordered coordinates before displaying evidence.
4. `/pilot/ranchi/comparison` independently serves a verified historical comparison for the fixed saved Albert Ekka Chowk → Doranda walking journey. It makes no provider request and does not recompute features or attach saved metrics to new routes by ID.
5. OSM tiles and Google Fonts are separate external dependencies. Tile failure does not invalidate returned route geometry or historical evidence. The mock landing preview remains explicitly illustrative even in API mode.

Key locations: `backend/app/main.py:19,31,87,521`; `backend/app/route_evidence.py:150,170`; `backend/app/pilot_ranchi.py:11,123`; `frontend/src/routes/index.tsx:114`; `frontend/src/lib/routing/routeEvidence.ts:49,81,98`; `frontend/src/hooks/useRouteEvidence.ts:10`; `frontend/src/components/ShePathMap.tsx:22,26`.

### Runtime versions and installation requirements

| Component | Required/observed position |
|---|---|
| Python | **At least 3.11 for the currently pinned geographic stack:** installed pyproj 3.7.2 metadata requires `>=3.11`. CPython **3.11.9** is the observed backend version. Other Python versions/platforms are not accepted merely because metadata allows them; use tested compatible wheels. |
| Python dependencies | `backend/requirements.txt` declares unpinned `fastapi`, `httpx`, `uvicorn[standard]`, plus pinned `shapely==2.1.2`, `pyproj==3.7.2`, `osmium==4.3.1`. Pydantic/Starlette arrive transitively; source uses Pydantic v2 APIs. No full backend lock or Python version declaration was found. |
| Native geographic libraries | Shapely/pyproj/osmium need platform-compatible packages and their runtime resources. pyproj metadata imposes the Python floor; osmium is imported by the reused verifier even though the request path does not re-extract the regional PBF. Windows virtual environments must not be copied to Linux. |
| Node | Installed/locked TanStack Start 1.168.60 declares **`>=22.12.0`**; Vite 8.1.5/Nitro/rolldown declare `^20.19.0 || >=22.12.0`. Node 20 satisfying Vite alone is insufficient for Start. **Node v24.18.0** is locally observed and was used in prior validation; no other Node version was tested here. |
| npm/frontend | npm **11.16.0** observed. `package-lock.json` and `bun.lock` are both tracked; `package.json` has no engine/package-manager pin. Use one documented package manager for reproducibility. `npm ci` is the appropriate future npm-lockfile installation check, but was not run. |
| Build dependencies | Frontend build uses dev dependencies: Vite, TypeScript/tooling, TanStack configuration and Nitro. A build environment that installs only production dependencies is insufficient for this script. |

These are metadata-backed constraints, not a fresh-install success claim. Installing current unpinned Python packages could resolve different versions later.

### Environment and ports

| Setting | Role / current risk |
|---|---|
| `HEIGIT_API_KEY` | Backend-only live geocoding/directions credential. `main.py:87` reads `backend/.env` when requesting the key, without overriding an existing process value. Missing key produces an explicit server configuration error. No frontend bundle may contain it. Credential validity/quota was not tested anew. |
| `VITE_ROUTING_PROVIDER` | `api` or `mock`; defaults to `api`. Existing local file was verified as API mode. Invalid values throw. |
| `VITE_API_BASE_URL` | Existing local frontend file matches 8011. Live clients fall back to `http://127.0.0.1:8000` (`apiBaseUrl.ts:3`); saved client requires an explicit value (`savedPilot.ts:175`). Therefore source defaults are **not consistently 8011**. |
| `PYTHONPATH` | Historical local workaround exposes geographic packages from `.pbf_venv` to `backend/.venv`. Absent in the audit shell; existing server state is unknown. This is not a required product setting when a self-contained backend environment is correctly installed. |
| Backend port | 8011 is a documented/CLI choice, not fixed in application source. Use explicit `--port 8011`; launching on another port requires matching client configuration. |
| Frontend port | Installed `@lovable.dev/vite-tanstack-config/dist/index.js:1870–1882` supplies port 8080; sandbox branch enables strict port, non-sandbox defaults need not. Explicit `--strictPort` prevents silent port drift. `frontend/vite.config.ts` delegates this behavior to the package. |
| CORS | `main.py:19–26` allows only localhost and 127.0.0.1 on frontend ports 8080/8081; GET/POST/OPTIONS. It does not allow arbitrary LAN/public origins. CORS is not authentication or a provider-quota protection mechanism. |

Vite variables are frontend start/build inputs. A production bundle built with a loopback base points to each visitor's computer, not the hosted backend. Changing the backend runtime environment alone cannot fix that client bundle; rebuild with the intended public HTTPS URL after configuration is deliberately approved.

## 4. Geographic files, storage and Git portability

The required selected data is deliberately tracked despite broad generated-data exclusions:

| Purpose | Repository-relative paths under `data/ranchi_safety/` |
|---|---|
| Dynamic extraction | `offline_runs/eastern_261008_ranchi_v1/manifest.json`; attempt `attempt_20261009T163125_789731Z/` with `features.geojson`, `objects.jsonl`, `pilot.osm.pbf`, `issues.jsonl`, `potential_duplicates.jsonl`, `REPORT.md` |
| Boundary | `expanded_outputs/20261008T142703_316466Z/boundary_plan.json` |
| Saved geometry | `route_coverage_runs/20261008T140112_006152Z/routes.json` |
| Feature bundle | `route_feature_runs/20261009T170001_897709Z/run_manifest.json`, `route_features.json`, `feature_evidence.json`, `duplicate_review.json`, and three per-route JSON files |
| Saved comparison | `route_comparison_runs/20261010T060453_649409Z/run_manifest.json` and `comparison.json` |
| Code | Preserve the geographic Python modules imported by the loader, alongside these files; shipping only `backend/` is insufficient. |

All 13 manifest-listed artifacts checked in this audit match their hashes. The six extraction artifacts total **7,603,531 bytes**, including the small 187,941-byte pilot PBF. The regional approximately 247 MB source PBF and approximately 11 GB SQLite extraction index described in earlier reports are **not request-time dependencies**. Regeneration/research workflows have additional source/storage needs; their absence is not itself a demo-runtime defect.

No missing untracked geographic dataset dependency was identified for the current live evidence/saved comparison request paths. Local virtual environments, installed packages and secrets are untracked dependencies, however. A tracked-data inventory is not proof that a fresh checkout installs and serves successfully.

`data/ranchi_safety/.gitignore` contains deliberate exceptions for the selected pilot. `.gitattributes` disables newline conversion for research bytes and restores CRLF for specified dynamic validation fixtures. Preserve these attributes and exact artifact/source bytes when packaging. A format or line-ending rewrite can invalidate integrity checks or change evidence identity; do not rewrite pins to bypass failure.

Backend lookup uses `Path(__file__)` and repository-relative parents rather than a hardcoded `D:` runtime root. The shell runbooks and the existing two-venv arrangement are machine-specific. Retaining relative paths allows a different root in principle, but **does not solve the dynamic verifier's backslash defect on POSIX** (`verify_post_extraction.py:43–49`). The saved reader's `child()` already normalizes backslashes (`pilot_ranchi.py:123–125`).

## 5. Verified startup instructions and verification limits

**Instruction status:** the commands below are cross-checked against source, installed tool metadata and prior runbooks. Existing servers respond now and Phase 7B records successful application use. A clean, cold invocation of these commands was **not performed in Stage 1**. Calling them “verified instructions” must not be read as fresh-start acceptance.

### Preconditions

- Use Windows 11/VS Code with PowerShell and the verified Node/Python environment. The OS edition and VS Code GUI were not independently checked here.
- Confirm the intended server owners on 8011 and 8080, using `Get-NetTCPConnection -State Listen` or `netstat -ano`; stop only your own stale server from its terminal. This audit did not terminate anything.
- Backend must already have compatible geographic imports, either installed in its own environment or exposed by the previously documented workaround. The audit shell currently meets neither condition for the backend interpreter alone.
- Frontend must already have the intended API mode/base URL; the local `.env.local` matches these, but existing server process overrides are unverified. Backend provider credential must be provisioned privately for live routes.

### Terminal 1 — backend, after dependency prerequisites are satisfied

```powershell
Set-Location D:\shepath
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8011 --workers 1 --limit-concurrency 32 --lifespan on
```

`--app-dir backend` permits launching from the repository root. Use lifespan on; the evidence service is initialized through ASGI lifespan. Do not infer dataset readiness from the Uvicorn startup message because loading is lazy.

The historical prerequisite for the existing split environment is the following setting in a dedicated backend terminal, **shown for documentation only; not executed or changed by this audit**:

```powershell
$env:PYTHONPATH = 'D:\shepath\data\ranchi_safety\.pbf_venv\Lib\site-packages'
```

It replaces that terminal's previous PYTHONPATH and relies on compatible Python/OS builds. Stage 2 should remove the need for this workaround by validating a self-contained environment. Without either remedy, the server may start and health/saved comparison may work while dynamic evidence fails with dataset/dependency unavailable.

### Terminal 2 — frontend, with existing correct configuration

```powershell
Set-Location D:\shepath\frontend
npm.cmd run dev -- --host 127.0.0.1 --port 8080 --strictPort
```

Use `npm.cmd` to avoid PowerShell npm script-policy ambiguity. Do not accept a silent move to an unsupported origin. The prior sandbox `spawn EPERM` was an execution-environment restriction, not proof of a broken dependency; do not weaken Windows security policies as a demo workaround.

### Terminal 3 — capability smoke sequence

```powershell
Invoke-RestMethod 'http://127.0.0.1:8011/health'
$savedComparison = Invoke-RestMethod 'http://127.0.0.1:8011/pilot/ranchi/comparison'
$savedComparison.status
$savedComparison.comparison.routes.Count
```

Then open `http://127.0.0.1:8080` and rehearse Albert Ekka Chowk → Doranda in API mode. Verify live routes, dynamic evidence, selection through overview/report and restart. This last step is a **pending fresh rehearsal**, not a Stage 1 execution. Health, saved comparison and dynamic evidence are separate readiness checks; a successful health response cannot replace them.

Fresh-clone setup would additionally need compatible runtime installation, a new backend venv with `backend/requirements.txt`, frontend `npm ci`, private provider configuration and the full tracked data layout. None was executed. The root README remains effectively empty; frontend README still contains screenshot-era instructions and references an ignored/untracked `.env.example`. A clone therefore lacks a reliable current setup entry point and that referenced template.

## 6. Deployment requirements and blockers

### Build and hosting

The declared build command is `npm.cmd run build` from `frontend/`, with build dependencies installed and production frontend variables chosen beforehand. Phase 7A recorded successful client/SSR/Nitro output; no build was rerun. Current ignored output metadata and Vite wrapper support a **Cloudflare module SSR target**. `npm.cmd run preview` exists, but production-preview acceptance was not executed.

Do not assume uploading only `.output/public` preserves this SSR application, or that the generated worker entry is automatically a generic Node server. Choose and test an explicit frontend hosting target. If selecting a Node target, the adapter/output/launch contract needs separate validation. No hosting provider capability or current pricing was independently researched here; these are requirements inferred from repository output.

The current Python backend is not included in the frontend worker artifact. It needs an ASGI-capable runtime, compatible native packages, lifespan, access to the preserved local data/code hierarchy, and controlled process restart. Serve the pinned files from the deployment image or a correctly mounted read-only volume; request-time extraction or writable dataset storage is unnecessary. Working directory independence does not permit omitting the data tree. Resolve POSIX paths and run parity tests on the selected host before considering Linux acceptance.

Production additionally needs an HTTPS backend URL in the client build, explicit deployed frontend origin(s) in backend CORS, an appropriate reverse-proxy timeout, private credential provisioning, process supervision and measured resource limits. No production auth/rate-limiting policy or deployment acceptance is established by this prototype; bound public API use to protect provider quota and single-worker analysis capacity before public exposure. Local `127.0.0.1` binding intentionally does not constitute public service exposure.

### Runtime resources and deadlines

| Behavior | Source/prior evidence and consequence |
|---|---|
| Lazy initialization | `route_evidence.py:150–168` loads one dataset per worker. Failed initialization is latched until restart; health can remain OK. Warm the actual evidence capability before presenting. |
| One admitted job | One executor thread plus nonblocking gate per worker; other analyses receive 503 busy. Several workers multiply dataset/native memory. Browser serialization is not a server-wide queue. |
| Evidence deadlines | Backend response deadline 60 s; client 75 s per request; body 1 MiB/10 s; bounded vertex complexity. Queue/backoff time is additional. Running native work retains its slot after timeout/cancellation until completion. |
| Retry | Only explicit evidence busy gets up to two retries with 5–15 s backoff. Other evidence failures do not automatically retry; no dedicated evidence-only retry control exists. |
| Routing | 60 s client request signal; upstream httpx timeout 15 s per operation, with several geocoding/directions operations possible. Logical navigation cancellation does not abort routing transport. |
| Saved comparison | Client 30 s signal; backend verifies saved artifacts on each request, with 8 MiB per-file read bound. This is independent of the dynamic dataset's cached initialization. |
| Memory | Historical loader measurements: 7.25 MiB exports, 9.19 MiB retained Python-managed allocations, 57.55 MiB peak Python-managed loading. These exclude interpreter/native GEOS/PROJ heaps and per-analysis workspace. They are not deployment RSS limits. |
| Latency | Phase 7A recorded route HTTP 2.62 s and evidence 1.56/1.97/2.73 s for its Railway Station journey; its in-process parity timings were 6.22/2.77/6.33 s. Neither is a measured production cold-start SLA or a Doranda demo guarantee. No latency/RSS benchmark was performed now. |

Proxy/platform deadlines must be tested against cold loading and large JSON responses. A platform that kills requests early or lacks sufficient memory/file access is not accepted merely because the frontend builds. A stuck native computation may require owned-worker restart; increasing browser retries does not solve it.

### Secrets, licensing and attribution

Root ignore rules exclude `.env` and `.env.*`, including the example file; backend and frontend add local-environment/build exclusions. Current secret files are untracked. This is not a full Git-history secret scan or security certification. The backend loader preserves existing process values; secret rotation therefore needs a deliberate runtime procedure, not an assumption that editing a file updates an existing process. Never put credentials in `VITE_*`, generated client assets or public logs.

The dataset declares **© OpenStreetMap contributors, ODbL 1.0**, with Geofabrik source provenance and snapshot `2026-10-08T20:21:06Z`. Preserve attribution, license and timestamps with any packaged data. Existing UI attribution is present but map credit is tiny/plain text and source/license links need improvement (Phase 7A M07). Public distribution and use of external tile/provider services require a deployment-specific review of the applicable terms; this audit does not certify legal compliance or authorize bulk tile caching. No new external data or paid service is needed for the current demo.

## 7. Prioritized findings

No Critical finding established. Severity reflects startup/deployment/demo impact, not a claim of a security exploit.

| ID / priority | Evidence and locations | Impact / Stage 2 recommendation |
|---|---|---|
| **H01 — High: dynamic paths are Windows-specific** | S/V: `data/ranchi_safety/verify_post_extraction.py:43–49`; pinned extraction manifest `artifacts`; contrast `backend/app/pilot_ranchi.py:123` | Conventional POSIX layout would fail artifact lookup and latch dataset unavailable. Normalize path interpretation safely in code, preserve containment checks and all manifest/artifact bytes; validate Windows/Linux identity/parity. A verifier source change affects recorded code hashes/evidence identity, so document the intentional versioned change rather than claiming identical evidence hashes. |
| **H02 — High: split local environment** | V/H: `backend/requirements.txt:1`; `backend/docs/RANCHI_ROUTE_EVIDENCE_API.md:10–30` | Backend venv lacks geographic packages; an undocumented terminal can appear healthy but fail evidence. Provision/test a self-contained compatible environment in Stage 2; no install now. |
| **H03 — High: production topology/configuration not accepted** | S/V: `frontend/vite.config.ts:9`; existing `.output/nitro.json`; `backend/app/main.py:19`; `apiBaseUrl.ts:3` | Worker-targeted frontend is separate from filesystem/native Python backend; local URL/CORS cannot serve a public deployment as-is. Select target, package data, define HTTPS origins/secrets and test preview plus backend on the actual platform. |
| **H04 — High: cold startup and portable install unverified** | H/P: Phase 7A H01; Phase 7B section 7; root `README.md:1`, `frontend/README.md:15` | Current HTTP success is not proof of a fresh clone or restart. Add an authoritative runbook and perform clean install/start/capability acceptance under Stage 2 authorization. |
| **M01 — Medium: inconsistent API base/defaults** | S/V: `apiBaseUrl.ts:3`; `savedPilot.ts:175`; local frontend file check | Current local file fixes 8011, but missing configuration sends live clients to 8000 and prevents saved loading. Standardize/document explicit base configuration and avoid misleading fallback. |
| **M02 — Medium: dependency and example gaps** | S/V: `backend/requirements.txt`; `frontend/package.json`; two lockfiles; `.gitignore:4` | No full backend lock/runtime pin; referenced example ignored. Document Python 3.11+/tested Node, select npm lock workflow and add reviewed secret-free examples in a later implementation. |
| **M03 — Medium: health lacks capability readiness** | S/V: `main.py:53`; `route_evidence.py:159–168` | Health success does not validate key/provider/data. Add a deliberate local capability preflight that avoids exposing secrets or running paid/unbounded checks; report failures separately. |
| **M04 — Medium: bounded but slow failure behavior** | S/H: `route_evidence.py:185–199`; `routeEvidence.ts:49,98`; `ShePathMap.tsx:19,43,61` | Evidence queue/retained busy slot can outlast demo budget; map setup-ready is not all tiles loaded; stalled tiles lack a deadline. Rehearse recovery and owned-worker restart, then scope any UI improvements. |
| **M05 — Medium: no deployment resource/security acceptance** | S/P: backend ASGI/admission code and deployment docs | No measured total RSS/load, public abuse protection, supervision or production proxy test. Establish these before public exposure; do not extrapolate Python allocation measurements. |
| **M06 — Medium: quality/attribution/accessibility pending** | H/S: Phase 7A M03/M07/M08/M09; `styles.css:92`; `RouteEvidencePanel.tsx:36` | Lint fails; retry focus, source readability, keyboard/AT and mobile acceptance remain. Preserve responsible copy and correct only reviewed failures. |
| **L01 — Low: bundle/toolchain warnings** | H: Phase 7A validation; `frontend/package.json` | 515.59 kB client chunk and build warnings need measured maintenance, not last-minute upgrades. |
| **L02 — Low: persistence/offline limits** | S: `frontend/src/routes/index.tsx:81,302`; `SavedRanchiPilot.tsx:25` | Reload resets journey state; saved entry fetches API again. Document in presentation and defer durable offline/history work. |

## 8. College demo reliability and fallback

A five-to-ten-minute demonstration is realistic for the successful Phase 7B desktop happy path **after startup and warm-up are complete**. It is not realistic to include dependency installation, initial troubleshooting or worst-case sequential timeouts in that budget. No timed rehearsal was observed here.

Suggested sequence: 0–1 min introduce limits and enter Doranda; 1–2 min preference preview (no routing effect); 2–4 min live route comparison and Route 2 selection; 4–6 min overview/evidence (63 min, about 5.3 km and 54/9/1/11 records were the historical manual observations, not fixed future expectations); 6–8 min separate saved comparison and limitations; remaining time for questions/restart.

- Rehearse backend first, capability checks next, frontend last, then warm evidence on the chosen journey. Do not assume identical provider output next time.
- The saved comparison is a useful **provider/WAN failure fallback while localhost backend and artifacts work**. It is historical and separate, even if live place names match. It does not rescue a stopped backend, missing files or a full application outage.
- If tiles fail, use textual route cards/evidence. Current map handling catches setup/import and tile errors and offers two manual retries per mounted view; no route/evidence recalculation is caused by map retry. Stalled tile requests without an error event remain a gap.
- Pending routing interrupted by a saved detour has Retry route/Edit journey recovery; stale responses must remain ignored. This behavior is source/test-backed, not newly exercised in a browser here.
- If WAN fails after route geometry is loaded, local evidence can still analyze it with functioning local dependencies. Fresh live routing cannot be assumed; external fonts/tiles may be missing. A reload can lose useful state.
- Prepare local historical screenshots/recording for complete application failure. Explicit mock mode can demonstrate interface only if separately configured/rehearsed later; do not silently change mode during this audit or pass mock/saved values off as live.
- Limit on-stage troubleshooting to roughly 20–30 seconds before switching to the prepared fallback. This is a presenter choice, not an application timeout change.

All narration must distinguish estimates, historical mapped records and uncertainty. No mapped proximity measure establishes real-world personal safety, current business opening, lighting quality, sidewalk continuity or conditions on the exact street walked.

## 9. Recommended Stage 2 implementation plan

1. **Reproducible startup first:** document one Windows runbook, runtime versions, package manager, explicit ports/base/mode and private credential provisioning; introduce reviewed tracked examples without secrets. Verify a self-contained backend environment and clean npm install in an isolated setup. Do not overwrite the working demo environment blindly.
2. **Fix portable artifact lookup:** scope separator normalization to validated relative paths, retain path containment/hash enforcement and preserve all stored artifacts/manifests. Add meaningful Windows/POSIX path tests and geometry/metric parity checks. Document the changed verifier code hash and resulting evidence-identity consequences; never regenerate pins to suppress errors.
3. **Add capability preflight/readiness guidance:** distinguish process health, provider routing, saved bundle and dynamic dataset readiness; bound time and output. Keep provider credentials private and avoid automatic provider calls on every health poll.
4. **Select deployment topology:** choose frontend adapter and separate Python hosting, package exact data/code paths, configure HTTPS API/CORS, secrets, process lifecycle and proxy deadlines. Verify clean build/preview and backend behavior on the actual target before any deployment authorization.
5. **Close demo/operational acceptance:** controlled restart, timed rehearsal, failure recovery, resource measurement, keyboard/AT and relevant device checks. Then address scoped lint, attribution and configuration-message maintenance. Preserve the existing interface and five-step workflow.

Exit criteria: isolated install/start evidence; selected-platform artifact verification and identity/metric regression evidence; three independent capability checks; no blocking demo recovery defect; documented static-check outcomes and remaining limits. Deployment itself is a separate action. Stage 1 authorizes none of these fixes.

## 10. Manual verification checklist and remaining assumptions

All unchecked items are pending, even where prior source/tests provide supporting evidence:

- [ ] Record Windows/VS Code/browser versions, viewport, commit and process ownership; perform a controlled cold start on 8011/8080 without port drift.
- [ ] Verify a fresh clone with only tracked files plus deliberately provisioned dependencies/secrets; do not rely on either current virtual environment or ignored build output.
- [ ] Validate Python/native imports in the self-contained backend; Node/npm lock installation and build; ensure no secret appears in client assets.
- [ ] Verify health, saved comparison, live route and dynamic evidence separately; preserve ordered geometry/hash/provenance and unknown-data messages.
- [ ] On the chosen deployment OS, verify manifest lookup, boundary, saved-route links, hash checks and parity; Linux has not passed this audit.
- [ ] Test actual public-origin CORS/HTTPS and backend/proxy timeout behavior before public deployment; local CORS success is insufficient.
- [ ] Rehearse five-step Doranda flow, all available alternatives, pending saved detour/retry, map failure/retry, evidence unavailable and journey restart within 5–10 minutes.
- [ ] Test Tab/Shift+Tab/Enter/Space/Escape where relevant, focus visibility/restoration, NVDA/Narrator announcements, 200%/400% zoom and narrow/short screens; then physical mobile/tablet behavior before claiming support.
- [ ] Confirm fallback works with WAN unavailable and, separately, backend unavailable; saved API data is not a browser-offline cache.
- [ ] Measure cold/warm latency, total process RSS and concurrent/busy behavior; validate owned-worker restart and source-update procedures without modifying pinned snapshots.
- [ ] Review attribution/provider/dataset terms for the chosen distribution; preserve snapshot timestamps and ODbL/source credit.

Unverified assumptions: existing server process commit/environment provenance; credential validity/quota today; fresh installation resolution; native package compatibility beyond previously reported runs; target hosting support; full data reconstruction/integrity at runtime today; production security/availability; physical-device and accessibility acceptance. Historical test success is not recast as a fresh test run. No safety ranking or certified-safety claim is supported.

## 11. Final repository verification

Created only `PHASE_7C_STAGE_1_STARTUP_AUDIT.md`. Modified existing files: **none**. No configuration/environment changes, dependency installs, datasets downloaded, application fixes, deployments, commits or pushes.

Final `git status --short`:

```text
?? PHASE_7C_STAGE_1_STARTUP_AUDIT.md
```

Final `git diff --check`: passed with no output. Since that command omits untracked files, the new report was also checked using `git diff --no-index --check -- NUL PHASE_7C_STAGE_1_STARTUP_AUDIT.md`; no whitespace errors. A Git LF-to-CRLF advisory, if emitted, is not a failed whitespace check.
