# Reproduce the route-coverage experiment

Run from the repository root, using Python 3.11+ on Windows. The existing backend
must already be serving the local FastAPI API; this experiment does not start or
modify it. Default URL is `http://127.0.0.1:8000`.

Install isolated geometry dependencies **inside this experiment folder**:

```powershell
.\backend\.venv\Scripts\python.exe -m pip install --target data/ranchi_safety/.route_coverage_deps -r data/ranchi_safety/route_coverage_requirements.txt
```

The backend environment itself is not changed. The local dependency folder is
ignored by git. The script adds only that folder to its Python import path.
Shapely and pyproj perform geometry operations; no OSM API client is required.

Run synthetic offline tests, then the actual API experiment:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p 'test_route_coverage.py' -v
.\backend\.venv\Scripts\python.exe data/ranchi_safety/verify_route_coverage.py
```

Alternate local backend port and configurable buffer (in metres):

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/verify_route_coverage.py --base-url http://127.0.0.1:8011 --buffer-metres 100
```

The script submits the exact request:

```json
{"origin":"Albert Ekka Chowk, Ranchi","destination":"Doranda, Ranchi","travelMode":"walk"}
```

It accepts only loopback base URLs, bypasses proxies for the local request and
refuses redirects. It calls **POST /route**, not HeiGIT directly. The backend may
contact its configured upstream to obtain the real route. No API key is read,
copied or supplied by this experiment. One request per run, with a 90-second
client timeout; no automatic retry that could hide changing route results.

## Inputs and outputs

Default boundary and provenance come from the successful extraction at
`outputs/20261008T133610_076939Z/run_status.json`; its raw response is hashed.
The existing bbox is never replaced. `--snapshot` can select another successful
saved extraction inside this folder; it reads that snapshot's actual boundary.
The pinned default is the same snapshot analyzed in DATA_COVERAGE_REPORT.md.

Each run writes a new timestamped subfolder in `route_coverage_runs/` containing:

* `experiment_config.json`: exact request, snapshot provenance, buffer and mode.
* `backend_response.json`: original local API response bytes on HTTP success.
* `routes.json`: retrieval timestamp, response hash, endpoint, exact request and
  all returned routes with original ID, coordinates, distance, duration and endpoints.
* `coverage_results.json`: per-route lengths, percentages, buffer areas, full
  containment flag and uncovered bounds. API distance is distinct from measured
  polyline length. Percentages retain precision rather than rounding in JSON.
* `uncovered_areas.geojson`: outside centerline pieces and missing buffer polygons
  in **[longitude, latitude]** order, identified by route ID.
* `run_status.json`: explicit success/failure and run mode.
* `ROUTE_COVERAGE_REPORT.md`: archived report; the same report is also written at
  the experiment folder's root for easy review.

Offline replay of a real saved retrieval requires no backend or network access:

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/verify_route_coverage.py --saved-routes data/ranchi_safety/route_coverage_runs/<run>/routes.json --buffer-metres 100
```

The original retrieval time is preserved. A new analysis run is created and
marked `offline_reanalysis`. Offline provenance is not independently authenticated;
use the response hash and original response for auditing. Synthetic tests never
create a real route-retrieval artifact.

## Geometric interpretation

Coverage is geometric containment by the sampled boundary, not completeness of
OSM records within it. Segments are clipped at the actual boundary, and measured
on the WGS84 ellipsoid; checking vertices or endpoints alone is insufficient.
Backtracking counts as traversed distance. Zero-length routes are rejected.

The default analysis buffer is a **100 m radius corridor on both sides**, with
round endpoints, not a 100 m total width. It is built in UTM zone 45N in metres.
Area percentages describe the union corridor; overlapping route buffers within
one route are not counted twice. The bbox and line are densified at ≤25 m spacing
before projection; round arcs use 64 chords per quadrant. Small projection and
polygon-approximation errors remain, particularly at millimetre-scale boundaries.
These are planning measurements, not survey-grade areas.

Full buffer coverage uses polygon containment, independent of displayed percentage
rounding. A centerline can be fully covered and still have an uncovered buffer.
Outside areas and suggested envelopes are for a **future** extraction only; this
experiment does not query Overpass or download OSM data.

Geocoding remains the backend's responsibility. Inspect the saved route endpoints
and geometry before concluding that they represent the intended named places.
A route more than one degree from central Ranchi is rejected for this local
projection rather than reporting misleading buffer measurements.

## Failure behavior

If the backend is unavailable, times out, returns an HTTP error, lacks routes or
violates its documented schema, the run exits with status 1 and writes an explicit
failure report. An HTTP-success body is preserved even if unusable; HTTP error
bodies are saved separately. No coordinates or metrics are fabricated. Failed
reports state that coverage is unverified; previous run artifacts remain intact.

The script intentionally imports no backend code and does not inspect environment
files. It changes nothing outside `data/ranchi_safety/`, and does not classify
route safety, rank routes or train models.
