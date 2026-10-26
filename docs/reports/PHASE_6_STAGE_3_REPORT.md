# SHEPATH Phase 6 — Stage 3 implementation report

Date: 2026-10-11 (Asia/Calcutta). Baseline verified: `2688d8c`. Working tree was clean at the start.

Read `../PHASE_6_UI_AUDIT.md`, `PHASE_6_STAGE_2_REPORT.md` and `AGENTS.md` before implementation. Changes are confined to `frontend/`. The explicitly requested live integration is preserved despite historical mock-only repository guidance. No commits or pushes were made.

## Implementation

| Finding | Change |
|---|---|
| F07 | All five steps and welcome expose a programmatically focusable H1. Step transitions focus that heading and scroll it below the measured sticky-header height plus 16 px. Saved-view entry focuses its heading; return focuses and scrolls to the recreated launch button, rather than a detached DOM node. Skip-to-content links use the same behavior without modifying history/hash. Step count includes a screen-reader step name. Data/loading updates and route selections do not trigger page focus resets. |
| F14 | Result panels retain a brief availability summary, route-specific status, historical/no-personal-safety qualifications and provenance outside a native disclosure. Metrics, tag details and methodology are collapsed initially on results; overview/report remain expanded initially. Native summary controls are keyboard operable and have visible focus styles. The sidebar no longer has its own height-limited scroll container. Cards precede the map in both DOM and mobile visual order. Following the desktop correction below, the selected-route actions sit below the map and legend in a shared, conditionally sticky right column, exposing time/distance, Locate selected route and View route overview. Locate scrolls/focuses the selected card without changing selection. |
| F15 — scoped feedback | Waiting/requested/complete/error messages identify the route. Waiting explains one-at-a-time processing; requested status acknowledges possible service waiting and bounded retries, without pretending the client knows when native analysis starts or promising completion. Results show how many routes finished an attempt, explicitly not how many succeeded. Routes remain selectable while evidence is pending or failed. |
| F22 — scoped readability | Evidence uses 14 px text with more line spacing. Full result journey names wrap instead of truncating; overview statistics stack on narrow screens; input/stat labels increase to 12 px. Header can grow rather than enforcing a fixed height. Selected actions wrap and include safe-area padding. Results map now scales with half the viewport height, with the unchanged map component's 360 px minimum as a floor; see the desktop correction below. |
| F23 — scoped motion | Page/focus scroll is deliberately instant. Global smooth scrolling is removed. Reduced-motion CSS disables unnecessary button/link/summary transitions, button hover translation and route-pulse animation. On viewports at most 500 px high, the header and map/action column are static to leave room for content. |

The actions remain in normal flow below the map; only the entire right column may become sticky when it fits. Its exact visibility, wrapping and interactions with browser zoom require browser acceptance. The cream/lavender tokens, typography families, rounded cards and existing five-step state machine remain. Browser Back/Forward, refresh and URL behavior were not changed.

## Contract preservation and scope limits

- `useRouteEvidence`, routing clients, exact-coordinate response validation, sequential queue, bounded retries and cancellation are unchanged. No route arrays are reordered or geometries modified. Disclosure and focus do not request fresh routes/evidence.
- Saved comparison fetching, profile calculations, artifact validation and fixed observations are untouched. Its only changes are heading focusability and a skip link. Returning to a live journey still follows the existing evidence cancellation/restart behavior; it never substitutes saved observations.
- No new API, safety score, inferred current-open state, ML or geographic calculation was added. No backend/data files were modified.
- F15's broader audit proposals for an evidence-only retry action and actual queue/backoff telemetry are deferred. This stage uses only existing states, avoiding changes to the validated request lifecycle. UI text acknowledges bounded retries without claiming to expose a retry counter or completion estimate.
- Saved return deliberately restores the invoking control and brings it into view; it does not attempt to restore an arbitrary pixel position into a remounted results page whose evidence may still be loading. Disclosures reset when their screens unmount. Browser history/persistence (F08), map recreation/tiles (F12/F13), source-date/link changes and pending-route saved-detour recovery (F24) remain outside this scope.
- Small-screen and reduced-motion work is focused, not a complete contrast, zoom, screen-reader or accessibility certification.

## Files changed

