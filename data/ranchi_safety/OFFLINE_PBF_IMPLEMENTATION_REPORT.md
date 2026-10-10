# Phase 4B offline extractor implementation and validation

Date: 2026-10-09. **Ready for a controlled first run on an approved local regional PBF, with the limits below.** No regional OSM PBF was downloaded or extracted during this stage. No changes were made to the backend environment, routing API, frontend, ML code or API keys. Existing Overpass scripts, data, manifests and reports are retained. No commit or push was made.

## Created files

| File/directory | Purpose |
|---|---|
| `offline_pbf_extract.py` | Offline source indexing, geometric selection, reference closure, PBF/GeoJSON/JSONL output, quality report and stage resume |
| `.pbf_venv/` | Isolated Python 3.11.9 environment; osmium 4.3.1, Shapely 2.1.2, pyproj 3.7.2 |
| `offline_pbf_requirements.txt` | Direct dependency pins |
| `offline_pbf_requirements.lock.txt` | Installed direct/transitive package versions |
| `test_offline_pbf_extract.py` | 29 new synthetic offline tests |
| `run_offline_pbf_tests.py` | Runs all local regression suites and retains evidence plus a labeled synthetic example |
| `OFFLINE_PBF_README.md` | Commands, outputs, status meanings, memory/disk expectations and limitations |
| `offline_validation_runs/20261009T131440_842889Z/` | Final test log, JSON summary, synthetic input and example output |

The previous `OFFLINE_OSM_EXTRACTION_PLAN.md` remains a historical plan; the README describes the implemented behavior and updated storage estimate.

## Exact validation results

Final command:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\run_offline_pbf_tests.py
```

**82 tests ran in 11.8088875 seconds: 0 failures, 0 errors, 0 skipped.** This includes 29 new PBF extraction tests and 53 existing data-pipeline regression tests. Existing network behaviors were mocked by their offline tests; their printed timeout/server-error messages were simulated test cases, not new requests to Overpass or the backend.

Evidence: [summary.json](offline_validation_runs/20261009T131440_842889Z/summary.json), [tests.log](offline_validation_runs/20261009T131440_842889Z/tests.log).

New tests cover crossing ways with no vertex inside, entirely inside/outside and boundary-following ways, complete external-node retention, metadata/PBF round trips, unknown versus `lit=no`, businesses without hours, typed-ID collisions and category overlaps, enclosing/split multipolygons, holes, broken rings, missing nodes/members, nested relations, unsupported nested multipolygons, cycles/depth exhaustion, duplicates/conflicts, invalid coordinates, degenerate ways, potential facility duplicates, interrupted indexing/selection/export, successful resume/idempotence, missing indexes, input/checksum changes, changed output artifacts, existing-folder preservation, empty sources and truncated PBFs.

An early truncated-file test exposed a native Windows handle-lifetime problem. The final implementation checks PBF block framing before native decoding; the final truncated-file test passes and leaves a failed manifest rather than a complete result.

The retained **synthetic-only** example contains two analysis features and two support nodes. These are invented fixtures, not Ranchi records. The resulting small PBF was reread and compared to the input records. All three real saved walking-route centerlines and 100 m buffers were remeasured against the saved bbox and passed full containment (100% to displayed precision). Geographic containment says nothing about how many real-world features are mapped.

## Readiness and remaining limitations

- The extractor has not processed the 247 MB Eastern Zone file. Regional throughput, peak memory, final index size and real-world relation failure rates remain unverified.
- SQLite stores all source records and metadata on disk. This favors reproducibility and full reference recovery but uses more space than a coordinate-only index. Initially reserve **10–20 GB**, monitor growth, and allow more if needed. The estimate is not a hard upper bound.
- The default SQLite cache is **64 MiB**; native I/O uses one worker and a two-item queue. A planning memory budget is **0.5–1.5 GB**, with roughly **2 GB free RAM** recommended before starting. No hard process memory cap or regional benchmark is claimed.
- Multipolygon outer/inner way members and split rings are supported. Nested multipolygon relation members and unusual roles are reported as unsupported. Generic nested relations preserve member geometry and roles without inventing area semantics. Per-feature object/depth limits can mark complex candidates partial.
- Any unresolved relevant candidate, even one whose location cannot be established, makes the run partial. Valid features remain available in a separately labeled partial output; it is never a complete regional inventory.
- Resume is stage-level. Interrupted indexing starts over; completed indexing is reused for interrupted later stages. A hard kill can leave a lock requiring manual verification that no process is active. The private SQLite index must not be edited.
- Source URL provenance is supplied by the operator. Provider geographic coverage was checked during the earlier investigation, but this extractor does not authenticate downloads or fetch provider metadata. Preserve the approved source's download evidence and checksum.
- Public-source metadata omissions, missing tags and incomplete real-world mapping remain unknowns. Facility-duplicate hints are conservative and never merge records automatically.

## Command after download approval

After the approved PBF has been downloaded and verified at the path below, run from `D:\shepath`:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\offline_pbf_extract.py --input data\ranchi_safety\pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf --output data\ranchi_safety\offline_runs\eastern_261008_ranchi_v1 --source-url https://download.geofabrik.de/asia/india/eastern-zone-261008.osm.pbf --cache-mb 64
```

Add `--resume` to that same command after an interruption. Substitute a verified newer dated filename/URL only if that is the snapshot approved for download. The command performs local extraction only. A new download remains subject to the user's approval requirement.
