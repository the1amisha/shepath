# SHEPATH — Phase 7B Final Validation Report

Validation date: **October 11, 2026** (Asia/Calcutta).

Repository: `D:\shepath` · Inspected HEAD: `cc7471562c94e42a94d40024f6c15f9a66a0fb13` (`cc74715`).

Manual verification endpoints: backend `http://127.0.0.1:8011`; frontend `http://127.0.0.1:8080`.

## 1. Final readiness assessment

**SHEPATH is ready for a rehearsed, bounded desktop college prototype demonstration on the manually verified local setup.** The supplied Phase 7B observations establish a successful five-step desktop journey, live walking-route generation, selected-route continuity through overview and evidence, and return to the landing page. They add the desktop happy-path evidence that Phase 7A lacked.

This conclusion combines prior automated validation, the user's manual backend/browser results and a read-only cross-check of the current implementation and stored validation artifacts. It does **not** mean that the Phase 7A implementation roadmap has been completed: this Phase 7B task creates documentation only. Startup reproducibility, keyboard and screen-reader acceptance, device coverage and failure-recovery rehearsal remain incomplete. Lint remains a documented failing check.

The demonstrated capability is **walking-route comparison with historical mapped geographic context**. SHEPATH is not certified for personal safety, is not production-ready, and does not establish current street conditions, accessibility or emergency suitability. Rehearse the actual presentation setup, retain the evidence limitations in the narration, and prepare the fallback described below.

## 2. Evidence provenance and scope

| Evidence class | Source | What it establishes |
|---|---|---|
| Prior automated results | [Phase 5D report](PHASE_5D_FINAL_VALIDATION_REPORT.md), [Phase 6 Stage 4B report](frontend/PHASE_6_STAGE_4B_REPORT.md), [Phase 7A audit](PHASE_7A_READINESS_AUDIT.md) | Recorded test/static/build results and their stated limits. These suites were **not rerun** while preparing this report. |
| Manual backend verification | User-supplied October 11, 2026 results reproduced in section 4 | Successful checks against the stated local backend, including live routing and Route 1 dynamic evidence. No new HTTP/provider requests were issued for this report. |
| Manual desktop observations | User-supplied complete walkthrough reproduced in section 5 | Successful demonstrated desktop flow, Route 2 selection and preservation, evidence values and restart. These observations were not independently replayed by the report author. |
| Current repository inspection | Source files, prior reports and existing `dynamic_validation` JSON artifacts | Implementation agrees with the described behavior and stored measurements. Reading artifacts is not a new runtime test or integrity-verifier execution. |
| Current repository checks | `git rev-parse HEAD`, `git status --short`, `git diff --check`, report whitespace check | Repository baseline and documentation-only file scope; see section 10. |

No browser version, viewport dimensions, screenshots, raw manual HTTP response files, exact manual geometry-hash values, startup transcript or timed presentation duration were supplied for Phase 7B. This limits independent reproduction; it does not change the recorded user-reported pass. No mobile, assistive-technology, failure-injection or production acceptance is inferred from that pass.

The existing untracked `PHASE_7A_READINESS_AUDIT.md` was present before this task and is preserved. No application code, tests, dependencies, configurations, datasets or existing reports were modified. No external routing request, dataset download, server restart, package installation, commit or push was performed.

## 3. Architecture and implementation cross-check

