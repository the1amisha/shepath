# Small-query resumable Phase 4B extraction

This is a new pipeline. It does **not** execute the old full expanded request or
change any prior snapshot, script, report or failure evidence. Dependencies are
the existing isolated Shapely/pyproj installation described in
`ROUTE_COVERAGE_README.md`. No API keys or backend code are read.

The default run folder is `data/ranchi_safety/tiled_runs/phase4b_20261009_2x2`.
Its `manifest.json` is the persistent source of task status and cooldown state.
The exact validated bbox is south 23.335059, west 85.308481, north 23.380000,
east 85.340000, checked against the existing saved boundary metadata. All three
saved real walking routes and full 100 m buffers are rechecked during initialization.

## Initialize and verify offline

From the repository root (PowerShell):

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p 'test_resumable_osm.py' -v
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py init
```

Initialization downloads nothing. Default **2×2** grid creates **24** tasks:
four tiles × roads/pedestrian infrastructure, lighting/lamps, police, healthcare,
pharmacies, and commercial businesses. Tiles have disjoint interiors and shared
edges; inclusive Overpass bbox queries may return shared-edge/crossing objects.
Each query is restricted to one tile and one category. Business selectors do
not require opening_hours. Healthcare/pharmacy/commercial categories can overlap.

For finer subdivision, initialize a **new** run without changing the current
manifest or reusing its task coverage as if it were the new grid:

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py init --run data/ranchi_safety/tiled_runs/phase4b_3x3 --grid-size 3
```

This makes 54 tasks. Public-server grids from 2 to 10 are supported; use finer grids only
if needed. Changing grid size on an existing run is rejected rather than silently
invalidating successful work. Endpoint selection (`--endpoint`) is initialization
only and is pinned thereafter. Do not rapidly initialize runs to switch servers.

## One cautious live test only

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py run --task r00c00-police --max-tasks 1 --attempts 1
```

This sends at most **one** request for the southwestern tile's police records,
with no retry. Empty sparse-category results can be legitimate and require a
matching zero-count sentinel; they do not establish real-world absence. An empty
urban roads task is flagged for review. This command does not launch the remaining
23 tasks. If it succeeds, repeating it validates and skips its saved response.

## Inspect, resume and complete later

Read status and regenerate partial/complete outputs without network access:

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py status
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py merge
```

Resume the next pending/failed task cautiously:

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py run --max-tasks 1 --attempts 2 --interval-seconds 30
```

When ready to complete the remaining manifest, run one bounded sequential batch:

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py run --max-tasks 24 --attempts 2 --interval-seconds 30
```

`--max-tasks` counts newly attempted tasks, not valid successes skipped on resume;
24 is an upper bound, so existing successes are not redownloaded. The pipeline
stops the batch if a task fails. Review the report and wait for cooldown before
resuming with the same command. **The complete-batch command is documented for
later use; it is not part of the authorized initial single live test.**

For a different run, add `--run <its-folder>` to each command. A process lock
prevents concurrent pipeline runs. On a hard crash, first verify no pipeline
process is running, then remove the stale `.tiled_pipeline.lock` inside this folder.
Pending interrupted tasks can be resumed; successful responses are never silently
redownloaded if their hashes are damaged—resolve integrity issues manually.

## Timeouts, retries and persistent evidence

Requests are sequential, with a **25 s server timeout**, **45 s client timeout**,
and at least **30 s** between requests. HTTP 429/500/502/503/504 and transport
timeouts receive at most the configured 1–3 attempts per task per invocation.
Backoff is 30/60/120 seconds and respects longer Retry-After seconds or HTTP dates.
The next-request time is persisted across invocations. Cooldowns over 60 seconds
stop processing with a resume time rather than blocking indefinitely or retrying
early. No automatic endpoint switching occurs. A single-task command exits after
that task without waiting merely to end the process.

Each attempt gets a unique timestamped folder under `tasks/<task-id>/`, containing
the exact query and provenance (bbox, endpoint, request/retrieval time, query/raw
hash, base timestamp and record count), plus raw JSON or an HTTP error body.
Raw bytes are written before validation; the manifest is atomically updated only
after response validation. It records pending/successful/failed tasks and every
attempt. Interruptions before success remain resumable without trusting partial data.

Validation requires parseable JSON, no error remark, valid element schema, matching
category, supplied coordinate validity, edit/base metadata and a **terminal count**
matching total and node/way/relation counts. A terminal count helps detect incomplete
query output; it does not certify real-world completeness. Missing geometry is
flagged separately rather than inventing coordinates. Malformed responses are
retained but not retried automatically as if valid. Reference:
https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL

## Merge and reporting

Merging first verifies all manifest tasks, exact tile coverage and successful raw
response hashes/queries. All six categories need all tiles before a complete task
set is accepted. Incomplete acquisition goes only to `partial/<timestamp>/`;
`complete/<timestamp>/` is reserved for a validated entire task set. Every output
has a manifest snapshot, merged original records, GeoJSON, quality summary,
variant evidence and `TILED_EXTRACTION_REPORT.md`; a current report also appears
in the run folder. Earlier outputs remain intact.

Deduplication uses OSM type plus ID. Full records are preserved; tags from different
versions are not combined. Where records change between tasks, newest OSM version
then edit timestamp wins, with usable geometry and a stable tie-break. All raw
variants remain available with their source tasks. Same-version disagreement blocks
complete merged output pending review. Acquisition spans multiple snapshot times,
which is explicitly reported.

Category tile-acquisition percentages describe which areas were successfully
queried, not feature completeness. Full geometric coverage of the requested extent
is separate from actual acquisition coverage. Zero partial counts may mean a category
has not been queried. Lighting/sidewalk gaps remain unknown; hours presence is not
current opening status. OSM tags, coordinates, facilities, access and freshness need
later review even after all tasks succeed. This is never a complete Ranchi inventory.

Data: © OpenStreetMap contributors, ODbL 1.0,
https://www.openstreetmap.org/copyright. No backend/frontend/ML changes, route API
calls, safety scores, commits or pushes.
