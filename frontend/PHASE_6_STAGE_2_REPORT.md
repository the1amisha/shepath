# SHEPATH Phase 6 — Stage 2 implementation report

Date: 2026-10-11 (Asia/Calcutta). Baseline: `8fdfed2`.

Implemented the scoped responsible-copy and presentation changes from `../PHASE_6_UI_AUDIT.md`. The cream/lavender tokens, fonts, rounded cards, preview map composition and five-step state-based journey are preserved. No backend, dataset, geographic analysis, routing algorithm, API or dependency changes were made. Nothing was committed or pushed.

## Findings addressed

| Finding | Implementation | Regression coverage |
|---|---|---|
| F01 | Landing title, description, CTA, page/social metadata and root description now describe walking-route comparison and historical mapped geographic evidence. Personal-safety assessment is explicitly excluded. | API landing and both metadata configurations; mock landing journey |
| F02 | Removed `SafetyScore`, numeric factor bars, mock score metadata, “Best balance” and invented lighting/activity/current-open examples. Preview retains its map/card/badges with a walking icon and neutral illustrative content. Mock options have ordinal names and explicitly illustrative time/distance. | Landing forbidden-claim assertions; full mock journey through all five steps via continue and skip |
| F03 | Step 2 is an optional prototype preference preview. No interests are preselected. Copy states choices do not change routing, order or evidence in either mode; both Continue and Skip are available. | Toggle/continue and skip paths; exact API request shape excludes preferences; mock mode uses its existing fixed provider |
| F04 | Steps 4/5 are Route overview and Geographic evidence, with accurate CTAs and a Walking statistic instead of Safety. No turn instructions or safety report are promised. | API/mock five-step navigation and updated existing journey tests |
| F05 | Native preference and route buttons expose `aria-pressed`, visible Selected/Not selected text and focus-visible rings. Native keyboard activation remains intact. | Toggle/select DOM state, focusability and visible indicator assertions; actual keyboard activation requires browser acceptance below |
| F06 | Overview map wrapper is explicitly 360 px, matching the unchanged map minimum height. Leaflet effect, geometry and behavior are untouched. | Wrapper sizing invariant and unchanged map props; actual rendered overlap/attribution requires browser acceptance |
| F09 | Search uses a native form/submit button, trims both fields before advancing, rejects whitespace with associated field errors, and guards routing against blank trimmed values. Preset buttons explicitly do not submit. | Empty/whitespace submit, associated errors, native form wiring, corrected values, exact trimmed request, preset behavior |
| F10 | Before generation, search explains bounded pilot coverage, the complete route plus 100 m buffer requirement, and why a Ranchi place name is not a coverage guarantee. | Disclosure visible before route calls; no route request from preset selection |
| F11 | Every option has an ordinal name, distance and estimated time. Fastest is a separate time-only badge; exact duration ties are marked. Sub-minute estimates say Less than 1 min. Initial selection is explicitly for viewing, not a recommendation. | Non-fastest first selection, two tied fastest alternatives, distinct names, distance/sub-minute display, selection/map binding |
| F17 | Report H1 and introduction precede the selected evidence panel inside the page frame. Overview evidence also sits inside its page frame before the next CTA. Panels use H2 on overview/report and H3 under result route H2 headings. Result route headings sit outside buttons so button semantics do not hide them. | Heading levels/order, introduction order, distinct selected evidence across results/overview/report |

All ten findings were implementable within the existing frontend contracts; no requested change needed deferral for contract reasons. “Fastest” uses the existing provider duration only, with no route reordering or safety calculation. Internal mock IDs such as `recommended` remain unchanged for identity compatibility but are not displayed as recommendations.

## Files changed

- `src/routes/index.tsx`: scoped copy, neutral preview/mock content, route presentation, optional preferences, selection semantics, search form/errors, overview map wrapper, report placement and heading structure.
- `src/routes/__root.tsx`: responsible root metadata description.
- `src/components/RouteEvidencePanel.tsx`: contextual H2/H3 heading prop only; evidence content and provenance unchanged.
- `src/test/route-journey.test.tsx`: updated public labels while retaining route/geometry/evidence isolation, loading/error and stale-response assertions.
- `src/test/saved-pilot.test.tsx`: updated journey entry/results labels; saved/live isolation assertions preserved.
- `src/test/responsible-presentation.test.tsx`: focused API-mode copy, metadata, form, preference, comparison, heading and evidence-binding regressions.
- `src/test/mock-presentation.test.tsx`: mock-mode five-step continue/skip coverage and absence of unsupported numerical/qualitative claims.
- `PHASE_6_STAGE_2_REPORT.md`: this report.

The root Stage 1 audit was already untracked at the start of Stage 2 and was not edited. No environment files were read for secrets or modified. Existing mock-only guidance in `AGENTS.md` was read; the explicit request to preserve live integration governs this task.

## Validation

Commands run from `D:\shepath\frontend`:

