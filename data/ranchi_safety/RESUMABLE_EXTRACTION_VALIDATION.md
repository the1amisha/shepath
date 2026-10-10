# Resumable extraction validation — 9 October 2026

## Plan and offline checks

The boundary is unchanged: south 23.335059, west 85.308481, north 23.380000,
east 85.340000. It was compared with the saved validated Phase 4B plan.
All three actual saved walking routes and complete 100 m buffers remain
contained; their geometry and provenance are rechecked when reopening the manifest.

Default grid: **2×2**, four non-overlapping-interior tiles and six categories,
for **24 planned requests**. Adjacent tiles share edges to avoid geographic gaps;
duplicate boundary/crossing records are expected and deduplicated after acquisition.
Roads/pedestrian ways/infrastructure, lighting/lamps, police, healthcare,
pharmacies and hours-independent businesses each have separate per-tile queries.

**13 new pipeline tests passed; 53 total offline tests passed.** New tests cover
exact tiling and overlap/gap rejection; manifest initialization/reopening/config
integrity; actual-route containment; hours-independent queries; terminal count
validation and sparse-empty rules; save-before-success; resume without network;
tampered-response rejection; partial failures and batch stopping; bounded retries;
persistent long Retry-After cooldowns and honest reports on cooldown stops;
type/ID deduplication and whole-record version selection; full-task-set merging;
and same-version disagreements blocking complete output. Mock results are written
only to temporary test folders, never to the live extraction manifest.

Commands run offline before the live request:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p 'test_*.py' -q
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py init
```

The two final checks added after the live request validate only cooldown-reporting
and conflicting-version behavior; no additional live request was made.

## Exactly one cautious live test

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/resumable_osm.py run --task r00c00-police --max-tasks 1 --attempts 1
```

Endpoint: `https://overpass-api.de/api/interpreter`.
Task bbox (south, west, north, east):
`[23.335059, 85.308481, 23.3575295, 85.3242405]`.
Request started at `2026-10-09T12:42:07.537772Z`.

**Result: failed with HTTP 504.** The error body reports an OSM3S dispatcher
timeout and says the server is probably too busy. No retry or endpoint switch
was attempted. The other 23 tasks were not requested. No original large query
was repeated, no routing endpoint was called and no API keys were accessed.

Manifest: `tiled_runs/phase4b_20261009_2x2/manifest.json`.
Status: **1 failed task, 23 pending tasks, 0 successful tasks**.
Features acquired: **0**; this is failed acquisition, not evidence of zero facilities.
Raw error evidence:
`tiled_runs/phase4b_20261009_2x2/tasks/r00c00-police/20261009T124207_537772Z/http_error.txt`.
The query and request provenance are in the same attempt folder.

Partial output:
`tiled_runs/phase4b_20261009_2x2/partial/20261009T124214_266860Z/`.
The current run report explicitly distinguishes requested geographic containment
from incomplete acquisition. Future invocations honor the persisted cooldown;
the failed task can be resumed later without discarding its evidence.

No full extraction was launched. Resume/complete commands are documented in
`RESUMABLE_EXTRACTION_README.md` for later use. Earlier snapshots, scripts,
reports and failure evidence were preserved. No backend/frontend/ML edits,
safety calculations, commit or push.
