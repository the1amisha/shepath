# Phase 5D Stage 3 — Dynamic walking-route evidence

Implemented only in `frontend/`. No backend, data, ML or geographic calculation
files were changed in this stage. Existing Stage 1/2 working-tree changes remain
untouched. No commit or push was performed.

## Geometry and configuration

Inspection confirmed `RouteData.coordinates` is `LatLng[]`, explicitly ordered
`[latitude, longitude]`. `ApiRoutingService` validates and preserves the API's
coordinate arrays, and Leaflet uses this same order. The evidence request sends
those exact coordinates with `route_id`, `distance_metres` and `duration_seconds`.
It never substitutes endpoints, a saved journey, mock coordinates or simplified
geometry. Missing geometry is an error. The client validates the response's route
ID **and entire echoed coordinate sequence** before retaining the backend hashes.

`apiBaseUrl.ts` centralizes the existing live API configuration, including its
unchanged development fallback. Both live routing and dynamic evidence use
`VITE_API_BASE_URL`. There is no second evidence URL or hardcoded new port.
The saved pilot client's configuration and behavior are unchanged.

## Changes

- `src/lib/routing/routeEvidence.ts`: typed request client and Zod presentation
  schema; coverage/error handling; process-local browser request queue.
- `src/lib/routing/apiBaseUrl.ts` and `apiRoutingService.ts`: shared live API base
  resolution without changing routing response/model behavior.
- `src/hooks/useRouteEvidence.ts`: sequential walking-route batches, cancellation
  and stale-result protection by route-array identity, journey, mode and view lifetime.
- `src/components/RouteEvidencePanel.tsx`: labeled, responsive sections with polite
  status announcements, mapped counts, tag denominators, missingness, coverage
  limitations, snapshot and OpenStreetMap attribution.
- `src/routes/index.tsx`: evidence beside each live route and on selected-route
  details/report views. Route generation and map selection remain independent.
  A generation counter also ignores late routing responses after editing/leaving
  a journey. The results sidebar scrolls on desktop; mobile sections follow the map.
- New client/hook/component tests and synthetic test fixtures, plus expanded live
  journey regression tests.

The current journey screen requests walking routes only. The reusable hook accepts
`TravelMode` and explicitly skips cycling/driving, without adding a new mode selector
or changing their routing service behavior. Mock mode does not request dynamic
evidence. The fixed Saved Ranchi Pilot Comparison stays in its own component;
opening it cancels the live evidence batch. Returning can reanalyze the live routes,
but never attaches saved-pilot evidence to them.

## Requests, failures and payload size

All dynamic evidence calls in one browser module instance share a single queue.
Each batch awaits one route before submitting the next. Only explicit HTTP 503
`analysis_busy` responses are retried: at most two retries (three attempts total),
waiting the backend's Retry-After seconds clamped to 5–15 seconds. Unmounting or
changing journeys cancels pending retries and ignores late results. Other tabs or
users can still occupy the backend; there is no cross-tab/server capacity claim.

HTTP 200 `available` displays evidence. `coverage_unavailable` displays the full
route/buffer limitation with **no zero counts substituted**. HTTP 422, 503 dataset
failures, 504 and network/CORS errors have distinct messages. No error hides the
route or disables selection/details. No automatic retry is made for geometry,
dataset, timeout, generic service or network failures. A 75-second browser deadline
allows time for the backend's 60-second response deadline; it also prevents an
indefinitely stalled fetch. Aborting browser I/O cannot stop a running backend
thread, so later work may receive busy responses.

The full response is read as JSON. Zod then selects only display data, route identity,
coverage status, uncertainty flags and compact source provenance. Echoed route
coordinates are checked and discarded from the evidence result. Large original
feature geometries, audit IDs and duplicate-pair records never enter React state.
Full response bandwidth and transient JSON parsing memory remain necessary with
the current endpoint. There is no route-ID-only cache.

Displayed counts are nearby mapped OSM records, not physical establishment counts,
accessibility or a personal-safety assessment. Unknown tags remain unknown; explicit
lighting `no` remains recorded information. Sidewalk-tag availability does not imply
a continuous sidewalk. Opening-hours tags do not imply current operation. Activity,
exact walked-street attribution and real-world completeness remain unverified.
No dynamic safety score, ranking, safest badge or current-open claim is added.

## Validation

Final validation on 2026-10-10: **TypeScript passed; 53 tests passed across 6 files,
zero failures; production client/SSR/Nitro build passed.** The test suite ran in
6.75 seconds. This includes all 31 prior tests and 22 new evidence/journey tests.
Vite test startup initially hit the Windows sandbox subprocess restriction; the
suite passed with the approved test command outside that restriction.

From `D:\shepath\frontend`:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd test
npm.cmd run build
```

Tests cover exact coordinate ordering/configuration, compact payload retention,
all required service states, busy retry bounds, the browser deadline, serial
requests across consumers, sequential route batches, stale same-ID geometry,
mode changes/unmount, mock/disabled views, accessible evidence text, preserved map
geometry and usability after failure. Existing routing and saved-pilot tests remain
in the suite. Fixtures are synthetic test data, never production evidence.

Validation uses offline mocked HTTP and React DOM tests. No live routing-provider
calls or visual browser session were required. Manual backend/browser validation
is described below. Production build warnings about bundle size/plugin configuration
do not prevent compilation; the main client bundle is approximately 512 kB minified.

## Manual testing against the backend

1. Start the verified backend as described in
   `backend/docs/RANCHI_ROUTE_EVIDENCE_API.md`. Keep its geographic dependencies and
   verified artifacts available. Existing live route generation also needs its
   usual routing provider configuration.
2. In `frontend/.env.local`, keep `VITE_ROUTING_PROVIDER=api` and set the existing
   `VITE_API_BASE_URL` to that backend's actual base URL. Restart Vite after changes.
   No environment file was edited by this implementation.
3. Run `npm.cmd run dev -- --host 127.0.0.1 --port 8080` from `frontend/`, then open
   the displayed URL. This frontend origin is allowed by the documented backend CORS
   configuration; if the port is occupied, use another configured allowed origin.
4. Plan a walking route using the existing start/destination flow. For example,
   try Albert Ekka Chowk, Ranchi to Doranda, Ranchi. Coverage depends on the **new
   returned geometry**; that place pair is not a guarantee of coverage.
5. Verify the map and route selection work while evidence loads. Each returned
   option should move from waiting to analyzing to a result. In browser Network,
   inspect sequential POSTs to `/pilot/ranchi/route-evidence`; coordinates must
   equal the `/route` response exactly. Inspect counts, unknown tags and attribution.
6. Try a journey outside the pilot. Expect coverage unavailable and no facility
   counts, while navigation remains usable. Service failures should similarly
   leave routes visible; busy responses may retry twice, and timeouts do not retry.
   A second tab issuing evidence work can exercise busy handling without source edits.
7. During an analysis, choose Edit and change the journey, or open Saved Ranchi
   Pilot Comparison. Old evidence must never appear on a new route. Changing the
   selected route must show only that route's evidence. Returning from saved pilot
   may start a fresh sequential batch.
8. Test keyboard route selection and a narrow viewport. Sections should stay readable,
   status changes announced politely, and map/detail controls usable.

The integration is ready for this manual frontend/backend acceptance test. Remaining
limits are backend latency/capacity, pilot-only historical coverage, sparse mapping,
large response transfer, and no manual evidence-only retry control. Re-entering the
live results view starts a new batch; there is no persistent evidence cache.
