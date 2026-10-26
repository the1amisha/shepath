# SHEPATH Phase 7C Stage 2B — Isolated Backend Verification Report

Report date: October 12, 2026 (Asia/Calcutta).

Repository: `D:\shepath`. Inspected HEAD: `25aa31da594b7c9071a481662ebd0eae23ef001b`. Working tree was clean at report preparation entry.

## 1. Outcome and scope

**User-supplied manual verification demonstrates successful installation and operation of a separate Windows backend environment in the existing repository workspace.** The Python 3.11.9 environment at `backend\.venv-demo` served health, the saved Ranchi comparison and dynamic geographic evidence on `127.0.0.1:8012`. Dynamic evidence was requested using saved Phase 5D geometry, without generating a new live route.

This advances the isolated-environment verification that remained pending in Stage 2A. It does **not** establish fresh-clone reproducibility, Linux portability/deployment, live routing from this environment, or complete browser end-to-end acceptance. It also does not establish that the original `backend\.venv` environment has been repaired or changed.

This task creates documentation only. Codex did not install dependencies, start or stop servers, call any endpoint, modify environment variables, read credentials, recalculate geographic evidence or change existing reports. No commit or push was made.

## 2. Evidence provenance

| Evidence class | Source and boundary |
|---|---|
| User-supplied manual verification | Windows 11, Python 3.11.9, `backend\.venv-demo`, server at `127.0.0.1:8012`, and the results in section 3. The exact execution timestamps and full terminal/HTTP transcripts were not supplied. The report date is not asserted to be the execution date of every manual check. |
| Independently executed by Codex | Read the Stage 1 audit, Stage 2A report and Windows startup guide; inspected requirements and relevant evidence implementation; parsed the existing Phase 5D Route 1 JSON artifact; ran Git baseline/status/whitespace checks. These are read-only repository checks, not repetitions of the manual runtime verification. |
| Historical validation | Stage 2A records 93 frontend tests and five checker tests passing, TypeScript/build and targeted semantic lint passing, plus missing geographic imports in the original backend interpreter. Those results were not rerun and are not new Stage 2B test passes. |

Reviewed documents:

- [Phase 7C Stage 1 startup audit](PHASE_7C_STAGE_1_STARTUP_AUDIT.md)
- [Phase 7C Stage 2A report](PHASE_7C_STAGE_2A_REPORT.md)
- [Windows startup guide](../WINDOWS_STARTUP.md)

No independent inspection of the isolated server process environment, resolved dependency inventory or package import paths was performed. Its use as a separate Python 3.11.9 environment is recorded from the user's account, rather than certified by a new process inspection.

## 3. User-supplied manual results

| Check | Observed result supplied by the user | What it establishes |
|---|---|---|
| Dependency installation | `pip install -r backend/requirements.txt` completed in `backend\.venv-demo` | Installation succeeded in this separate environment within the existing checkout. |
| Dependency consistency | `pip check` reported no broken requirements | Installed package requirements were internally consistent at the time; not a full lockfile or portability guarantee. |
| Geographic imports | Shapely, pyproj and osmium imported successfully | Native geographic dependencies were usable in the tested environment. |
| Independent backend startup | FastAPI started on `127.0.0.1:8012` | Separate local server startup succeeded. Port 8012 was used for verification, not a replacement of the documented 8011 demo configuration. |
| `GET /health` | HTTP 200 | Health endpoint responded. The user did not provide its response body for this check, so an exact body is not added as an observation. |
| `GET /pilot/ranchi/comparison` | `status: available`, three routes | Saved comparison was served by the isolated backend. |
| Saved geometry input | Loaded saved Phase 5D route with **159 coordinate points** | Existing route coordinates were used as input; no new route-generation result was required. |
| `POST /pilot/ranchi/route-evidence` | Available response with the identity/coverage values below | The isolated backend successfully analyzed this supplied geometry using the existing local evidence pipeline. |

Reported evidence response:

| Field | Value |
|---|---|
| `schema_version` | `SHEPATH.dynamic_route_evidence.v1` |
| `status` | `available` |
| `route.id` | `heigit-foot-walking-route-1` |
| `route.geometry_sha256` | `d9f3307bcc18af2403eac7851006d58ec874faa3c249f9cccb6d203c41f4b460` |
| `evidence_identity_sha256` | `d28750b4d8a3b99a3dc7abe7ef36f905d321bb28c12182d2432d3fdc50c00e2b` |
| `coverage.centerline_fully_covered` | `true` |
| `coverage.full_buffer_covered` | `true` |

