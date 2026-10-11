# SHEPATH Phase 6 — Stage 4A: Mobile, Accessibility and Demo Readiness Audit

Date: 2026-10-11 (Asia/Calcutta). Repository: `D:\shepath`. Verified baseline: `af23600`.

## Readiness decision

**Conditionally ready for a rehearsed desktop college demonstration; not yet accepted for mobile or general accessibility.** The corrected copy, five-step journey, route/evidence isolation, historical-data disclosures and saved comparison provide a credible bounded prototype. Before presenting, rehearse the exact machine, services, browser, route and network; verify the corrected desktop map/action composition. Avoid a saved-view detour while route generation is pending until the recovery gap below is fixed or deliberately worked around.

This is not a new live end-to-end certification. Mobile acceptance requires the viewport, keyboard, failure-state and assistive-technology checks below. No safety score, personal-safety ranking, current-open status or real-world lighting/activity validation should be claimed.

## Evidence and audit boundaries

- Read `PHASE_6_UI_AUDIT.md`, `frontend/PHASE_6_STAGE_2_REPORT.md`, `frontend/PHASE_6_STAGE_3_REPORT.md` and `PHASE_5D_FINAL_VALIDATION_REPORT.md`, plus current frontend source, routing/evidence clients, backend startup/CORS/provider configuration, requirements and integration documentation.
- The working tree was clean at audit entry and HEAD matched the requested baseline. Existing backend virtual environment, geographic site-packages directory and frontend `node_modules` paths exist; this does **not** verify package compatibility or runtime readiness.
- **No real browser/mobile session, screenshot, keyboard or screen-reader session, network failure injection, server startup, live provider call, test run or build was performed in Stage 4A. No defect was independently reproduced at runtime in this audit.** Findings distinguish definite source behavior from potential rendered effects.
- Historical validation: Phase 5D reported 178 combined tests; Stage 2 reported 66 frontend tests; the Stage 3 desktop correction reported 75 frontend tests, TypeScript and production build passing. These are prior results, not fresh Stage 4A checks and not proof of visual accessibility.
- Prior user Chrome observations at approximately 1650×930 established action/map overlap and a blank area below the map before the desktop correction. Current code replaces that structure. A successful post-correction Chrome acceptance result is not documented in the reviewed reports; do not report either issue as a reproduced current defect.
- Only this audit document is added. No application code, tests, dependencies, datasets, environment files or saved calculations were changed. No commit or push. Secrets were not inspected or printed.

## Current behavior to preserve

The five counted steps remain Search, Preference preview, Results, Route overview and Geographic evidence. Welcome is outside that count; saved comparison is a separate historical view. Preferences explicitly do not affect routing. Native buttons expose pressed/selected states, inputs have labels and associated errors, and a native form supports submission. Heading focus, skip links and saved-launcher restoration are implemented without browser-history changes.

Results use native metric disclosures, visible historical/no-personal-safety qualifiers, route-named polite status messages and a finished-attempt count. Coverage-unavailable and errors are outside disclosures. Metrics remain expanded initially on overview/report. The corrected map, legend and selected actions are separate rows in one right column; there is no independently floating bottom action bar or nested sidebar scroll. Desktop stickiness is conditional on measured fit below the header.

The map receives provider geometry unchanged. Dynamic evidence checks ordered coordinates and ID, requests sequentially, bounds busy retries and cancels/ignores obsolete work. Saved evidence is never attached to live routes by matching names/IDs. Preserve these safeguards through all follow-up work.

## Prioritized findings

Evidence labels: **S** = behavior established by source inspection, not runtime reproduction; **V** = layout/interaction risk inferred from source, browser verification required; **O** = operational dependency established from configuration/docs, current runtime unverified. Priorities reflect demo/access impact, not an assertion of standards noncompliance.

### A01 — Pending route → saved comparison → return lacks direct recovery

**High · S.** `frontend/src/routes/index.tsx`, `ShePathApp` (`liveJourneyVisible` effect around lines 93–102, `findRoutes`, saved early return and results error block); `frontend/src/lib/routing/apiRoutingService.ts`, `getRoutes`.

