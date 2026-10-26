# SHEPATH Phase 6 — Stage 4B: Route Interruption Recovery and Map Failure Handling

Date: 2026-10-11. Baseline inspected: `af23600`. Scope: frontend implementation of audit findings A01 and A02.

Read the Stage 4A audit and Stage 2/3 reports before implementation. No backend, routing service, dataset, dependency, saved-pilot calculation or geographic-analysis changes. No commit or push. The pre-existing untracked root `PHASE_6_STAGE_4_AUDIT.md` was left untouched.

## A01 — Interrupted route recovery

`src/routes/index.tsx`, `ShePathApp`:

- Saved-comparison entry now immediately invalidates the route request generation. The existing visibility/input effect and unmount guard remain. Recording interruption is conditional on a request actually being in flight; viewing saved comparison after a completed request retains the completed routes.
- Returning to results after interruption shows an explicit live status explaining that the interrupted response will not be used, with **Retry route** and **Edit journey** buttons. No route is selected and progression remains disabled until routes arrive.
- Retry invokes the existing validated request path with the current trimmed origin/destination and walking mode. It clears interruption/error state, routes and selection before starting a new generation. Editing returns to the existing journey form and validation.
- Pending requests, interruptions, a service resolving to an empty array, and routing errors have separate presentation. Existing API-adapter exceptions, including its explicit no-routes error, retain their useful error text and existing **Try again** action. The routing service itself is unchanged.
- Success, failure and finalization from obsolete generations remain ignored. An old request cannot clear a newer request's loading state, supply routes, select an ID or initiate evidence analysis.

Cancellation here is logical invalidation, not transport cancellation: the existing routing service does not accept a caller AbortSignal. Its request may continue until completion or its existing timeout. Changing that service contract was outside scope. Geographic evidence cancellation, exact-coordinate identity validation, bounded retries and sequential processing remain unchanged.

## A02 — Map failure handling

`src/components/ShePathMap.tsx`, `ShePathMap`:

- Leaflet stays dynamically imported inside the browser effect. Import/setup exceptions are caught locally and shown as an accessible status instead of an unhandled rejection/blank map. Any partially created map and tile listener are cleaned up.
- A separate `tileerror` listener reports an incomplete/unavailable OpenStreetMap basemap while explaining that returned route information remains usable. Mock-preview wording remains explicitly illustrative. Tile failure does not become a route-generation error.
- Route cards, estimated time, distance, route selection, geographic evidence and next-step actions remain outside the map failure UI and usable. An absent selected route shows a neutral waiting-for-route message without drawing fallback geometry.
- **Retry map** provides at most two manual reinitializations per mounted map view, after which it is disabled with explanatory text. There is no automatic retry loop. Retry reuses the exact supplied routes, coordinate ordering and selected ID; it does not call routing or evidence services.
- Map cleanup removes the tile listener. Disposed callbacks cannot change the current map state. Normal route selection still follows the existing map lifecycle; this stage does not refactor it.
- Failure messages occupy normal flow above the map, not an overlay over its controls. A status-change size invalidation accounts for the space used by messages, with panning and animation disabled. Polyline construction, colors, markers, fit-bounds inputs and tile URL remain unchanged.
- Existing Leaflet OpenStreetMap attribution is retained; the failure notice additionally names © OpenStreetMap contributors. No replacement geometry or basemap is manufactured.

`src/routes/index.tsx` also removes the redundant top-left selected-route map overlay so it cannot cover failure text/retry. Selection remains explicitly labeled on the route card and in the existing selected-actions row. Map, legend and actions retain their Stage 3 normal-flow/conditionally sticky composition. No stylesheet, focus-helper, navigation-history or reduced-motion changes.

## Files changed

| File | Change |
|---|---|
| `src/routes/index.tsx` | Immediate saved-entry invalidation, interruption/empty recovery UI, removal of redundant map overlay |
| `src/components/ShePathMap.tsx` | Import/setup and tile error handling, accessible messages, bounded local retry, cleanup and status-related sizing |
| `src/test/comparison-navigation.test.tsx` | Three additional recovery/state regression cases |
| `src/test/map-failure.test.tsx` | Six map failure, retry, geometry and app-integration cases |
| `src/test/map-import-failure.test.tsx` | Rejected dynamic-import regression |
| `PHASE_6_STAGE_4B_REPORT.md` | This implementation/validation report |

## Automated validation

Commands run from `D:\shepath\frontend`, except the Git check from the repository root:

| Check | Result |
|---|---|
| `npm.cmd test -- --maxWorkers=1` | **85 passed in 12 files**, exit 0; 56.99 seconds |
| `.\node_modules\.bin\tsc.cmd --noEmit` | Passed, exit 0 |
| `npm.cmd run build` | Passed, exit 0; client, SSR and Nitro output |
| `git diff --check` | Passed |