| Area | Repository evidence | Confirmed design |
|---|---|---|
| Frontend journey | `frontend/src/routes/index.tsx:42`, `:63`, `:79` | React/TanStack state-based journey: Search, Preference preview, Results, Route overview, Geographic evidence. Welcome is outside the five counted steps; saved comparison is a separate view. |
| Live route request | `frontend/src/routes/index.tsx:114`; `frontend/src/lib/routing/apiRoutingService.ts:15` | Sends trimmed origin/destination and `travelMode: walk`. The preference state is not included. Returned geometry and estimates populate route state. |
| Backend routing | `backend/app/main.py:31`, `:53`, `:521` and `map_geojson_route` | FastAPI exposes health and live routing. HeiGIT Pelias geocodes places; HeiGIT openrouteservice supplies directions. GeoJSON coordinates are mapped into SHEPATH's `[latitude, longitude]` order. Health alone does not validate providers or geographic artifacts. |
| Route presentation | `frontend/src/routes/index.tsx:48`, `:124`, `:255`, `:280`, `:297` | Provider order is retained. The first returned route is initially selected; “Fastest estimate” uses minimum provider duration, not a safety or preference score. Overview/report use the selected route's ID and evidence entry. |
| Map | `frontend/src/components/ShePathMap.tsx:22`, `:30`, `:38` | Leaflet is dynamically imported in the browser. Geometry is drawn from route coordinates; the second route uses `#d78368`, consistent with the orange observation. Selection controls line emphasis. |
| Dynamic evidence client | `frontend/src/lib/routing/routeEvidence.ts:49`, `:81`, `:98`; `frontend/src/hooks/useRouteEvidence.ts:10` | Exact ordered coordinates and route ID are sent and checked against the response. Evidence is processed sequentially with bounded busy retries and stale/cancelled batch protection. Route labels alone cannot validate evidence identity. |
| Dynamic evidence backend | `backend/app/route_evidence.py:150`, `:170`, `:224`; `data/ranchi_safety/dynamic_route_evidence.py:106`, `:145` | Lazily verifies a pinned local dataset and analyzes supplied geometry with a fixed 100 m nominal buffer. No new regional extraction or provider request is required by the evidence endpoint. |
| Evidence UI | `frontend/src/components/RouteEvidencePanel.tsx:9`, `:18`, `:21`, `:36` | Shows route-named status, native expandable metrics, mapped counts, missing-tag limitations, historical source attribution and snapshot. Coverage-unavailable is not presented as zero facilities. |
| Saved comparison | `backend/app/pilot_ranchi.py`, `load_snapshot` / `get_comparison`; `frontend/src/components/SavedRanchiPilot.tsx:65`; `frontend/src/lib/routing/savedPilot.ts:174` | Reads the fixed saved Albert Ekka Chowk → Doranda walking comparison with artifact integrity/applicability checks. It does not calculate current routes or attach historical observations to live routes by matching IDs or places. |

Live routing, dynamic evidence and saved comparison remain separate capabilities. A fresh live route can use historical OSM evidence without becoming a saved route. Even when both journeys use Albert Ekka Chowk → Doranda, matching names, estimates or IDs do not establish identical ordered geometry or saved-snapshot identity.

## 4. Manual backend results — October 11, 2026

**Provenance: supplied manual results, cross-checked against source and existing artifacts; not rerun for this report.**

### 4.1 Health, saved comparison and live routing

| Check | Reported result | Interpretation |
|---|---|---|
| `GET /health` | `status: ok`, `service: shepath-backend` | Backend responded with the expected health contract. |
| `GET /pilot/ranchi/comparison` | `status: available`, 3 saved routes | The separate historical comparison was available. This does not by itself establish a saved-view browser walkthrough. |
| `POST /route` | 3 live walking routes for **Albert Ekka Chowk, Ranchi → Doranda, Ranchi** | Provider-backed route generation succeeded for the manually tested journey. |

| Live option | Distance reported | Duration reported | Display implied by current formatting |
|---|---:|---:|---|
| Route 1 | 5,348.2 m | 3,850.6 seconds | 64 min; 5.3 km |
| **Route 2** | **5,257.2 m** | **3,785.1 seconds** | **63 min; 5.3 km; fastest estimate** |
| Route 3 | 6,607.6 m | 4,757.4 seconds | 79 min; 6.6 km |