Starting a route clears routes/selection. Entering saved view makes the live journey invisible, increments the generation counter and clears loading. The old response is correctly ignored. On return, the underlying screen remains results, but no route, loading state or error necessarily exists. The retry control is only rendered for an error, so the user can see zero routes and a disabled overview action. Edit/back still permit recovery; this is not an unrecoverable app crash.

**Proposal:** Render an explicit interrupted/empty-results state with a deliberate retry/edit action. Preserve the generation guard; never accept an old response to make the screen look populated. **Frontend-only: yes.** First follow-up priority. Reproduction procedure is in M07 below; not executed here.

### A02 — Map loading and tile failures have no fallback messaging

**High · S.** `frontend/src/components/ShePathMap.tsx`, `mountMap`, tile layer and empty container; `frontend/src/routes/index.tsx`, results map region.

No active route yields an empty map container. The asynchronous Leaflet import/mount has no local failure presentation; no tile-error state tells users why external OSM tiles are missing. A route may still exist over a blank base map. An async rejection is not necessarily caught by the root React error page.

**Proposal:** Add separate map loading/unavailable messages and retain textual route estimates/actions when tiles fail. Handle import and tile failure separately, with a bounded user-controlled recovery option if appropriate. Never substitute mock or saved geometry. **Frontend-only: yes for detection/message/recovery; cannot guarantee the external tile service.**

### A03 — Demo configuration can pass health while route/evidence/saved views fail

**High · O/S.** `backend/app/main.py` (`health_check`, `get_heigit_api_key`, CORS origins), `backend/app/route_evidence.py`, `backend/requirements.txt`; `frontend/src/lib/routing/apiBaseUrl.ts`, `savedPilot.ts:174` and `index.ts`; `backend/docs/RANCHI_ROUTE_EVIDENCE_API.md`.

`/health` only reports process health; dataset loading is lazy. Live routing needs a valid server-side HeiGIT key and network; dynamic evidence needs compatible geographic dependencies and verified artifacts. Live clients default to port 8000 if no URL is configured, while the documented demo backend uses 8011. Saved comparison requires an explicit API URL and has no equivalent fallback. Frontend mode/URL are startup/build configuration. CORS permits loopback frontend origins on 8080/8081, not arbitrary ports or LAN origins.

**Proposal:** Use the startup and three-capability smoke checklist below; make missing configuration messages clearer in a later frontend pass. Do not rely on health alone. **Frontend-only: partial** (configuration consistency/message fixes); credentials, compatible packages, source readiness and allowed origins are operational/backend concerns. No fixes or installations performed here.

### A04 — Mobile next-step action follows every route panel and the map

**Medium · S/V.** `frontend/src/routes/index.tsx:237–266`, comparison grid/`ResultsMapPanel`/selected actions; `frontend/src/styles.css:125–128`.

At 320/390/768 px, the layout is one column: all route cards/disclosures, then map, legend and actions. This avoids the previous overlay but makes progression distant, especially with multiple expanded panels. The map is at least 360 px tall. Desktop panels that cannot fit also become static by design; some blank-column area is then expected rather than a failure of fit logic.

**Proposal:** After measuring actual scrolling, consider a non-overlapping top summary/next-action or a keyboard-accessible jump to selected actions. Keep a single document scroller; do not restore the bottom overlay. **Frontend-only: yes.** No measured scroll distance/obstruction claimed.

### A05 — Narrow-width control wrapping and dense columns need acceptance

**Medium · V.** `frontend/src/routes/index.tsx`, welcome preview badge, search CTA, preference grid and `Brand`; `frontend/src/components/ui/button.tsx`; `RouteEvidencePanel.tsx`, two-column metric list; `SavedRanchiPilot.tsx`, route-card distance grids.

Buttons use fixed height, padding and `shrink-0`; long labels share space with icons. Preference cards have icon/content/check columns even at 320 px. Evidence/saved metrics retain two columns at narrow widths. The welcome badge is offset outside its card. Source alone cannot establish clipping, but these are the highest-risk 320 px/zoom locations.

