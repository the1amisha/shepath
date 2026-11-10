# SHEPATH deployment preparation

This package prepares deployment; it does not deploy the service. It is based on
commit 86642821e98a1b2224f2356e9fe9698f5fd1c30a. Review your local changes before
applying these files, especially backend/app/main.py. Preserve the local campus
boundary and offline exports. No frontend files or private environment files are included.

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
A separate preflight process verifies the selected evidence exports before startup;
it does not warm the serving worker. The health endpoint is a liveness check.

The original pilot dataset is the default. The campus profile requires both:

- data/ranchi_safety/hatia_mahilong_boundary.json
- data/ranchi_safety/offline_runs/eastern_261008_hatia_mahilong_v1/

These campus files were not present in the checked-out repository. Obtain the
validated copies from the laptop before setting SHEPATH_EVIDENCE_DATASET=hatia-mahilong.
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