The full suite includes existing API/mock distinctions, saved comparison, route/evidence isolation and navigation tests. Added assertions cover interruption → saved → return, retry with the current trimmed journey, obsolete success during a retry, obsolete failure during saved view, ordinary empty results versus routing errors, rejected Leaflet imports, initialization failure, tile failure, the retry bound, cleanup of old tile callbacks, original-coordinate reuse, and continued cards/actions/evidence availability with either map failure. Map retry causes no extra routing/evidence calls in integration tests.

Tests use DOM simulation, deferred promises and a Leaflet mock. They establish application behavior, not actual tile rendering, browser layout or live backend availability. The import-rejection test uses a rejecting module mock. No real browser, mobile device or screen-reader testing was performed in this stage.

Build warnings: client chunk exceeds 500 kB (515.59 kB minified / 157.30 kB gzip), tsconfig-path plugin guidance, plugin timing advisory and ignored `inlineDynamicImports` option. Dependencies/configuration were not changed to address these unrelated warnings.

## Limitations and manual browser acceptance

Use the Stage 4A startup checklist with API mode and the configured backend running. Keep Chrome DevTools Network open with Preserve log. Use request blocking only for the resource under test; restore it afterward. Do not treat a frontend success message as proof of backend/dataset readiness.

1. **Pending route → saved → return:** enable network throttling, submit a valid walking journey, and enter Saved Ranchi Pilot Comparison while `/route` is still pending. Return to the journey. Expect the interruption explanation, Retry route, Edit journey, zero route cards, and disabled overview. Let the old request finish; it must not restore cards, selection or dynamic evidence requests.
2. **Retry and stale response:** repeat, then click Retry route before the original response finishes. Verify a new request uses the current origin/destination and walking mode. Only that generation may populate results. Repeat with Edit journey and visibly different inputs (including surrounding spaces); inspect the request body for trimmed current values. If throttling cannot reliably reverse completion order, use a controlled development proxy to delay the first response; the deterministic promise test already covers that ordering without production-code changes.
3. **Empty/error distinction:** block the route endpoint or stop the backend and submit; expect the existing routing error and Try again, never mock/saved routes. Restore connectivity and retry. The API adapter reports a zero-route API response as its existing explicit no-routes error; an adapter returning an empty array uses the ordinary empty recovery panel. Confirm there is no endless loading indicator.
4. **Tile failure only:** first obtain live routes, then block `*tile.openstreetmap.org*`, disable cache and use Retry map if a failure is already displayed, or select another route to initialize the map. Expect a basemap warning, source attribution, unchanged selected route/estimates/evidence and working overview/report navigation. No new route/evidence requests should result from Retry map. Some already loaded tiles may remain visible; a partial failure is deliberately sufficient to warn.
5. **Map retry bound/recovery:** with tile blocking active, click Retry map twice, allowing each attempt to finish/fail. Expect a disabled button and limit message, with no timed retry loop. On a fresh mounted view, unblock tiles and retry after one failure; confirm map controls and route geometry render normally. Pan/zoom can cause Leaflet's normal tile requests; those are not an application retry loop. The two-click allowance resets when the map component remounts, such as changing journey screens, and is not a session-wide service quota.
6. **Import failure:** in a production preview, inspect the dynamically loaded `leaflet-src-*.js` request. Block that chunk before a fresh reload with cache disabled. Verify the map initialization message while landing navigation and later textual route results remain usable. Browser module-import failures can remain cached after unblocking, so a full reload may be necessary; Retry map is an attempt, not a guarantee of recovery. Do not claim this tests every possible Leaflet initialization exception; those are covered by the mock regression.
7. **Layout/keyboard:** at 320, 390, 768 px and approximately 1650×930, inspect both failure notices and exhausted retry text. Confirm no clipping/horizontal overflow; zoom controls and OpenStreetMap attribution remain reachable where map content is visible. Scroll the entire results column, expand evidence and resize height. Verify the existing sticky panel falls back to normal document scrolling when it cannot fit. Failure messages reduce the map's available space; actual rendered sizing still requires acceptance.
8. **Focus and announcements:** using Tab/Shift+Tab/Enter/Space, enter/exit saved view, activate Retry route and Edit journey, select routes, retry the map and continue through overview/report. Check visible focus and existing heading/launcher restoration. With a screen reader, verify interruption/map statuses are announced intelligibly. A successful map retry removes its failure controls; verify the resulting keyboard position remains understandable. Repeat with reduced motion enabled; status resizing must not animate/pan the map.
9. **Regression rehearsal:** run the five-step journey and saved comparison with normal connectivity, inspect selected-route/evidence consistency and source disclaimers, and confirm the saved calculations/retry behavior remain unchanged. Repeat a mock-mode run separately; illustrative labels must stay visible and map failures must not imply live route evidence.

External tile availability, indefinitely stalled tile requests without an error event, browser chunk caching and transport-level route cancellation are not solved here. No timeout heuristic or fallback geometry was added. Other Stage 4A findings remain outside this A01/A02 implementation. Desktop demo and mobile acceptance remain conditional on the browser rehearsal above; automated checks alone do not establish either.