**Proposal:** Only after reproduction, allow affected controls to grow/wrap and narrow metric grids to stack; retain the design tokens and card arrangement. **Frontend-only: yes.** Do not assume 390 px passing proves 320 px passing.

### A06 — Conditional sticky map needs live resize and keyboard verification

**Medium · V.** `frontend/src/components/ResultsMapPanel.tsx`; `frontend/src/styles.css:125–134`; `frontend/src/components/ShePathMap.tsx`.

The panel observes its own/header size and uses `window.innerHeight` to decide fit. CSS uses `dvh` with a `vh` fallback for map height. Mobile browser chrome, visual viewport/keyboard changes and zoom may not track layout viewport measurements identically. Map size changes caused by layout/browser chrome are not explicitly followed by a map-container `invalidateSize` call; Leaflet's existing window-resize behavior remains unchanged. Neither an actual sizing defect nor post-fix overlap was reproduced here.

**Proposal:** First verify sticky threshold, fallback, grid boundary and tile sizing at the matrix below. Only if a resize defect is reproduced, add scoped sizing coordination without recreating geometry/evidence state. **Frontend-only: yes; moderate implementation care.** Keep static fallback for insufficient height.

### A07 — Route selection recreates the map; map-only interaction is limited

**Medium · S/V.** `frontend/src/components/ShePathMap.tsx`, effect dependencies `[routes, selected]`, `fitBounds`, marker creation.

Selection removes/recreates the Leaflet map and fits the selected route, discarding manual pan/zoom. Polylines do not select alternatives; A/B markers have no application-provided place-name explanation. The map root has an `aria-label` on a generic div; results provide an enclosing named region, while equivalent map semantics elsewhere are weaker. Actual keyboard capture/touch-scroll behavior requires testing.

**Proposal:** For this demo, retain route cards as the clear selection mechanism and provide an explicit textual A/start, B/destination explanation. Defer map lifecycle refactoring unless acceptance reveals a blocking problem. **Frontend-only: yes; lifecycle changes carry more risk than copy/semantics.**

### A08 — Focus transitions are implemented, but error/retry focus is incomplete

**Medium · S/V.** `frontend/src/hooks/useJourneyFocus.ts`; `frontend/src/routes/index.tsx`, `LocationField`/search submit; `frontend/src/components/SavedRanchiPilot.tsx:26–37,86–98`.

Screen transitions focus H1 and subtract measured sticky-header height. Saved return focuses the new launcher node rather than restoring an arbitrary scroll position. Invalid search submission displays alerts but does not focus the first invalid input. Saved retry removes the error/button, shows loading, then content; no explicit retry-completion focus target exists. Its initial successful data arrival also has no dedicated success announcement. Native focus indicators on saved select/summary need verification rather than an assumption that they are absent.

**Proposal:** Focus the first invalid field after failed submission; preserve meaningful focus or announce completion for retry without moving focus on every data update. Verify screen-reader behavior and all skip/Back paths first. **Frontend-only: yes.** Existing heading focus is an improvement, not an open F07 wholesale failure.

### A09 — Evidence status is truthful but recovery and announcements remain limited

**Medium · S/V.** `frontend/src/components/RouteEvidencePanel.tsx:11–18`; `frontend/src/hooks/useRouteEvidence.ts`; `frontend/src/lib/routing/routeEvidence.ts:49–109`; `frontend/src/routes/index.tsx`, finished-attempt paragraph.

Each route has a polite live status outside disclosure; critical errors/coverage remain visible. The finished-attempt counter is ordinary text, not a live region. Requested state includes queue/backoff time and has no actual retry telemetry. There is no evidence-only retry. Connection errors expose CORS/configuration terminology. Multiple panel announcements may be repetitive; actual verbosity/lost updates are unverified.

**Proposal:** Keep named statuses; test announcements before adding more live regions. Add plain-language recovery guidance first. If later adding evidence-only retry, retain exact-geometry binding, serialization and bounded retries rather than re-requesting routing implicitly. **Frontend-only: yes; lifecycle-aware work.** No automatic unlimited retries.