- `src/components/RouteEvidencePanel.tsx`: compact native disclosure, visible qualifications/summary and named status messages.
- `src/routes/index.tsx`: compact result use, finished-attempt explanation, selected action area, single document scrolling, responsive text/layout, focus targets and skip controls.
- `src/components/SavedRanchiPilot.tsx`: heading focus target and skip-to-content link only.
- `src/hooks/useJourneyFocus.ts`: new transition focus and measured-header scroll helper; saved launcher restoration.
- `src/styles.css`: focus/skip styles, short-viewport static bars and reduced-motion rules.
- `src/test/comparison-navigation.test.tsx`: new disclosure, visibility, progress, selection/isolation and focus/scroll regressions.
- `src/test/route-journey.test.tsx`: error assertion updated for route-specific wording; existing contract assertions retained.
- `PHASE_6_STAGE_3_REPORT.md`: this report.

## Validation

Commands run from `D:\shepath\frontend`:

| Check | Final result |
|---|---|
| `npm.cmd test -- --maxWorkers=1` | Passed: 72 tests in 9 files, 30.48 seconds, exit 0; includes 6 new Stage 3 cases |
| `.\node_modules\.bin\tsc.cmd --noEmit` | Passed, exit 0 |
| `npm.cmd run build` | Passed, exit 0; client, SSR and Nitro/Cloudflare output generated |
| `git diff --check` | Passed |
| Final file-scope review | Only frontend files changed; routing/evidence clients, evidence hook, Leaflet component, backend/data/ML unchanged |

Build warnings remain for the main client chunk (513.01 kB minified / 156.53 kB gzip), Vite tsconfig-path plugin guidance and Nitro/Rolldown `inlineDynamicImports`. None failed the build; dependency/performance restructuring is outside this stage.

The original 66 frontend regressions passed after the initial UI changes. During development TypeScript caught indexed dataset access requiring bracket notation; that was corrected. A new progress test initially checked before the evidence effect had published its state; it now awaits that state before asserting the route-specific message. Assertions and production lifecycle protections were not removed.

The test command initially hit Vite's Windows `spawn EPERM` in the sandbox; the required outside-sandbox rerun was requested. The suite uses one worker, as in Stage 2, without changing the test-runner configuration or dependencies.

New coverage checks collapsed metrics are not visible while disclaimers/source/status are visible, native expansion/collapse, coverage/error visibility, route-specific sequential status, selected action/card/map consistency, selected evidence on overview, heading focus across all five screens, no history calls, saved launcher focus restoration, no focus theft after evidence updates, and scrolling below a measured sticky header. Existing tests retain mock/API distinction, stale-response protection, coordinate binding, sequential/cancel/retry behavior and saved/live separation.

DOM tests use map/API doubles. They verify DOM visibility semantics and scroll/focus calls, not actual browser geometry or assistive-technology output. No browser session, screenshot, live route call, backend test or geographic recalculation was performed in this stage.

## Outstanding manual browser acceptance

1. Exercise welcome → all five screens, back through each, Edit, and Plan another journey. Heading focus should be visible below the sticky header, including wrapped headings/zoom. Ensure data arrivals never move focus away from the user's control.
2. Open Saved Ranchi Pilot Comparison from welcome and each step; verify heading focus on entry and launcher focus/visibility on return. Repeat during evidence loading and after completion; confirm route selection and exact map geometry remain unchanged. The pre-existing pending-route detour limitation remains documented rather than silently fixed here.
3. On results verify each collapsed panel has a useful status and visible historical/no-personal-safety/unknown-data qualifiers. Expand/collapse with Enter/Space and pointer; inspect metric correctness, source credit, focus indicator and reading order. Coverage-unavailable and service-error messages must always remain outside disclosure.
4. With a slow evidence service, confirm each queued/requested message names its route, processing is sequential and the finished-attempt count does not imply success. Select another route and open overview before completion; only that route's evidence should appear. Check failure and coverage-unavailable paths without changing verified datasets.
5. At 320, 390, 768 px and desktop widths, test long place names, card → map reading/tab order, single document scrolling, selected action visibility, Locate selected route and map gestures. Check no action bar obscures focused content or Leaflet controls/attribution. At heights ≤500 px, verify bars are static and all actions remain reachable.
6. At 200%/400% zoom and with a mobile keyboard, check header/action wrapping, readable labels, single-column statistics and no horizontal overflow. Verify dynamic sticky-header offset with actual computed dimensions.
7. Enable OS/browser reduced motion. Verify no smooth programmatic scrolling, hover translation or pulse, while keyboard focus remains visible. Native map interaction is unchanged and requires its own future accessibility assessment.
8. Repeat API and mock journeys plus the real saved comparison, confirming no safety ranking or saved/live evidence substitution. Use a screen reader to verify heading levels, pressed states, native disclosure state and named status announcements. Confirm skip links do not add browser history entries.