The last column is a source-based arithmetic cross-check, not an additional claim that every rounded label was manually recorded. The UI uses `Math.round(durationSeconds / 60)` and one decimal place for kilometres (`index.tsx:55–57`). Route 2 has the lowest duration; the reported fastest badge and approximately 63-minute / 5.3-km overview are consistent. “Fastest” does not imply safest, preferred or independently measured walking time.

The three distance/duration pairs also match the supplied metadata in the existing `data/ranchi_safety/dynamic_validation/heigit-foot-walking-route-1.json`, `-2.json` and `-3.json` artifacts. This is corroboration of numerical consistency, not proof that the manual live responses are byte-identical to those stored artifacts. Future provider responses may differ.

### 4.2 Route 1 dynamic geographic evidence

The manual `POST /pilot/ranchi/route-evidence` check for **Route 1** reported:

| Property | Manual result and repository cross-check |
|---|---|
| Schema / availability | `SHEPATH.dynamic_route_evidence.v1`, `status: available`; consistent with the engine and stored Route 1 artifact. |
| Identity | Route identity and geometry hash were present. Exact manual hash bytes were not supplied; no comparison against a stored hash is claimed here. |
| Coverage | `centerline_fully_covered: true` and `full_buffer_covered: true`. These indicate pilot geometric containment, not complete mapping of real-world conditions. |
| Analysis | **100 m nominal buffer**, metric CRS **EPSG:32645**. The engine also uses a conservative numerical coverage guard; it does not redefine the nominal evidence buffer as a safety boundary. |
| Historical source | Pinned OpenStreetMap snapshot dated **October 8, 2026**. The repository's exact source timestamp is **`2026-10-08T20:21:06Z` (UTC)**; the October 11 validation date is not a refreshed dataset date. |
| Integrity / inventory | Source integrity verification succeeded and **2,720 geographic features** were loaded, as reported manually. Stored provenance contains `feature_count: 2720` and `integrity: pinned_manifest_export_hashes_and_reconstructed_geometries_verified`; the loader verifies the manifest, artifact hashes and reconstructed geometry. |
| Limitations | Incomplete lighting, sidewalks and opening-hours evidence; unknown pedestrian activity and unverified personal safety were correctly disclosed. Current operation and exact walked-street conditions remain unverified. |

The pinned manifest in source/artifacts is `ae9d1e9134b276c4ca20297b02dacf38320e2ed98e001a4419788f310e9a1d0b`. The pilot bounds are `[23.335059, 85.308481, 23.38, 85.34]` in south/west/north/east order. The **2,720** figure is the dataset inventory, not the number of facilities near Route 1 and not a completeness percentage.

The explicit backend evidence check supplied for Phase 7B covers **Route 1**. The Route 2 observations in the next section are desktop-browser evidence; do not relabel them as a separately captured Route 2 HTTP validation. No standalone Phase 7B Route 3 evidence response was supplied.

## 5. Manual five-step desktop demonstration

**Result: complete manual walkthrough passed, as reported by the user.** Frontend: `http://127.0.0.1:8080`.

| Stage | Manual observation | Implementation consistency |
|---|---|---|
| **1 — Journey Planning** | Starting point Albert Ekka Chowk, Ranchi; destination changed to Doranda, Ranchi. | Inputs are editable; Doranda is also a destination preset. The source's initial destination is Ranchi Railway Station, so this was an intentional input change, not a discrepancy. |
| **2 — Preference Preview** | All four options displayed correctly. Choices were understood to be prototype-only and not influence ordering or analysis. | Options are Lighting, Street activity, Nearby businesses and Walking infrastructure. Source explicitly discloses that they do not affect routing, route order or evidence. |
| **3 — Route Comparison** | Three live routes displayed with corresponding geometry, estimates and mapped evidence. Route 2 showed the fastest estimate and was manually selected. | Selection is stored by route ID. Route 2 has minimum duration; manual selection is distinct from the initial first-route selection. |
| **4 — Route Overview** | Route 2 remained selected, with orange geometry, approximately 63 minutes, approximately 5.3 km and matching evidence. | Overview map and evidence use the same selected ID. Formatting and the second-route map colour agree with the observations. |
| **5 — Geographic Evidence** | Route 2 remained selected; 100 m buffer and the records below were shown. | The report view resolves the selected route's evidence, rather than choosing a route by its fastest badge or preferences. |
| **Journey restart** | Plan another journey returned to the landing page, from which another journey could be started. | Handler sets the screen to `welcome` (`index.tsx:302`). This is navigation restart, not a full reset of all in-memory input/preference state. |

