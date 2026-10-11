# SHEPATH Windows 11 startup and demo guide

This is the authoritative local-development runbook. Earlier phase reports are historical evidence, not setup instructions. Linux portability and production deployment are out of scope. The five-step interface compares walking estimates and historical mapped context; it does not assess personal safety.

## Runtime baseline and acceptance status

| Runtime | Use for the local demo | Evidence |
|---|---|---|
| Python | CPython 3.11, preferably the tested 3.11.9 build | Existing backend tests passed on 3.11.9; pyproj 3.7.2 requires Python >=3.11. Other versions are not locally accepted. |
| Node.js | Tested v24.18.0 | TanStack Start requires >=22.12.0; Node 20 meeting Vite's requirement alone is insufficient. Other supported-by-metadata versions still need rehearsal. |
| npm | Tested 11.16.0 | Use the tracked npm package-lock with `npm.cmd ci`; do not switch to Bun's lock during setup. |
| Geographic packages | Shapely 2.1.2, pyproj 3.7.2, osmium 4.3.1 | Declared in backend requirements; native imports must succeed in the interpreter used to launch Uvicorn. |

**Fresh-clone installation is documented below but has not been successfully tested in Stage 2A.** Existing tests/build are not fresh-install acceptance. Backend web requirements are not a complete transitive lock. Previously tested versions are FastAPI 0.142.2, Pydantic 2.13.5, Starlette 1.7.0, httpx 0.28.1 and Uvicorn 0.54.0; a new resolution can differ. Record installed versions and rerun checks before accepting a new installation.

## 1. Fresh clone and installation (new environment only)

Clone the repository using your normal Git access, open its root in VS Code and use PowerShell. The commands assume `D:\shepath`; substitute your actual checkout root. Preserve the tracked `data/ranchi_safety` tree and `.gitattributes`. Do not run extraction, regenerate manifests or normalize geographic source/data line endings.

**Do not run installation commands against the existing working backend without approval.** For an isolated validation in this workspace, the proposed commands below require approval before execution. They create `backend/.venv-demo`, never delete or replace `.venv`, and stop if the target already exists:

```powershell
Set-Location D:\shepath
if (Test-Path -LiteralPath backend\.venv-demo) { throw 'Choose a new empty environment path; do not overwrite this one.' }
py -3.11 -m venv backend\.venv-demo
.\backend\.venv-demo\Scripts\python.exe -m pip install -r backend\requirements.txt
.\backend\.venv-demo\Scripts\python.exe -m pip check
.\backend\.venv-demo\Scripts\python.exe -c "import shapely, pyproj, osmium, fastapi, uvicorn; print('Backend and geographic imports OK')"
```

For a genuinely new checkout, this is also the dependency installation procedure; do not copy Windows virtual environments between machines. Use platform-compatible wheels and a matching Python architecture. No second geographic venv or PYTHONPATH borrowing should be necessary for this self-contained setup.

In the **new checkout**, install the frontend from the existing lockfile:

```powershell
Set-Location D:\shepath\frontend
node --version
npm.cmd --version
npm.cmd ci
```

`npm ci` replaces that checkout's node_modules: do not run it in a working installation as an incidental preflight. For isolated full-install validation, use a separate checkout and obtain approval first. Never upgrade dependencies as part of a presentation rehearsal.

## 2. Private configuration without overwriting existing files

The exact committed example paths are `backend/.env.example` and `frontend/.env.example`. Only those two paths are exceptions to the environment ignore rules. Actual `.env`, `.env.local`, backups and similarly named files remain ignored.

From the root, create copies only if the destinations do not exist:

```powershell
Set-Location D:\shepath
if (-not (Test-Path -LiteralPath backend\.env)) { Copy-Item -LiteralPath backend\.env.example -Destination backend\.env }
if (-not (Test-Path -LiteralPath frontend\.env.local)) { Copy-Item -LiteralPath frontend\.env.example -Destination frontend\.env.local }
```

Privately fill `HEIGIT_API_KEY` in `backend/.env` using your existing HeiGIT credential. The example deliberately has an empty value. Never paste the key into commands, screenshots, reports or a `VITE_*` variable. Do not replace an existing credential. An existing backend process environment value takes precedence over the file, even if empty; restart the owned backend deliberately after configuration changes. Credential presence does not establish validity or available quota.