### A10 — Attribution and timestamp readability still need improvement

**Medium · S/V.** `frontend/src/components/ShePathMap.tsx:15`; `frontend/src/styles.css:92`; `RouteEvidencePanel.tsx`, final provenance paragraph; `SavedRanchiPilot.tsx:102–127`.

Map attribution is plain “© OpenStreetMap” at 9 px and 0.7 opacity. Dynamic/saved attribution and license are text, not navigable references. Dynamic timestamp is raw ISO text; saved view distinguishes route retrieval, OSM snapshot and feature creation with UTC labels. These labels exist and should not be reported missing. The pinned snapshot reported earlier is `2026-10-08T20:21:06Z`, not today's conditions.

**Proposal:** Make attribution legible, add verified contributor/license links and format timestamps with explicit timezone while retaining exact source values in details. Never label analysis request time as a refreshed OSM snapshot. **Frontend-only: yes.** This is a usability/source-transparency finding, not a legal-compliance verdict.

### A11 — Zero-denominator clarity and saved comparison density

**Low · S/V.** `RouteEvidencePanel.tsx`, lighting/sidewalk/opening-hours paragraphs; `SavedRanchiPilot.tsx`, route cards and preference profiles.

Sidewalk explicitly explains a zero denominator; lighting and opening-hours may show `0/0` with only general unknown-data qualifications. Saved view has substantial technical vocabulary, raw IDs and long cards before profile controls on mobile. Missing values remain Unknown and scenario ranges are correctly qualified; no fabricated completeness was found.

**Proposal:** Explain zero denominators locally and add short definitions/jump navigation for saved profiles while preserving measurements, overlap/duplicate caveats and methodology. **Frontend-only: yes.** Lower priority than interruption/failure handling.

### A12 — Contrast, focus visibility and residual motion need measurement

**Medium · V/S.** `frontend/src/styles.css` color tokens/reduced-motion rules; `components/ui/button.tsx`; `routes/index.tsx`, decorative step spans and route colors.

No computed contrast measurement was performed. Light button text on lavender, subdued text and routes on varying map tiles need actual checks. Native selection now includes text, so color is not the sole selected-state cue. Reduced-motion rules cover buttons, links, summaries and pulse, but decorative step spans retain `transition-all`; Leaflet's internal animation/gesture behavior is unchanged. Fixed control sizes are not by themselves proof of a target-size failure.

**Proposal:** Measure normal/hover/focus/disabled states, keyboard focus and non-text indicators; adjust only failing tokens or controls. Extend reduced-motion handling to residual application transitions if observed. **Frontend-only: yes for app styling; inspect Leaflet separately before changing it.** No WCAG conformance claim is made.

### A13 — Browser navigation and snapshot detours have demo consequences

**Low · S.** `frontend/src/routes/index.tsx`, `steps`, `goBack`, report restart; `useRouteEvidence.ts`; `SavedRanchiPilot.tsx` mount effect.

All five steps live at `/` in React state. Browser Back/Forward is not step navigation; refresh restarts the app. Plan another journey preserves prior input/preferences in memory. Saved view fetches again on entry and completed live geometry can be reanalyzed on return. “Saved” is historical, not offline availability.

**Proposal:** Use in-app Back for the rehearsed demo and explain persistence limits. Defer history/privacy/cache design to separate scope. **Frontend-only: yes for copy; robust persistence is a separate design decision.**

## Responsive acceptance matrix — not executed

| Viewport | Source-predicted composition | Main checks required |
|---|---|---|
| 320×740 | Single column; preferences one column; cards before map/legend/actions; metric subgrids remain two columns | Long CTAs/icons, header width, preview badge, metric wrapping, input errors, total scroll to next action |
| 390×844 | Same single-column structure; map floor 360 px | Touch/pan versus page scroll, disclosure length, selected action access, virtual keyboard |
| 768×1024 | Still below 1024 px desktop split; two-column preferences; static map column | Do not expect a tablet split map; check long saved cards, action wrapping and portrait/landscape |
| 1024×768 and 1280×720 | Two-column results; sticky only if measured full panel fits | Threshold transition, header/action wrapping, static fallback, keyboard scrolling |
| 1650×930 | Two-column results; expected fit depends on actual font/header/actions | Recheck previously reported overlay and blank-column issues after correction; full route evidence expansion |
| Any width, height ≤500 | Header and map column static | All content remains reachable; no nested scroll or clipped controls; blank space is acceptable fallback |