Route 2 counts observed on the Geographic Evidence step:

| Category | Mapped records |
|---|---:|
| Businesses | **54** |
| Healthcare facilities | **9** |
| Police facilities | **1** |
| Pedestrian infrastructure | **11** |

These values agree with `route_context.categories` in the existing Route 2 dynamic validation artifact. `RouteEvidencePanel.tsx:21–26` renders those category `count` fields as mapped records. The agreement does not convert them into independently verified establishment counts. Ambiguous duplicate establishments remain retained, categories can overlap, and totals must not be interpreted as distinct facilities or combined into a safety score.

The frontend consistently disclosed during the walkthrough that historical mapped evidence is **not a personal-safety assessment**. Source corroborates this wording on the landing, results, overview and evidence views. The successful walkthrough supports the happy path on the observed desktop setup; it does not establish all resize, map-control, keyboard, failure or saved-detour cases.

## 6. Prior automated validation and audit disposition

### 6.1 Recorded checks, not new Phase 7B executions

| Source / check | Recorded result | Scope limit |
|---|---|---|
| Phase 5D, October 10 | **178 tests passed:** 40 backend + 80 geographic + 58 frontend; TypeScript/build passed | Historical integration validation. No independent live-browser end-to-end pass. |
| Phase 6 Stage 4B, October 11 | **85 frontend tests passed in 12 files**; TypeScript/build and diff check passed | Includes interruption and map-failure recovery tests using DOM simulation, deferred responses and Leaflet mocks. |
| Phase 7A, October 11 | **205 selected tests passed:** 85 frontend + 40 backend + 80 geographic | Latest recorded combined automated run at the inspected baseline; suites include identity, saved/live isolation, geometry regressions, cancellation, retries and failure handling. |
| Phase 7A static/build | TypeScript and production client/SSR/Nitro build passed | Build success is not deployment or browser acceptance. |
| Phase 7A lint | **Failed:** 6,334 Prettier errors and six fast-refresh warnings | No formatting/configuration remediation was performed in this task. Do not describe all static checks as passing. |
| Phase 7A HTTP smoke | Health, frontend HTML, saved comparison and three live routes with available evidence succeeded for **Albert Ekka Chowk → Ranchi Railway Station** | A different destination from the Phase 7B Doranda journey. Timings and route values are not interchangeable. |

The reports describe overlapping suites at different stages; **178, 85 and 205 must not be added into a new total of distinct tests**. The latest combined recorded count is 205. This documentation task did not execute tests, lint or builds.

Prior build warnings remain: 515.59 kB minified / 157.30 kB gzip main client chunk, tsconfig-path plugin guidance, plugin timing advice and ignored `inlineDynamicImports`. Backend testing previously reported a Starlette/httpx TestClient deprecation warning. None is recorded as fixed here.

### 6.2 What Phase 7B closes, and what remains open

