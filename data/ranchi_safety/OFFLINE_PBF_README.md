# Offline PBF extraction — Phase 4B

Implemented in `offline_pbf_extract.py`. The isolated `.pbf_venv` environment is under this folder. The extractor makes no network calls. Existing Overpass pipelines and their data are preserved. No regional PBF has been downloaded during implementation.

## Run after regional download approval

Run from `D:\shepath`. The input must already be downloaded, verified and renamed from `.part` to its finished filename. This command extracts a local file; it does not download it:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\offline_pbf_extract.py --input data\ranchi_safety\pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf --output data\ranchi_safety\offline_runs\eastern_261008_ranchi_v1 --source-url https://download.geofabrik.de/asia/india/eastern-zone-261008.osm.pbf --cache-mb 64
```

Use the actual verified dated source filename/URL if a different snapshot is approved. Do not guess the replacement URL. The previously verified file is about 247 MB compressed; see `OFFLINE_OSM_EXTRACTION_PLAN.md` for download approval and source evidence. The source URL is a user-supplied provenance label, not independently checked by this offline tool. Optional `--expected-sha256 HASH` checks a previously recorded checksum; a locally generated checksum establishes identity, not provider authenticity.

Use a new output folder for a new snapshot or changed extraction code. For an interrupted run, repeat the same command with `--resume`. Source, boundary, saved routes, code, package versions and geometry limits must match. Completed runs are returned only after their published artifact hashes pass. No completed output is overwritten. The SQLite checkpoint must be present and pass integrity/count checks. The index is private working state and must not be edited manually.

Stages are index, selection/reference closure, and export. A completed index is reused. An interrupted index is rebuilt from the beginning; an interrupted selection is recomputed. Export retries create new timestamped attempt folders and retain prior failed files. This is stage-level resume, not byte-offset PBF resume. A hard process kill may leave `.lock`: verify that the old process is stopped before manually removing that run's lock file. Ordinary exceptions and Ctrl+C release it.

Exit codes: **0** completed processing; **2** partial result with unresolved data; **1** failed execution. A complete processing result is not evidence of complete real-world OSM mapping or proof that an arbitrary source covers Ranchi.

## Boundary, geometry and scope

The script reads the validated bbox from `expanded_outputs/20261008T142703_316466Z/boundary_plan.json`; no alternate pilot bbox flag is exposed. It is `[23.335059, 85.308481, 23.380000, 85.340000]` in south/west/north/east order. GeoJSON coordinates are longitude/latitude. All three existing saved walking routes are measured against the same box and their 100 m buffers are rechecked without calling the routing API.

Nodes, ways and relations are indexed on disk under `(type, ID)`. All relevant candidates are evaluated geometrically against the closed rectangle. Boundary touches count as intersection. Ways crossing the box with no interior vertex are included. Selected ways retain every original node reference, outside coordinates and tag; the exported PBF is not geometrically clipped.

Category definitions match the existing expanded extraction's medical/business sets, with an additional explicit recorded-highway-lighting category. They cover highway ways; pedestrian infrastructure, crossing/kerb/barrier/sidewalk tags; lamps; police; healthcare; pharmacy; shop/office/craft; food/bank/fuel/car services/marketplace amenities; and hotel/motel/hostel/guest-house tourism. This is a documented commercial scope, not every possible business tag. Opening hours are never required for selection. Missing `lit`, explicit `lit=no` and other values remain distinct.

Closed non-highway facility/business ways are interpreted as areas unless `area=no`; `area=yes` also enables area interpretation. Other ways are lines. Multipolygons support outer/inner way members, including rings split across ways and enclosing polygons. Holes are subtracted. Broken rings, missing members, invalid coordinates, degenerate geometry and exhausted limits produce issue records and a partial run. Nested multipolygon relation members or nonstandard roles are explicitly unsupported and produce partial status. Generic relations are represented as collections of complete member geometries; their roles remain in the original records and are not assigned invented area semantics. Cycles are rejected.

Geometry work is limited to 100,000 visited objects per candidate and a reference depth of 12 by default (`--max-members`, `--max-depth`). Very complex valid relations can therefore require a reviewed new run with different limits. A malformed relevant candidate anywhere in the input region conservatively marks the run partial even when its location cannot be established. Failed candidates are omitted from usable features and identified in issues; no coordinates are fabricated.

## Outputs and validation

Each run contains `manifest.json`, `index.sqlite`, and timestamped output folders. Known incomplete data is exported under `partial_*`; successful export attempts use `attempt_*`. Only the manifest's final status and artifact list establish completion. Files in failed attempts are diagnostic evidence.

- `pilot.osm.pbf`: unique selected elements and complete supporting references. Original objects are streamed directly from the input, preserving all available tags and metadata. The derived PBF's global header is newly generated; original source header fields are retained in the manifest.
- `objects.jsonl`: original typed IDs, coordinates/references, tags and exposed metadata with `extraction_role` set to `feature` or `geometry_support`.
- `features.geojson`: analysis features only, preserving full geometry, tags and category memberships.
- `issues.jsonl`: missing/unsupported geometry and conflicting duplicate evidence. Conflicting records are never merged into invented tags; the first is retained and status is partial. The source hash identifies the original full evidence.
- `potential_duplicates.jsonl`: review hints for same normalized names, shared facility/business category and representative points within 30 m. They are retained as separate OSM objects. Unnamed/differently named duplicate facilities can be missed.
- `REPORT.md`: category counts, tag completeness, geometry limitations and saved route/buffer measurements.

The manifest records source size/SHA-256, source URL label, source PBF header fields, retrieval-independent processing timestamps, code/boundary/route hashes, package versions, stages, attempts, output hashes, unique and overlapping category counts, geometry-support counts, lighting values, sidewalk tag presence, nonblank opening-hours completeness, and attribution. Original object edit timestamps are distinct from the source database timestamp and local processing time.

The PBF round trip compares every exported object's exposed metadata, tags and references against the SQLite source record and verifies counts. All selected geometry must be valid and all selected dependencies resolved. Typed IDs prevent node/way ID collisions. PBF framing checks catch truncation; PyOsmium parses the source fully. Zero source records are rejected. Source bytes are hashed again after processing to detect changes during the run.

Public Geofabrik PBFs omit some personal metadata. PyOsmium exposes absent numeric metadata as zero and strings as empty: these defaults do not prove that the original source supplied such fields. Retaining the source PBF is necessary for exact source evidence. `complete` concerns this declared extraction scope; geographic coverage, tag completeness and actual facility existence remain different questions. An opening-hours record does not establish current operation. No safety scores are generated.

## Resources

The regional file is streamed. SQLite retains full serialized records, rather than only coordinates, so its disk footprint can exceed the earlier plan's coordinate-only estimate. Reserve **10–20 GB free as a conservative initial budget**, monitor growth, and allow more if the real index requires it. The 247 MB PBF does not predict the uncompressed record/index size. The regional workload has not been benchmarked.

Default SQLite page cache is approximately **64 MiB**; SQLite temporary storage is disk-backed and mmap is disabled. PyOsmium uses one I/O worker with a two-item queue; output is streamed. Memory scales with a bounded candidate's geometry, SQLite cache and native PBF/geometry buffers, not all regional records. A tentative working-memory budget is **0.5–1.5 GB**, not a measured guarantee or hard process cap. Close applications to free at least roughly 2 GB before a regional run. The prior laptop check found 7.65 GiB total RAM but only 0.91 GiB available. Runtime may be substantial because node lookups and source/validation scans favor bounded memory over speed.

Do not treat a synthetic benchmark as proof of regional performance. Disk exhaustion produces failed status; the tool does not automatically delete old snapshots or indexes.

## Offline tests and environment reproduction

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\run_offline_pbf_tests.py
```

The runner executes all `test_*.py` suites in this folder, redirects temporary files here, and saves timestamped logs and a summary under `offline_validation_runs/`. It retains an explicitly labeled synthetic example extraction. Every fixture record is invented test data; synthetic counts must never be presented as Ranchi observations. The existing regional source is not needed.

Run only the new extractor suite:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p test_offline_pbf_extract.py -v
```

For a future environment rebuild, create a new environment within this folder and install `offline_pbf_requirements.lock.txt`. The original backend interpreter was used only to create the isolated environment; backend packages were not installed or changed. The lock records all versions installed for this stage. Package installation requires network access but does not download OSM data.

Attribution: © OpenStreetMap contributors, ODbL 1.0; https://www.openstreetmap.org/copyright. Regional provider provenance belongs to the approved downloaded source.