Repeat with long locations, 200% zoom and narrow reflow at 400%. Device emulation is a useful acceptance step, not proof of real-device browser chrome/touch/assistive-technology behavior.

## Minimal safe implementation sequence

1. **Operational rehearsal first:** execute startup checks and desktop happy path without changing data. Record route, browser, resolution and evidence status. Preserve the corrected desktop structure unless a regression is reproduced.
2. **Small recovery fixes:** A01 interrupted-results retry/edit state and A02 explicit map-failure messaging. Add focused frontend tests for pending route → saved → return, late-response suppression and failed tiles/import with routes still usable. Do not modify evidence contracts to fill an empty view.
3. **Mobile acceptance then targeted layout:** M01–M04 below; fix only reproduced A04/A05/A06 issues. Prefer inline/jump actions and flexible controls over floating overlays or nested scroll.
4. **Accessibility recovery/clarity:** A08–A10 and measured A12 adjustments; test keyboard, native disclosures, announcements and focus. Retain visible historical/unknown/no-personal-safety qualifications.
5. **Later polish:** A11/A13, optional map ergonomics and evidence-only retry. Isolate lifecycle changes and retain coordinate/stale-response/cancellation regressions. No new APIs or safety models are needed for the minimal pass.

No implementation is included in this audit. All follow-up stages should retain palette, typography, rounded cards and five-step flow. Run full frontend tests, TypeScript and build after implementation; browser acceptance remains separate.

## Chrome DevTools and keyboard acceptance procedures

Record Chrome version, OS, viewport/zoom, mode, frontend/backend origins, route inputs and actual pass/fail for each case. All cases below are pending.

| ID | Reproducible procedure | Acceptance expectation |
|---|---|---|
| M01 | Toggle device toolbar, Responsive mode; enter each matrix width/height at 100% zoom; complete all five steps | No unintended horizontal overflow or clipped labels; all actions reachable; exact selected route preserved |
| M02 | On results expand every disclosure, select each route, scroll top/middle/bottom at 1650×930 and 320 px | Map controls/OSM attribution never obscured by legend/actions; no nested sidebar scroll; fit/static behavior understandable |
| M03 | Resize across 1024 px and to height 500 px; repeat at 200%/400% zoom | Sticky panel activates only when whole column fits; normal scrolling otherwise; map tiles/geometry remain correctly rendered |
| M04 | Tab from the page start; use skip link, Enter to submit search, Enter/Space on preferences/routes/disclosures; Shift+Tab back | Visible logical focus; selected states exposed; H1 focused below header on transitions; no keyboard trap in map; use in-app Back |
| M05 | Submit whitespace for both fields; correct fields; trigger a recoverable routing error | Errors associated with inputs and understandable; no routing on blank values; retry works; record whether focus needs correction under A08 |
| M06 | DevTools Network: throttle, disable cache; generate multiple routes; choose another before evidence finishes | Named waiting/requested states, sequential evidence requests, selected overview/report evidence consistent; coverage/error never hidden by disclosure |
| M07 | Throttle so POST `/route` stays pending; enter saved comparison, then Back to journey; let old request settle | Current source predicts empty results with disabled overview and no retry. Record reproduction; old response must stay ignored. Recover via Edit → Continue → route request. Also test Edit/back during pending routing and verify no stale evidence |
| M08 | After loading app, block `*tile.openstreetmap.org*` in Network request blocking, disable cache and regenerate/switch route | Record absent map-failure notice under A02; route text and navigation must remain usable. Do not use complete Offline mode to isolate tile behavior because it also breaks API requests |
| M09 | Block only `*/pilot/ranchi/route-evidence*`, then unblock; separately try a genuinely out-of-pilot route | Service failure differs from coverage-unavailable; neither becomes zero counts or mock evidence. Route overview stays usable; recovery limitation documented |
| M10 | Enter saved comparison from welcome and completed results; block only `*/pilot/ranchi/comparison*`, trigger retry, unblock then retry | Heading focus on entry, clear loading/error, eventual historical data, launcher focus on return; no saved/live join. Observe focus when Retry disappears |
| M11 | Enable reduced motion in Rendering panel; repeat navigation, hover and selection | No unnecessary application pulse/hover movement or smooth focus scrolling; record remaining step/map animation separately |
| M12 | Inspect Accessibility pane, then use an actual screen reader for full journey and saved retry | Correct H1/H2/H3 order, names/pressed states, native expanded state and intelligible route-specific status updates; no unsupported “safe” implication |