| Prior concern | Disposition after supplied manual results |
|---|---|
| Phase 7A desktop happy path not observed | **Addressed for the supplied desktop journey:** all five steps, manual Route 2 selection/preservation, evidence and landing return passed. |
| Phase 7A H01 capability/startup gate | Manual health, saved comparison, live route and Route 1 evidence checks support capability availability. **Cold/controlled startup, process provenance and clean-machine setup remain unverified.** |
| Phase 7A H02 broader browser/accessibility gate | **Partially addressed:** happy path passed; keyboard, AT, responsive matrix, failure injection and detailed sticky-layout acceptance remain outstanding. |
| Phase 6 Stage 4A A01 interruption / A02 map failures | Stage 4B implemented recovery and recorded regression tests. No supplied Phase 7B failure-injection walkthrough closes their manual acceptance lists. Do not repeat them as wholly unimplemented features. |
| Earlier safety-copy concerns | Current code and manual disclosures corroborate corrected wording. The older reports remain historical records; no new safety claim is introduced. |
| Phase 7A documentation, focus, attribution, lint and environment roadmap | Not implemented by this task. Their outstanding status remains unchanged unless specifically covered by the manual observations above. |

### 6.3 Discrepancy review

**No direct contradiction was found between the supplied manual results and the inspected implementation/artifacts.** The following distinctions prevent overstatement:

- Phase 7A's Railway Station route values differ from Phase 7B's Doranda values because the destination differs; this is not a regression.
- Orange Route 2 and its 63-minute/5.3-km values agree with map colour indexing and rounding. The fastest badge does not reorder routes or automatically select Route 2.
- A 100 m **nominal** analysis buffer is consistent with the engine's slightly larger conservative containment check; the additional numerical guard is not additional geographic evidence coverage.
- Successful source integrity verifies the pinned files and geometry consistency, not the truth/completeness of every OSM record or real-world safety.
- “Plan another journey” returns to the landing screen; code does not clear every input/preference state at that click. The manual report does not claim such a reset.
- Matching stored distances/counts does not establish byte-for-byte identity of the manual live geometries. No unprovided manual hash value is inferred from an artifact.

If later raw responses or screenshots conflict with these observations, retain the original observation and document the new evidence separately; do not alter stored snapshots or route identities to force agreement.

## 7. Remaining acceptance and operational limitations

| Area | Current status / remaining work |
|---|---|
| Keyboard-only interaction | **Pending.** Complete Tab/Shift+Tab/Enter/Space through all steps and saved view; verify Escape behavior where relevant, visible focus, skip links, Back/heading transitions, route selection, disclosures and focus after errors/retries. |
| Screen readers and accessibility | **Pending.** Native labels, pressed states, headings and polite status regions exist, but actual NVDA/Narrator announcements, retry focus, contrast, reduced motion and zoom/reflow need acceptance. No WCAG or accessibility certification. |
| Mobile/tablet devices | **Pending.** No physical-device pass supplied. Earlier Chrome observations/emulation do not certify touch scrolling, browser chrome, virtual keyboards, narrow CTAs or actual tablet/phone rendering. |
| Responsive desktop edge cases | Happy path passed, but no supplied viewport/zoom matrix or explicit post-correction sticky-map/control checks. Test narrow/short windows, expanded evidence, 200% zoom and 400% reflow separately. |
| Recovery | Source/tests cover interrupted routing, map errors, busy/timeouts and stale data. Browser failure injection, exhausted map retries, saved detours and recovery focus remain unverified manually. |
| Startup and environment | Both localhost ports worked manually. Phase 7A encountered occupied ports and an initial sandbox `spawn EPERM`; it did not verify a new cold start. Document process ownership, explicit API URL/mode and compatible dependencies; existing geographic PYTHONPATH setup is machine-dependent. |
| Production operations | **Not ready/certified.** No production deployment, load/RSS benchmark, process supervision acceptance, security review or availability guarantee. Backend evidence allows one job per worker; native work can retain capacity after timeout or client cancellation. |
| External dependencies | Live geocoding/directions require the existing provider credential/network. OSM tiles and external fonts have separate network dependencies. Do not expose backend credentials or place them in frontend environment variables. |
| Offline behavior | Saved comparison is served by the local backend, not a persistent browser cache. No durable offline journey/tile package is established; fresh live routing cannot be assumed without WAN. |
| Repository quality | Phase 7A documents incomplete setup guidance, environment reproducibility issues, attribution readability and failing lint. This report does not repair those items. |