No new `POST /route` or other live routing-provider request was part of the reported sequence. Saved-comparison reads and geometry-based local evidence analysis are separate from live geocoding/directions. Success here does not validate a HeiGIT credential, provider connectivity or available routing quota.

## 4. Independent repository cross-check

Codex parsed, without modifying or recomputing it:

`data/ranchi_safety/dynamic_validation/heigit-foot-walking-route-1.json`

The stored artifact contains **159 coordinates**, the same schema, route ID, available status, both reported SHA-256 strings, and both coverage flags set to true. No contradiction was found between the supplied result fields and this saved artifact.

This is a **field-by-field comparison of the user-supplied values with stored JSON**, not an independently captured response from port 8012, a new hash computation or a full response-parity test. The manual response's complete coordinate array and full JSON were not supplied; byte-for-byte response equality is therefore not claimed.

Relevant implementation findings:

- `backend/requirements.txt` declares Shapely 2.1.2, pyproj 3.7.2 and osmium 4.3.1; FastAPI, httpx and Uvicorn remain unpinned. Successful installation does not produce a complete reproducible dependency lock.
- `backend/app/route_evidence.py:164–170` lazily loads `PilotDataset` and calls the analyzer with a fixed nominal 100 m buffer. Its lifecycle requires ASGI lifespan support.
- `data/ranchi_safety/dynamic_route_evidence.py:173–184` exposes a geometry identity and a separate evidence identity. Evidence identity incorporates geometry, analysis, schema and source provenance; provenance includes code hashes and geographic package versions. The two identities must not be treated as interchangeable.
- The saved artifact records source snapshot **`2026-10-08T20:21:06Z`**, not current street conditions. This timestamp is independently read from the historical artifact, not an additional user-supplied response field.

Matching the reported identities supports consistency with the stored Phase 5D result for this case. It does not establish validity for other route geometries, all failure paths or future dependency resolutions.

## 5. Command record and reproducible reference sequence

The user supplied the installation command and descriptions/results of the other checks, not a verbatim command transcript. The following PowerShell commands are **reference equivalents consistent with those checks and the current runbook**. Codex did not execute them in this task. Do not infer that every shown optional Uvicorn flag or timeout was used in the original manual session.

### Installation and import checks

Run from the repository root using the already-created isolated environment. These installation commands document the completed manual work; they are not instructions to reinstall the working backend or overwrite an existing environment.

```powershell
Set-Location D:\shepath
.\backend\.venv-demo\Scripts\python.exe --version
.\backend\.venv-demo\Scripts\python.exe -m pip install -r backend\requirements.txt
.\backend\.venv-demo\Scripts\python.exe -m pip check
.\backend\.venv-demo\Scripts\python.exe -c "import shapely, pyproj, osmium; print('Geographic imports OK')"
```

Observed Python version: 3.11.9. Reported consistency/import results: no broken requirements; all three imports succeeded. Exact resolved web-package versions and installation logs were not provided.

### Independent server on 8012

In its own terminal, the runbook-equivalent launch is:

```powershell
Set-Location D:\shepath
.\backend\.venv-demo\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8012 --workers 1 --limit-concurrency 32 --lifespan on
```

Port 8012 separates this test from the usual backend port 8011. No frontend URL or credential change is required for the direct HTTP checks below. The report does not claim that the frontend was pointed at this server. Do not assume a frontend still configured for 8011 exercises `.venv-demo` on 8012.

### Health, saved comparison and saved-geometry evidence

In a second terminal:

```powershell
Set-Location D:\shepath
Invoke-RestMethod 'http://127.0.0.1:8012/health' -TimeoutSec 5
$comparison = Invoke-RestMethod 'http://127.0.0.1:8012/pilot/ranchi/comparison' -TimeoutSec 30
$comparison.status
$comparison.comparison.routes.Count

$phase5d = Get-Content -Raw -LiteralPath 'data\ranchi_safety\dynamic_validation\heigit-foot-walking-route-1.json' | ConvertFrom-Json
$phase5d.route.coordinates.Count
if ($phase5d.route.coordinates.Count -ne 159) { throw 'Unexpected saved geometry; stop and inspect without changing artifacts.' }
$payload = @{
    route_id = $phase5d.route.id
    coordinates = $phase5d.route.coordinates
    distance_metres = $phase5d.route.supplied_distance_metres
    duration_seconds = $phase5d.route.supplied_duration_seconds
} | ConvertTo-Json -Depth 8
$evidence = Invoke-RestMethod 'http://127.0.0.1:8012/pilot/ranchi/route-evidence' -Method Post -ContentType 'application/json' -Body $payload -TimeoutSec 80
$evidence.schema_version
$evidence.status
$evidence.route.id
$evidence.route.geometry_sha256
$evidence.evidence_identity_sha256
$evidence.coverage.centerline_fully_covered
$evidence.coverage.full_buffer_covered
```