Do not corrupt verified files to test failure paths. Dataset/busy/timeout fixtures already have historical automated coverage; a subsequent authorized frontend test pass can exercise their UI deterministically. DevTools offline/request blocking does not reproduce every backend error code.

## Reproducible local startup checklist

These commands are instructions for the presenter, **not commands executed by this audit**. Use dedicated PowerShell terminals. This sequence targets the documented existing Windows workspace, not a fresh-machine installation recipe.

### 1. Confirm files, dependencies and provider configuration

```powershell
Set-Location D:\shepath
git rev-parse --short HEAD
Test-Path .\backend\.venv\Scripts\python.exe
Test-Path .\data\ranchi_safety\.pbf_venv\Lib\site-packages
Test-Path .\frontend\node_modules
```

Expect the audited commit `af23600` unless later authorized changes were made. The three paths existed during this audit. Preserve repository-relative pilot artifacts and their verified hashes; do not regenerate datasets or pins to get past readiness failures.

Ensure `HEIGIT_API_KEY` is configured privately in the backend process environment or `backend/.env`. `get_heigit_api_key()` loads that file lazily; an existing process environment variable takes precedence. Do not put the key in a `VITE_*` variable or print it in demo logs. A valid key/network is needed for live route generation, not for local geographic analysis or saved artifact comparison.

The documented backend uses CPython 3.11-compatible packages. This workspace's geographic packages were historically supplied by the existing Stage 1 environment. If required packages/node_modules are missing, stop and provision the declared dependencies separately before rehearsal; this audit does not authorize or perform installation. `backend/requirements.txt` declares Shapely 2.1.2, pyproj 3.7.2 and osmium 4.3.1 as well as FastAPI/httpx/uvicorn. Use the existing frontend lockfile/toolchain rather than upgrading before a demo.

### 2. Start backend — terminal A

```powershell
Set-Location D:\shepath
$env:PYTHONPATH = 'D:\shepath\data\ranchi_safety\.pbf_venv\Lib\site-packages'
.\backend\.venv\Scripts\python.exe -B -c "import fastapi, httpx, uvicorn, shapely, pyproj, osmium; print('Backend and geographic imports OK')"
.\backend\.venv\Scripts\python.exe -B -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8011 --workers 1 --limit-concurrency 32 --lifespan on
```

The process-local PYTHONPATH replaces any existing setting in that terminal. Use it only with the documented compatible environments; if the backend environment is independently provisioned with compatible geographic packages, omit that line. Do not use `--lifespan off`. Keep the terminal open. Use one worker and avoid parallel demo tabs that can occupy the analysis slot. A timed-out native calculation can retain that slot until it finishes; rapid retries do not clear it. Dependency/artifact initialization failure can require repair and worker restart, not a page refresh.

### 3. Start frontend — terminal B

```powershell
Set-Location D:\shepath\frontend
$env:VITE_ROUTING_PROVIDER = 'api'
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8011'
npm.cmd run dev -- --host 127.0.0.1 --port 8080 --strictPort
```