Geographic limitations remain fundamental: bounded pilot extent; October 8 historical snapshot; unknown real-world completeness; sparse lighting/sidewalk/opening-hours tags; possible duplicates and category overlap; no verified current opening, pedestrian activity or exact walked-street attribution. Zero mapped records is not proof of physical absence; missing tags are unknown, not evidence that a route is unsafe. Full buffer containment is not full real-world knowledge. No score, rank or recommendation about personal safety is validated.

## 8. Prioritized follow-up checklist

1. **Before presenting — operational rehearsal:** confirm known processes on 8011/8080, correct API mode/base URL and compatible local dependencies; perform a controlled restart and timed 5–10 minute rehearsal on the presentation machine. Record browser/version, viewport and observed service state. Reuse the verified Doranda sequence without promising identical future routes or latency.
2. **Before presenting — recovery and fallback:** rehearse pending-route → saved → return, one routing failure and tile failure; verify retry/edit and textual route actions remain usable. Fix any reproduced navigation blocker. Prepare an explicitly historical local recording/screenshots or saved-comparison fallback, with dates and limitations. Do not silently substitute mock routes or saved evidence for live results.
3. **Before claiming accessible/device support:** complete keyboard/AT and mobile/tablet/zoom acceptance. Prioritize hidden controls, focus traps, unreadable errors and unusable disclosures if found. Source semantics and the current desktop pass are not substitutes.
4. **Next maintenance pass:** consolidate startup documentation and a reviewed secret-free environment example; verify a self-contained backend and dependency/version policy. Address focus recovery, attribution/timestamp readability and lint in scoped changes without touching pinned geographic bytes.
5. **Later, separately scoped:** bundle/toolchain cleanup, map lifecycle optimization, browser history/persistence, durable offline support and production operational hardening. Real preference-aware routing or safety-related features require new validated capabilities, not reinterpretation of current proximity counts.

For the demonstration, present the five-step flow and Route 2 evidence, explicitly state that preferences are only a preview, distinguish live geometry from the historical OSM snapshot, and retain the no-personal-safety-assessment wording. If live routing fails, use the separate saved comparison only when the local API works and label it historical. If the application is unavailable, use prepared recorded material, not fabricated live results. No fallback recording or new offline feature was created or tested in this task.

## 9. Overall conclusion

The supplied October 11 backend checks and complete desktop walkthrough, supported by prior automated validation and current source/artifact consistency, justify **readiness for a rehearsed desktop college prototype demonstration**. The live Doranda journey, manual fastest-route selection, preserved Route 2 overview/evidence and restart are recorded as successful.

This closes the desktop happy-path evidence gap, not every Phase 7A gate. Keep cold startup, recovery rehearsal, accessibility/device acceptance and production operations explicitly outstanding. Present mapped context and its uncertainty; do not claim certified safety, live street-condition knowledge, complete geographic data or production readiness.

## 10. Final file and Git verification

This task creates exactly one file:

- **Created:** `PHASE_7B_FINAL_VALIDATION_REPORT.md`.
- **Modified existing files:** none.
- **Pre-existing untracked file retained unchanged:** `PHASE_7A_READINESS_AUDIT.md`.

Final `git status --short`:

```text
?? PHASE_7A_READINESS_AUDIT.md
?? PHASE_7B_FINAL_VALIDATION_REPORT.md
```

Final `git diff --check`: **passed, exit 0, no output**. Because ordinary `git diff --check` does not inspect untracked files, the new report was additionally checked with `git diff --no-index --check -- NUL PHASE_7B_FINAL_VALIDATION_REPORT.md`: no whitespace errors. Git may emit its existing LF-to-CRLF working-copy warning; that is not a report whitespace failure.

The pre-existing Phase 7A report's SHA-256 was checked before and after authoring and remained `9542a919c9cfa29fb1de3d96ba621902dfc716380e5d4205e60079e73d18bff5`. No tracked-file differences were introduced. No commit or push was made.
