# SHEPATH Phase 5D — Final integration audit

Audit date: 2026-10-10, Asia/Calcutta. Repository: `D:\shepath`.

**Verdict: ready to commit as a bounded Ranchi prototype, subject to ordinary
diff review. Not a production-release certification or independently repeated
browser end-to-end pass.** All 178 relevant automated tests pass, TypeScript passes,
and the production frontend build succeeds. No runtime/geographic calculation
change was required by the checks performed. Stage 4 adds regression coverage and
this report only. Nothing was committed or pushed.

## Verification scope and evidence quality

| Evidence | What was actually established |
|---|---|
| User-supplied manual observations | Frontend at `http://127.0.0.1:8080`, backend at `http://127.0.0.1:8011`, walking routes/map, multiple dynamic evidence panels and separate saved comparison reportedly work |
| Independent browser automation | **Not executed.** Browser runtime reported `No browser is available`; discovery returned an empty browser list after consulting troubleshooting instructions |
| Local HTTP probes during this audit | Both reported ports refused connections from the execution environment (`WinError 10061`). This does not invalidate the user's earlier observations, but no current listening-server success was established here |
| Backend HTTP tests | Real FastAPI ASGI application exercised in-process through TestClient, including real local geographic analysis; live routing providers mocked |
| Frontend tests | React DOM/hook and typed-client tests with mocked fetch; map-prop/selection assertions use a map test double, not rendered Leaflet tiles |
| Cross-layer parity | Real backend output equals all three persisted Stage 1 responses; frontend's real parser consumes those same responses and checks identity, counts, denominators and snapshot |
| Visual, mobile and assistive-technology checks | Source/DOM accessibility and responsive-class review only; no independent screenshot, keyboard-in-browser, screen-reader or mobile rendering session |

No screenshots were attached to the Stage 4 request. None are represented as
independently inspected evidence. The audit did not call routing providers, paid
services or download datasets. Tests do not require the two local services to be
running. The browser skill was used only to attempt connection/discovery; no
alternative browser-control workaround was used.

## Automated test results

| Check | Final result | Scope |
|---|---:|---|
| Backend unittest discovery | **40 passed**, 0 failures/errors/skips; 21.355 s | Existing saved comparison and routing contract plus dynamic endpoint, source failures, bounds, cancellation and CORS policy |
| Offline geographic regressions | **80 passed**, 0 failures/errors/skips; 38.930 s | Dynamic engine, Phase 5A/5B, route containment and post-extraction geometry tests |
| Frontend Vitest | **58 passed in 6 files**, 0 failures; 11.67 s | Routing, saved pilot, dynamic client/hook/UI, cross-layer artifact parsing and request lifecycle |
| TypeScript | **Passed**, exit 0 | `tsc --noEmit` |
| Frontend production build | **Passed**, exit 0 | Client, SSR and Nitro/Cloudflare output |

Six additional audit cases were added: cycling and driving transport preservation,
parsing all three actual Stage 1 results with compact retention, cancelling busy
backoff, route-selection evidence isolation, and allowed/disallowed CORS preflights.
The backend tests deliberately emit errors for injected source/internal failures;
these are passing failure-handling cases. The installed Starlette emits an httpx
TestClient deprecation warning. Build warnings include the roughly **511.70 kB
minified / 156.25 kB gzip** main client chunk, tsconfig-path plugin guidance and
Nitro/rollup option guidance; none failed compilation.

Commands used, from PowerShell:

```powershell
Set-Location D:\shepath
$env:PYTHONPATH = 'D:\shepath\data\ranchi_safety\.pbf_venv\Lib\site-packages'
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
Push-Location data\ranchi_safety
.\.pbf_venv\Scripts\python.exe -m unittest test_dynamic_route_evidence test_route_features test_route_comparison test_route_coverage test_post_extraction -v
Pop-Location
Push-Location frontend
npm.cmd test
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run build
Pop-Location
```

The frontend tests used the approved execution context that permits Vite's Windows
subprocesses. Regional extraction tests were not rerun: no extractor, dataset or
geographic code changed. The 80 selected tests exercise the geometry and comparison
dependencies used by this integration. Historical Stage 1/2 logs were not overwritten;
the table above records the new audit runs.

## Route identity and lifecycle

1. `RouteData.coordinates` and both API contracts use **[latitude, longitude]**.
   The routing client validates coordinates without reversing, simplifying or
   replacing them. The map also passes this order to Leaflet. Missing geometry
   fails rather than falling back to saved coordinates or endpoints.