## Desktop layout correction after manual Chrome testing

The user reported two issues at approximately 1650×930: the bottom-sticky action bar overlapped Leaflet's lower controls/attribution, and the fixed-height right map left a large empty area while scrolling the taller evidence column. These are user-observed browser results; they were not independently reproduced in an agent browser session.

Changes in this follow-up:

- `src/routes/index.tsx`: map, route-color legend and selected actions now occupy consecutive rows within the same right-column wrapper. Actions no longer have bottom-sticky positioning, a floating z-index or placement outside the comparison grid. The legend is also moved out of the map overlay into its own row, protecting the lower zoom/attribution area from both controls. Existing action handlers, route selection, map props and evidence bindings are unchanged.
- `src/components/ResultsMapPanel.tsx` (new): measures its complete height and the current sticky header. `ResizeObserver` tracks header/panel size changes; window resize also rechecks fit. It enables desktop stickiness only when the whole column fits below the measured header with 16 px gaps above/below. Wrapped buttons or a taller header can disable stickiness rather than clipping controls. Observer/listener cleanup is included. Layout-state changes do not remount the map child.
- `src/styles.css`: the map frame uses `max(360px, 50dvh)` with a `vh` fallback, replacing the previous fixed 560 px desktop height. The 360 px floor is the existing Leaflet component's minimum, not a new arbitrary viewport assumption. The complete panel can stick only at widths ≥1024 px and heights >500 px, and only when measured to fit. Mobile, short or insufficient-height layouts use normal document flow. No sidebar scroll container was reintroduced. Existing focus and reduced-motion rules remain intact.
- `src/test/comparison-navigation.test.tsx`: adds a placement regression establishing that map, legend and actions are siblings in that order and actions are not inside the map or independently bottom-sticky.
- `src/test/results-map-panel.test.tsx` (new): covers fitting/non-fitting column dimensions, header growth, viewport shrink, ResizeObserver cleanup, unavailable-observer fallback and preservation of a mounted map child while layout state changes.

Only these files and this report were changed in the follow-up. Earlier uncommitted Stage 3 work was preserved. `ShePathMap.tsx`, its effect/dependencies/geometry handling, routing services, geographic evidence lifecycle, focus helper, saved calculations, backend and datasets were not changed. No commit or push was made.

### Follow-up validation

| Command/check | Follow-up result |
|---|---|
| `npm.cmd test -- --maxWorkers=1` | Passed: 75 tests in 10 files, 48.07 seconds, exit 0 |
| `.\node_modules\.bin\tsc.cmd --noEmit` | Passed, exit 0 |
| `npm.cmd run build` | Passed, exit 0; client, SSR and Nitro output |
| `git diff --check` | Passed |

Build warnings remain for the client chunk (513.71 kB minified / 156.74 kB gzip), tsconfig-path guidance and `inlineDynamicImports`; no dependency changes were made. DOM tests establish placement and measurement decisions; they cannot prove rendered non-overlap, Leaflet tile sizing or actual sticky scrolling. No independent browser testing was performed in this follow-up.

### Browser checks still required for this correction

1. At approximately 1650×930 in Chrome, scroll from first to last result with evidence collapsed and expanded. Confirm the right column follows the viewport below the header, and stops at the comparison grid boundary. The map, legend and actions should remain together, without the previous blank-column composition during the card scroll.
2. Verify lower-right zoom buttons and OpenStreetMap attribution are visible/clickable at initial, middle and final scroll positions. Confirm neither actions nor legend overlays the map. Select every alternative and verify unchanged geometry/evidence association.
3. Resize desktop height, increase browser zoom, and use long/wrapped button text. When the complete right column cannot fit, it must revert to normal page scrolling with every map control/action reachable. Blank space can remain in this deliberate fallback; it is preferable to clipping content or restoring nested sidebar scrolling.
4. Test widths below/above 1024 px, mobile portrait/landscape and short viewports ≤500 px. Verify natural cards → map → legend → actions order, no horizontal overflow, and access to the next-step action. The mobile/short-height action area is intentionally in normal flow rather than floating over content.
5. Check keyboard tab order, Locate selected route, overview/back, saved-view return and reduced-motion preferences. Confirm focus management still exposes headings/cards and browser resizing leaves Leaflet tiles correctly sized. The DOM tests do not validate actual map rendering or assistive-technology announcements.