The frontend configuration should be:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8011
VITE_ROUTING_PROVIDER=api
```

There is no implicit port-8000 fallback. Live routes, geographic evidence and the saved comparison all require this explicit base. Missing or malformed URL produces configuration guidance in the existing request-error presentation; the landing page and mock interface can still load. Restart Vite after changes; built bundles require rebuilding. URLs with credentials, query strings or fragments are rejected. Do not put secrets in this public URL.

## 3. Start the backend, then frontend

Check for already-running servers before launching a second instance:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in @(8011,8080) } | Select-Object LocalAddress,LocalPort,OwningProcess
```

Identify the process locally. Reuse only a known current server or press Ctrl+C in its owning terminal. Do not kill unrelated processes. Use `netstat -ano` if the PowerShell network cmdlet is unavailable.

**Terminal 1 — self-contained backend environment:**

```powershell
Set-Location D:\shepath
.\backend\.venv-demo\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8011 --workers 1 --limit-concurrency 32 --lifespan on
```

Use the actual installed environment path. Activation is unnecessary because the command names the interpreter. `--app-dir backend` handles launching from the root; lifespan must be on. Do not change credentials or stop a working server merely to test these instructions without planning the restart.

**Existing-machine compatibility only:** prior successful runs used `backend/.venv` plus the compatible geographic `.pbf_venv` packages. If retaining that known setup, use its existing dedicated terminal and interpreter. The historical process-local setting is:

```powershell
$env:PYTHONPATH = 'D:\shepath\data\ranchi_safety\.pbf_venv\Lib\site-packages'
```

This replaces the terminal's PYTHONPATH and is not the fresh-clone recipe. Do not copy compiled packages across Python/OS versions. The working backend environment was not reinstalled in Stage 2A. A healthy server without geographic imports can still fail evidence initialization.

**Terminal 2 — frontend:**

```powershell
Set-Location D:\shepath\frontend
npm.cmd run dev -- --host 127.0.0.1 --port 8080 --strictPort
```

Open `http://127.0.0.1:8080`. Strict port prevents silently moving to a different origin. Backend CORS supports localhost/127.0.0.1 on 8080/8081, not arbitrary LAN origins. This guide uses 8080 consistently. A production frontend build is not a backend deployment and is outside this runbook.

## 4. Bounded preflight (no routing quota)

Use the **same interpreter and terminal environment intended for Uvicorn**:

```powershell
Set-Location D:\shepath
.\backend\.venv-demo\Scripts\python.exe -B scripts\check_local_capabilities.py
```

Substitute `.venv` only when checking the existing environment. Optional `--base-url http://127.0.0.1:8011` accepts only loopback HTTP with an explicit port. The script bypasses proxies and refuses redirects. Each of four subprocess probes has a 12-second deadline (at most 48 seconds of probe deadlines plus process overhead). HTTP reads have a 2 MiB bound and 4-second socket timeout. Raw responses, subprocess stderr, exception details and credentials are not printed.

| Result | Meaning |
|---|---|
| `health` | GET `/health` matches expected service and status. |
| `saved` | GET `/pilot/ranchi/comparison` returns available with three routes; not independent artifact recomputation. |
| `dependencies` | Native geographic imports and declared versions pass in the checker interpreter. This is **not** inspection of an already-running server's environment or dataset readiness. |
| `routing` | Credential presence checked privately with backend environment/file precedence. `CONFIGURED, NOT LIVE-VERIFIED` means no network/provider validation. |

Exit 0 means these prerequisites passed; exit 1 means at least one failed; invalid arguments exit 2. Neither exit 0 nor `/health` certifies live routing, artifact integrity, geographic coverage or browser rendering. The checker issues **no POST**, does not load the geographic dataset and has no automatic provider-test option. It does not mutate environment variables or stored data.

## 5. Deliberate live and evidence acceptance

These are manual checks, separate from the no-quota preflight. **The route POST below consumes normal provider requests; run deliberately once with the owned backend, not in a loop.** It does not place credentials in terminal output.