2. The frontend posts that exact ordered sequence, route label and optional
   distance/duration. On success it compares both echoed ID and the **entire echoed
   coordinate array** to the submitted route. Matching labels alone cannot pass.
3. Stage 1 geometry identity hashes ordered binary64 `float.hex()` representations,
   with signed zero normalized. Reversals, changed vertices and repeated vertices
   change identity. Evidence identity additionally includes schema, parameters,
   source/content hashes, implementation hashes and package versions.
4. The frontend retains the backend geometry/evidence hashes and compact provenance.
   It does not independently reimplement the Python hash; exact echoed geometry
   comparison and trust in the verified backend provide the client-side check.
5. Hook batches bind to the route-array instance and journey, execute only for
   enabled walking views, and abort/ignore previous work on dependency changes or
   unmount. The current UI's generated route arrays are replaced, not mutated.
   In-place mutation by a future caller would violate that existing lifecycle contract.
6. Routing itself has a generation guard: a late `/route` response after leaving
   or editing a journey cannot populate a later journey or start its evidence batch.
   Route selection selects the corresponding evidence entry and does not initiate
   a new analysis. Tests distinguish two options with different counts on details.
7. Leaving for the saved pilot cancels dynamic work. Returning can start a new
   dynamic batch on the preserved live geometry. Saved counts/profiles are never
   substituted, even when live IDs match saved IDs.

No failing identity or stale-assignment case was found in the tested flows.
Frontend routing tests preserve cycling/driving mode and geometry in `/route`
requests; hook tests skip their evidence. The current journey UI remains walking-only.
Actual cycle/drive provider journeys were not requested during the audit.

## Sequential requests and errors

The browser module maintains a single promise queue across component lifetimes.
A batch awaits each route before submitting the next. Explicit `analysis_busy`
gets at most two retries, waiting 5–15 seconds per Retry-After policy. Cancellation
stops backoff and queued I/O. Other errors do not automatically retry.

Each backend ASGI worker has one lazy dataset, one executor thread and a nonblocking
admission lock. It accepts at most one analysis/init job and rejects competitors
immediately, without an executor backlog. Analysis and JSON response encoding run
off the async event loop. After timeout/cancellation the executing job **retains
the slot until it finishes**. Browser abort cannot cancel a running native calculation.

| Condition | Backend/client behavior verified |
|---|---|
| Available | HTTP 200; validated identity and mapped evidence displayed |
| Outside route/full buffer | HTTP 200 `coverage_unavailable`, null context; UI displays extent limitation, not zero facilities |
| Invalid geometry | HTTP 422; finite/range/count/metadata and densified complexity checks; frontend leaves route usable |
| Busy | HTTP 503 `analysis_busy`; Retry-After, bounded frontend retries, no parallel evidence calls |
| Dataset missing/corrupt/dependency failure | Explicit HTTP 503 `dataset_unavailable`; no empty evidence; initialization failure latched until worker restart |
| Backend timeout | HTTP 504; thread slot remains occupied; frontend shows timeout and does not automatically retry |
| Network/CORS fetch rejection | Frontend displays connection/CORS guidance, preserves route; browsers deliberately do not distinguish these causes in fetch errors |
| CORS policy | Allowed loopback frontend POST preflights return 200 and matching ACAO; unconfigured origin preflight returns 400 without ACAO |
| Client stall | 75-second fetch deadline and cleanup tested |
| Oversized/slow body | Backend 1 MiB limit, including chunked requests; 10-second body timeout; explicit 413/408 |

CORS enforcement in an actual browser was **not** independently tested: preflight
tests establish server headers/policy, and mocked TypeError establishes client
handling. No corruption or timeout was induced on a live user server.

## Geographic evidence, provenance and terminology

The pinned Ranchi extraction manifest remains
`ae9d1e9134b276c4ca20297b02dacf38320e2ed98e001a4419788f310e9a1d0b`.
Stage 1 engine code remains
`f351e0e95f88e04cfa42c8ea774728394b0b0a4c2c63b47d7e6fb8dbc0c583e5`.
Tests recheck small artifact hashes and reconstruct geometry without accessing
the regional index/PBF. Verified datasets and pinned evidence were not overwritten.

