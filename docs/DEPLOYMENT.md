# SHEPATH deployment preparation

The backend runs on Render; the frontend is deployed separately. Keep API keys
in private hosting configuration, never in frontend build variables.

## Backend

Build from the repository root:

```sh
docker build -f backend/Dockerfile -t shepath-api .
docker run --rm -p 8011:8011 --env-file /path/to/private-runtime.env shepath-api
```

Set HEIGIT_API_KEY privately in the hosting environment. Set
SHEPATH_CORS_ORIGINS to the exact HTTPS frontend origin (comma-separated for
multiple origins, no paths or trailing slash). Set PORT as required by the host;
the default is 8011. Configuration must be in the process environment, not merely
in a file that is not loaded. CORS is not authentication or rate limiting; add
host-level quota protection before public release.

The container runs as a non-root user with one worker and concurrency limit 32.
Image builds run preflight validation for both bundled evidence profiles. At runtime,
the worker validates and loads the selected profile on its first evidence request.
There is no separate runtime preflight process repeating this work before the server
starts. The health endpoint is a liveness check, not evidence readiness.

The original pilot dataset is the default. The campus profile requires both:

- data/ranchi_safety/hatia_mahilong_boundary.json
- data/ranchi_safety/offline_runs/eastern_261008_hatia_mahilong_v1/

The validated campus files are bundled in the repository. Set
SHEPATH_EVIDENCE_DATASET=hatia-mahilong to select them.
Preserve the manifest, paths and all hashed artifacts, including pilot.osm.pbf.
Do not include unrelated regional PBFs or local SQLite databases. Run
`python backend/preflight.py` after selecting the profile; a missing or invalid
dataset must fail rather than silently fall back.

## Frontend

Use a separate frontend deployment with build-time VITE_API_BASE_URL set to the
public HTTPS backend URL and VITE_ROUTING_PROVIDER=api. From frontend run:

```sh
npm ci --ignore-scripts
npx tsc --noEmit
npm run build
```

The current build produces .output/server/wrangler.json, .output/server/index.mjs
and .output/public. Treat it as the configured Cloudflare Worker application,
not a plain static-site folder. The build advertises `npx nitro deploy --prebuilt`;
run deployment only with the intended account and final URLs configured.

## First evidence request

On the free hosted instance, campus initialization has taken about 154 seconds.
The backend returns `504 analysis_timeout` after 60 seconds but keeps the job running
and caches its successful result. The frontend now retries that exact request,
including `503 analysis_busy` responses, for up to four minutes per route once it
leaves the serial queue. Requests remain sequential; changing journeys cancels
waiting and queued work. Each request has a 75-second deadline, capped by the
remaining recovery budget. Other errors, including network failures and unstructured
gateway timeouts, are terminal. Routes remain usable while evidence loads.

This recovers from slow initialization; it does not make dataset loading instant.
After deployment, test a first request after a restart and a second warm request.
Confirm evidence appears without refreshing and that changing journeys prevents
stale results. Local automated checks cannot establish hosted startup timing.

## Evidence cache and checks

Successful evidence response bytes are cached in each worker for identical
requests against its immutable loaded dataset. Defaults: 32 entries, 16 MiB,
300-second TTL. Errors are not cached. The existing admission limits and HTTP
Cache-Control: no-store remain in place. Expiry is lazy on the next request;
idle entries can remain in memory until another request or shutdown. This cache
does not verify live street conditions. Restart workers when updating datasets.

Run backend validation with `python -m unittest discover -s backend/tests -q`.
Run `python scripts/benchmark_evidence.py` for an offline fixture benchmark.
Previous local measurements were roughly 1.8–1.98 seconds cold and under 1 ms for
identical repeats. Those numbers are not campus-data or hosting guarantees.

The historical parity test compares the complete current engine output, repeated
response bytes and archived route/category evidence. It tolerates tiny geometric
floating-point differences in historical numeric values. Archived artifacts are unchanged.

The original preparation passed 54 backend tests, frontend type checking and
production build. Docker was unavailable, so the image has not been built or run.
Inherited Python web dependency versions remain unpinned; freeze tested versions
before release. No live routing-provider calls or hosting changes were made.