```powershell
Set-Location D:\shepath
Invoke-RestMethod 'http://127.0.0.1:8011/health' -TimeoutSec 5
$comparison = Invoke-RestMethod 'http://127.0.0.1:8011/pilot/ranchi/comparison' -TimeoutSec 30
$comparison.status
$comparison.comparison.routes.Count
$request = @{ origin='Albert Ekka Chowk, Ranchi'; destination='Doranda, Ranchi'; travelMode='walk' } | ConvertTo-Json
$live = Invoke-RestMethod 'http://127.0.0.1:8011/route' -Method Post -ContentType 'application/json' -Body $request -TimeoutSec 65
$live.routes | Select-Object id,distanceMeters,durationSeconds
if (-not $live.routes.Count) { throw 'No route returned; do not substitute saved geometry.' }
$route = $live.routes[0]
$payload = @{ route_id=$route.id; coordinates=$route.coordinates; distance_metres=$route.distanceMeters; duration_seconds=$route.durationSeconds } | ConvertTo-Json -Depth 8
$evidence = Invoke-RestMethod 'http://127.0.0.1:8011/pilot/ranchi/route-evidence' -Method Post -ContentType 'application/json' -Body $payload -TimeoutSec 80
$evidence.status
$evidence.route.id
$evidence.route.geometry_sha256
$evidence.coverage
$evidence.source_provenance.source_snapshot_timestamp
```

Evidence POST uses only local historical files, not the routing provider. Send the returned ordered coordinates unchanged. Check identity, coverage and source; a Ranchi place name does not guarantee coverage. `available` is not a safety assessment; `coverage_unavailable` is not zero facilities. Hash presence alone is not proof of equivalence to a saved route.

Rehearse all five screens in the browser: enter journey, preview/skip preferences, compare routes, select an alternative, inspect overview then evidence, restart. Verify matching route geometry/evidence, source disclaimers and saved/live separation. The saved comparison is a separate historical Albert Ekka Chowk → Doranda snapshot, not fallback geometry for a failed live calculation.

## 6. Troubleshooting and demonstration readiness

| Symptom | Action |
|---|---|
| Geographic dependency FAIL | Run the checker with the intended backend interpreter. Approve/provision a self-contained new environment; do not reinstall the working one implicitly. Health/saved success can coexist with absent geographic imports. |
| Evidence dataset unavailable after imports pass | Verify tracked repository layout, pinned artifacts, boundary and code bytes. Failed initialization latches until an owned-worker restart after repair. Never change hashes, manifests or dataset contents to bypass failure. |
| Port occupied | Identify owner and use its terminal; do not force-kill an unknown process or let Vite choose another port. |
| Missing/invalid VITE API URL | Inspect only the non-secret frontend settings, use explicit 8011, then restart Vite/rebuild. Existing process variables override file settings. |
| Health fails | Check terminal, interpreter, `--app-dir`, port and lifespan. Health checks process availability only. |
| Routing credential configured but request fails | Presence is not validity/quota/network readiness. Inspect the owned backend privately; check provider connection and location input. Do not dump environment or credentials. |
| Evidence busy/timeout | One job per worker; browser analyses are serial. Backend deadline 60 s, browser 75 s/request plus queue time. Native work can outlive cancellation and retain the slot. Avoid retry storms; use saved comparison or continue without evidence. |
| Saved unavailable | Requires explicit API URL and verified comparison/feature/saved-route artifacts; it is API-backed, not a browser cache. |
| Tiles/import fail | Use textual route cards/evidence and bounded Retry map. A failed cached module import may need reload, which resets the journey. No fake geometry should appear. |
| PowerShell npm issue | Use `npm.cmd`; do not weaken machine security policies. A sandbox `spawn EPERM` may require an approved execution context, not package replacement. |

Keep the entire tracked data tree. The small pinned pilot artifacts suffice for requests; no regional PBF/index download or new extraction is necessary. Preserve OSM attribution/ODbL and snapshot `2026-10-08T20:21:06Z`. Lighting, sidewalks, opening hours, pedestrian activity and real-world safety remain incomplete/unknown/unverified.

Start and warm capabilities before the 5–10 minute presentation. Rehearse interrupted route → saved → return recovery, map failure, keyboard focus and a timed fallback. If WAN fails but localhost works, the saved comparison remains useful; if backend fails, use a prepared clearly historical recording. Do not silently switch to mock mode or label mapped proximity as safety. Mobile/AT acceptance and production readiness remain separate.

## 7. Local regression commands

```powershell
Set-Location D:\shepath
.\backend\.venv-demo\Scripts\python.exe -B -m unittest discover -s scripts -p test_check_local_capabilities.py -v
.\backend\.venv-demo\Scripts\python.exe -B -m unittest discover -s backend/tests -v
Set-Location frontend
npm.cmd test -- --maxWorkers=1
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run build
```

Use your validated interpreter path. Backend suites require the geographic imports. Existing repository-wide frontend lint debt is documented in Phase 7A; do not run an unrestricted formatter across pinned geographic files. A fresh installation, controlled restart and full browser rehearsal must be recorded before claiming fresh-clone reproducibility.