This reference uses the reviewed Phase 5D JSON as the geometry source; the exact file-loading command from the manual session was not supplied. It preserves the ordered `[latitude, longitude]` coordinates and does not sort, simplify, regenerate or substitute them. The evidence request is a real local computation on saved input, not a replay of the saved response. There is deliberately **no live route POST** in the sequence.

## 6. Progress relative to Stage 1 and Stage 2A

| Earlier gap | Stage 2B disposition |
|---|---|
| Separate environment installation untested in Stage 2A | **Manually verified in the existing workspace** for `.venv-demo`, Python 3.11.9 and the reported requirements installation. |
| Geographic imports absent from original backend interpreter | Separate environment imports passed. This does not change the historical failure or prove that the original `.venv` now has those packages. |
| Isolated backend start/capabilities unverified | Manual startup on 8012, health, saved comparison and one saved-geometry dynamic evidence request passed. |
| Fresh-clone reproducibility | **Still unverified.** Existing repository files, datasets and local machine state were available; no clean-clone installation was reported. |
| Live routing from isolated environment | **Still unverified.** No new live route was requested. |
| Linux path portability/production hosting | **Still pending.** No Linux fix or deployment validation was performed. |
| Browser, keyboard, AT and device acceptance against isolated backend | **Still pending.** Direct HTTP checks do not establish frontend integration or browser behavior on 8012. |

Existing reports and the Windows guide were intentionally left unchanged. Their statements that isolated installation was untested describe the evidence available during those earlier stages; this report records the subsequent manual verification without rewriting history.

## 7. Limitations and remaining work

1. **Capture environment provenance for reproducibility:** retain a redacted install/check/start transcript, resolved package versions and interpreter/import paths, and confirm that the isolated server does not rely on inherited PYTHONPATH or other external environment state. No such independent isolation audit was executed here.
2. **Perform a true fresh-clone test separately:** provision a clean checkout/environment and verify required tracked artifacts, dependency resolution and capability checks. Do not claim this from an isolated venv inside an already-working checkout.
3. **Test live routing only deliberately:** with authorization to use provider quota and privately provisioned credentials, validate `/route` from the isolated server, then send its exact newly returned geometry for evidence. Keep saved and live identities separate.
4. **Validate the browser against the intended backend:** deliberately select the endpoint in a future authorized session, rehearse all five screens, selection, saved detours/recovery and restart. Direct HTTP success neither tests browser CORS enforcement nor proves the UI uses port 8012.
5. **Retain outstanding acceptance work:** keyboard/AT, mobile/tablet, failure handling, resource/latency measurements, full dependency locking, Linux path handling and production operations remain separately scoped. No new full automated suite, build, capability-checker run or performance benchmark was performed for this report.

The evidence endpoint's success applies to the reported geometry and local historical pilot. Full centerline/buffer coverage means geometric containment, not complete real-world mapping. Historical mapped proximity does not establish personal safety, current business operation, lighting quality, sidewalk continuity or conditions on the exact street walked. Source provenance and responsible disclosures remain unchanged.

**Readiness conclusion:** the manual results strengthen confidence in a separately installed Windows backend serving the existing local demo's saved and geographic-evidence capabilities. They do not certify complete product reproducibility, isolated live routing, full end-to-end browser behavior or deployment readiness.

## 8. Final file and Git verification

- Created: `PHASE_7C_STAGE_2B_REPORT.md`.
- Modified existing files: **none**.
- No application, dataset, manifest, hash, environment-variable, credential or existing-report changes. No commit or push.

Final `git status --short --untracked-files=all`:

```text
?? PHASE_7C_STAGE_2B_REPORT.md
```

Final `git diff --check`: passed with no output. Because ordinary Git diff omits untracked files, the new report also received a read-only trailing-whitespace check, which passed. These repository checks do not constitute runtime validation.