| Check | Result |
|---|---|
| `.\node_modules\.bin\tsc.cmd --noEmit` | Passed, exit 0, after correcting the new validation prop for `exactOptionalPropertyTypes` |
| `npm.cmd test -- --maxWorkers=1` | Passed, exit 0: 66 tests in 8 files, 42.94 seconds; includes 8 new tests in 2 new files |
| `npm.cmd run build` | Passed, exit 0; client, SSR and Nitro/Cloudflare output generated |
| `git diff --check` | Passed |

The first concurrent test run completed with 64 passed and two timing failures: one 5-second mock journey timeout and one 1-second evidence query timeout. The complete suite then passed with one worker and unchanged assertions/timeouts, consistent with host contention during the concurrent run. One sandboxed retry could not start because Vite's Windows subprocess raised `spawn EPERM`; the required outside-sandbox retry completed successfully. No dependency or test-runner configuration was changed.

Build warnings remain: main client chunk approximately 509.69 kB minified / 155.62 kB gzip, Vite tsconfig-path plugin migration guidance, plugin timing guidance, and Nitro/Rolldown `inlineDynamicImports` guidance. These did not fail the build and are outside this stage's scope.

Coverage boundaries: React DOM tests use a map test double and mocked API/evidence responses. Existing client/hook tests exercise response identity, cancellation and sequential evidence behavior. These tests do not establish tile rendering, real provider availability, browser CORS, visual layout or screen-reader output. Native Enter submission is implemented through standard form semantics; the DOM regression dispatches form submission and checks its wiring, not a real browser keypress.

## Preserved contracts and remaining limitations

- `ShePathMap.tsx`, routing service/types, `useRouteEvidence`, evidence parser/queue, `SavedRanchiPilot` and saved comparison client were not changed. Ordered coordinates still pass directly to map/evidence; selection is still bound by route ID and the existing validated evidence lifecycle.
- No new safety rankings, replacement scores, fabricated facility/lighting/activity observations, preference-aware algorithms or APIs were introduced. Mock routes never request dynamic evidence.
- Saved historical data remains separate from live geometry; matching names/IDs do not attach it to the live map. Existing source attribution, missing-data caveats and snapshot identity checks remain.
- Out-of-scope audit findings F07, F08, F12–F16 and F18–F24 remain for later stages: focus/scroll/history, map lifecycle/error UI, panel density, richer progress/retry, diagnostic copy, source/date formatting, zero-denominator polish, saved-view comprehension, broader readability/motion and pending-route detour recovery. Historical wording required by F01/F04 was corrected without expanding into source-date formatting work.
- Preferences remain illustrative interests only. Route times/distances are estimates (mock values in mock mode), not navigation instructions or observed conditions. True fastest ties use exact provider durations; displayed rounded minute values can coincide without a true duration tie.
- No browser testing, screenshots, real live-route requests, backend tests or geographic recomputation were performed for this stage. Demo readiness still requires the acceptance pass below.

## Manual browser acceptance — not yet performed

1. Start the existing configured frontend/backend services. In API mode verify the landing preview is explicitly illustrative, contains no numerical safety score, and page/social metadata no longer promises safety-aware routing. Do not change datasets or service contracts for this check.
2. On Search, submit empty/whitespace fields and verify useful announced errors. Enter valid values with surrounding whitespace and press Enter from each field in separate runs: advance once to step 2, with no routing request until Continue/Skip. Preset buttons must only change destination. Confirm the bounded-pilot explanation is readable before generation.
3. Tab through preferences; use Enter/Space to toggle them and verify focus visibility, visible selection and announced pressed states. Exercise both Continue and Skip. Confirm choices do not change request fields or route order.
4. Generate a rehearsed covered live walking journey. Check unique route names, distance/time, explicit selected state, and the initial-selection explanation. Use controlled frontend fixtures for tied durations if the live provider does not produce them; do not invent live ties. Select alternatives with keyboard and pointer and verify map/evidence remain matched.
5. Open Route overview at desktop and mobile widths. Verify the 360 px map ends before statistics, with Leaflet zoom/attribution accessible and unchanged geometry. Confirm no “step by step” or safety statistic remains.
6. Open Geographic evidence (step 5). Heading/introduction must precede the correct selected route's H2 evidence panel. Verify counts and unknown/source caveats stay associated with the selected geometry and Back preserves selection.
7. In a separately configured mock-mode session, repeat all five steps through Continue and Skip. Confirm no mock safety numerals, invented footfall/current-open claims, “Best” recommendation or dynamic evidence requests appear. Time/distance and fastest-demo labels must remain explicitly illustrative.
8. Open Saved Ranchi Pilot Comparison from a completed live journey and return. Confirm historical labeling and separation, unchanged live geometry and selected route, and no saved counts substituted into dynamic evidence.
9. Check 320/390/768 px mobile widths, desktop, 200% zoom, long location names and a screen reader. Record actual results separately; this stage does not claim broad accessibility or visual certification.