Process variables avoid editing `.env.local` for rehearsal and explicitly configure both live and saved clients. Restart Vite after changing configuration; a production build requires the intended variables at build time too. Open `http://127.0.0.1:8080`. If 8080 is occupied, stop this launch or use explicitly allowed 8081 with `--strictPort`; do not silently accept another port. Current backend CORS lists localhost/127.0.0.1 on 8080/8081 only.

Chrome DevTools mobile emulation uses the same local origin and is supported by this checklist. A real phone cannot reach the desktop through its own `127.0.0.1`; LAN hosting, firewall and backend allowed-origin changes are separate setup work, not covered or performed here.

### 4. Verify three independent capabilities — terminal C and browser

```powershell
Set-Location D:\shepath
Invoke-RestMethod -Uri 'http://127.0.0.1:8011/health'
$saved = Invoke-RestMethod -Uri 'http://127.0.0.1:8011/pilot/ranchi/comparison'
$saved.status
```

Health must respond but is insufficient. The saved endpoint must return a coherent available comparison, and the browser saved screen must load from the configured frontend origin. An HTTP terminal check alone does not test browser CORS.

In the browser, generate the rehearsed walking journey (the integration guide suggests Albert Ekka Chowk → Doranda, Ranchi as a candidate, **not** a coverage guarantee). Wait for the live route, map tiles and at least the route intended for presentation to reach an available evidence state. Check Network for successful `/route` followed by sequential `/pilot/ranchi/route-evidence` requests. Confirm each submitted ordered coordinate list corresponds to its returned live route; do not replace it with saved coordinates. Record actual coverage and timing. If unavailable, choose and rehearse a covered journey before the presentation; never claim that a Ranchi label ensures coverage.

Check OpenStreetMap tiles and remote Google Fonts load. A font fallback should remain readable, but full typography/layout may differ. Do one cold-start rehearsal to expose lazy dataset/dependency failures, then keep services warm. Current large client payload/build warnings and evidence payload parsing can affect cold/slow-mobile behavior; previous test timings are not live latency promises.

### 5. Failure/stop procedure

If startup/import/configuration fails, correct the specific prerequisite outside the demo rather than changing verified artifacts. If live routing fails during rehearsal, verify key/provider connectivity and browser origin. If only evidence fails, retain route navigation and explain the limitation. The saved comparison is an API-dependent historical fallback, not an offline mode. If all network/backend access is unavailable, use prepared, clearly labeled screenshots or a recording of the rehearsal; none were created in this audit. Stop each foreground service with Ctrl+C after the session.

## Five-to-ten-minute presentation plan

| Time | Demonstration | Accurate narration |
|---|---|---|
| 0:00–1:00 | Welcome and search | Walking-route comparison; preview is illustrative; evidence is bounded historical mapping |
| 1:00–2:00 | Step 2, continue or skip | Interests are a prototype preview and do not alter routes |
| 2:00–4:00 | Rehearsed results, select alternatives and expand one panel | Times/distances are provider estimates; “Fastest” is time-only; missing tags are unknown; facilities are mapped objects |
| 4:00–5:30 | Route overview then Geographic evidence | Correct selected route and historical snapshot; no personal-safety assessment or turn-by-turn navigation claim |
| 5:30–7:00 | Saved comparison, only after route generation completes | Separate fixed historical journey/profile comparison, not evidence for the live route and not an offline cache |
| 7:00–9:00 | Limitations and questions | Pilot coverage, sparse tags, unknown real-world completeness, external tiles/provider dependency and pending mobile acceptance |

For a five-minute slot, shorten the saved comparison and discuss failure states verbally rather than inducing long timeouts live. Avoid simultaneous evidence requests from multiple tabs. Have the rehearsed failure/recovery explanation and labeled backup ready; never present a recorded result as live.

## Completion

Stage 4A adds this report only. Findings comprise 3 High, 8 Medium and 2 Low priorities. Current desktop readiness is **conditional on a successful same-environment rehearsal and corrected-layout check**; mobile and accessibility acceptance remain **not established**. The minimal next implementation pass should address interruption recovery and map-failure messaging, then resolve defects actually reproduced by the mobile/keyboard matrix while preserving verified route-evidence behavior.