The displayed snapshot is **2026-10-08T20:21:06Z** with OpenStreetMap contributors
attribution and ODbL 1.0. The pilot boundary is
`[23.335059, 85.308481, 23.38, 85.34]` (south, west, north, east). Entire centerline
and full 100 m analysis-buffer support are required, with the documented conservative
numerical guard. Coverage is not inferred from place names or route IDs.

| Saved geometry | Nearby roads | Businesses | Healthcare | Police | Full API result versus Stage 1 |
|---|---:|---:|---:|---:|---|
| Route 1 | 219 | 19 | 4 | 0 | Exact equality |
| Route 2 | 239 | 54 | 9 | 1 | Exact equality |
| Route 3 | 306 | 23 | 6 | 0 | Exact equality |

Backend TestClient timings in this audit were **4.56 s cold**, then **1.95 s** and
**3.46 s**. These are local in-process timings during concurrent testing, not live
browser latency or a throughput guarantee. The frontend parser independently accepts
the same three full artifacts and preserves displayed counts/tag denominators.

Counts refer to typed OSM records, not verified establishments. Lighting partitions
road records into yes/no/other/unknown. Lighting and sidewalk completeness use nearby
road-object denominators; business-hours availability uses business-object denominators.
The panel explicitly treats zero records, missing tags and real-world completeness
as uncertain; it makes no current-open, walked-street or personal-safety claim.
An empty selection can display `0/0` counts with unknown/no-record explanatory text;
engine percentages remain null, never invented confidence.

Ambiguous establishments remain separate with conditional duplicate scenarios in
the audit output. Category overlaps are disclosed. Unioned proximity prevents double
counting geographic coverage, while repeated traversal is preserved. Phase 5A's
object-line length denominators are distinct from unioned unique road-line length;
those long-form audit measurements are not presented as walked-street coverage.

**Terminology assessment:** generated live options use “Fastest” only for minimum
provider duration. Dynamic evidence and the saved comparison explicitly avoid safety
rankings. However, the older landing page/metadata still advertise “safer routes” and
“clear scores”, show an explicitly labeled mock safety score, and retain safety-report
and preference wording. This is legacy prototype copy, not validated evidence. It
should be corrected before public-facing release; this audit did not redesign or
remove the existing demo workflow. Production-wide wording therefore is not fully
ready even though the new evidence sections are appropriately qualified.

## Memory and prototype suitability

Sequential analysis is appropriate for the present single-worker prototype, at the
cost of cumulative latency over route alternatives. It is per-browser-module, not
global across tabs/users. Multiple workers each have their own slot and dataset.
Busy responses remain possible with multiple clients or an abandoned long calculation.

The new parser audit verifies **each retained presentation JSON is less than 5%**
of its full minified Stage 1 response. Original OSM geometries and echoed coordinate
arrays are discarded from evidence state after validation; the map's actual route
geometry remains in its normal route state. Full payload transfer and transient
JSON parsing still cost memory. This serialization-size assertion is not a measured
browser heap ceiling.

Historical Stage 1 measurements were 7.25 MiB exported input, 9.19 MiB retained and
57.55 MiB peak Python-managed loading allocations. These were **not remeasured** in
Stage 4 and exclude interpreter/native GEOS/PROJ heaps and per-analysis workspace.
One loaded dataset per worker and no analysis backlog are suitable for this bounded
prototype. Hard process time limits, total RSS at deployment concurrency, untrusted
traffic and cross-user queuing require further work before scaling.

## Deployment requirements and remaining issues

- Provision CPython 3.11-compatible packages: current backend FastAPI/Pydantic runtime
  plus declared Shapely 2.1.2, pyproj 3.7.2 and osmium 4.3.1. The local audit reused
  the existing Stage 1 site's packages via PYTHONPATH; a deployment should install
  a compatible self-contained environment, not depend on another machine's venv.
- Include all small verified artifacts, Stage 1 modules and repository-relative
  layout. No regional 247 MB PBF or 11 GB SQLite index is needed for requests.
  Preserve hashes/line endings; do not regenerate pins merely to bypass integrity
  failures. Restart workers for source updates or latched initialization errors.
- Start ASGI with lifespan enabled and bounded server connection/concurrency settings.
  `/health` does not assert lazy dataset readiness. A 504 does not terminate native
  work; process supervision is needed for a stuck worker.
- Configure the existing `VITE_API_BASE_URL` and `VITE_ROUTING_PROVIDER=api` before
  build/start. Restart Vite after env changes. Backend CORS must explicitly allow the
  deployed frontend origin; local 8080/8081 origins are currently supported. Use
  HTTPS-compatible URLs in a secure deployment. No environment files were edited.
- Existing `/route` provider configuration remains necessary for live navigation;
  offline evidence itself needs no provider key/network service. Neither endpoint's
  provider behavior was changed. Existing map tiles retain their existing external
  OSM tile dependency.
- Maintain OSM attribution/license and snapshot qualifiers. Pilot extent, historical
  sparse tags, uncertain establishment identity, unknown real-world completeness
  and unverified exact-street attribution remain fundamental evidence limitations.
- Browser acceptance remains outstanding in this execution environment. Validate
  desktop/mobile layout, keyboard/status announcements, actual map rendering,
  network ordering, editing during pending work and real browser CORS behavior.
- Legacy safety-oriented copy/mock scores, client bundle size and runtime/dependency
  warnings are documented follow-up work. Existing mock-only comments/AGENTS guidance
  also lag the explicitly authorized integrated architecture; they were not rewritten.

Startup and manual steps remain in
[backend API documentation](../../backend/docs/RANCHI_ROUTE_EVIDENCE_API.md) and
[frontend integration documentation](../../frontend/DYNAMIC_ROUTE_EVIDENCE_INTEGRATION.md).

## Readiness and next stage

Phase 5D is suitable for a reviewable prototype commit with the above caveats.
There are no failing automated tests or demonstrated route/evidence identity defects
requiring a production-code rewrite. This does **not** certify public-release safety
claims, live browser behavior, geographic completeness or production capacity.

Recommended next stage: **browser acceptance and operational hardening**. Capture
actual browser results on the user's running services, replace misleading legacy
marketing terminology, establish deployment dependency/runtime pins and measure
worker RSS/latency under bounded load. Resolve the bundle warning as a separate
performance change if needed. Only after that consider independently validated
walked-street attribution; do not turn missing OSM tags into safety scores or add
ML predictions from these sparse snapshots.

## Changed files

Stage 4 changed only the following files (no runtime code or data changes):

1. `PHASE_5D_FINAL_VALIDATION_REPORT.md` — new audit report.
2. `backend/tests/test_route_evidence.py` — CORS preflight policy regression.
3. `frontend/src/lib/routing/apiRoutingService.test.ts` — cycle/drive preservation.
4. `frontend/src/lib/routing/routeEvidence.test.ts` — actual artifact parsing/compact
   retention and busy-backoff cancellation.
5. `frontend/src/test/route-journey.test.tsx` — selected-route evidence isolation.

For commit review, the full outstanding Phase 5D working-tree file inventory also
includes these pre-existing Stage 1–3 changes; Stage 4 did not originate them:

```text
backend/app/main.py
backend/app/route_evidence.py
backend/requirements.txt
backend/docs/RANCHI_ROUTE_EVIDENCE_API.md
backend/docs/ROUTE_EVIDENCE_BACKEND_TESTS.log
data/ranchi_safety/DYNAMIC_ROUTE_EVIDENCE_REPORT.md
data/ranchi_safety/DYNAMIC_ROUTE_EVIDENCE_SCHEMA.md
data/ranchi_safety/dynamic_route_evidence.py
data/ranchi_safety/test_dynamic_route_evidence.py
data/ranchi_safety/validate_dynamic_route_evidence.py
data/ranchi_safety/dynamic_validation/heigit-foot-walking-route-1.json
data/ranchi_safety/dynamic_validation/heigit-foot-walking-route-2.json
data/ranchi_safety/dynamic_validation/heigit-foot-walking-route-3.json
data/ranchi_safety/dynamic_validation/summary.json
data/ranchi_safety/dynamic_validation/tests.log
frontend/DYNAMIC_ROUTE_EVIDENCE_INTEGRATION.md
frontend/src/components/RouteEvidencePanel.tsx
frontend/src/hooks/useRouteEvidence.ts
frontend/src/lib/routing/apiBaseUrl.ts
frontend/src/lib/routing/apiRoutingService.ts
frontend/src/lib/routing/routeEvidence.ts
frontend/src/routes/index.tsx
frontend/src/test/dynamic-evidence.test.tsx
frontend/src/test/evidenceFixture.ts
```

The Stage 4 test files in the first list already contained earlier work; include
their complete reviewed contents when committing. Generated ignored frontend build
outputs and Python caches are not source changes. `.env.local`, secrets, venvs,
regional sources/indexes and pinned datasets were not altered or staged.
