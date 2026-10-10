# Post-extraction verification and 100-metre route feature analysis

Checked 2026-10-09T16:50:55.619406+00:00. **All implemented integrity and geographic checks passed.** Ready for an explainable route-feature prototype, subject to sparse tags and duplicate review. No safety scores or safety conclusions are supported by these results.

Source OSM snapshot: 2026-10-08T20:21:06Z. Pilot bbox [south, west, north, east]: [23.335059, 85.308481, 23.38, 85.34].

## Verification

Verified 6 artifact hashes, the regional source hash, saved boundary/route hashes and extractor version hash. Parsed the small exported PBF and compared all 21,591 typed objects, tags, metadata and references with JSONL. Rebuilt every feature geometry from references and compared it to GeoJSON. Category counts and lighting/sidewalk/opening-hours completeness match the manifest. Issues log is empty; typed IDs are unique and references are closed.

There are 2,720 analysis features and 18,871 geometry-support objects. 213 feature geometries extend beyond the box but intersect it, as expected from complete crossing-way preservation. All three real saved route centerlines and their full 100 m buffers remain inside the pilot (100% to displayed precision). The regional SQLite index was not rescanned and extraction was not rerun.

## Pilot inventory

| Category | Nodes | Ways | Relations | Total |
|---|---:|---:|---:|---:|
| roads_and_pedestrian_ways | 0 | 2278 | 0 | 2278 |
| pedestrian_infrastructure | 10 | 105 | 0 | 115 |
| ways_with_lit_tag | 0 | 44 | 0 | 44 |
| street_lamps | 0 | 0 | 0 | 0 |
| police_stations | 4 | 3 | 0 | 7 |
| healthcare_facilities | 69 | 9 | 0 | 78 |
| hospitals | 34 | 8 | 0 | 42 |
| pharmacies | 5 | 0 | 0 | 5 |
| shops_and_businesses | 265 | 86 | 0 | 351 |
| businesses_with_opening_hours | 9 | 7 | 0 | 16 |

Road lighting: 44/2278 recorded (98.07% absent); values {'<absent>': 2234, 'yes': 40, 'no': 4}. Sidewalk keys: 44/2278 (98.07% absent). Nonblank business opening hours: 16/351 (95.44% absent).

## Features intersecting each route buffer

Route IDs are heigit-foot-walking-route-1, -2 and -3. Counts below use complete geometry intersection with a 100 m corridor in EPSG:32645 (UTM 45N). Coordinates from the saved routes are converted from latitude/longitude to longitude/latitude, densified, then projected. Features touching the corridor boundary count. Each typed OSM ID counts once per route; category and route memberships overlap. Counts across categories or routes must not be summed into a unique inventory. Geometry-support objects are excluded.

| Metric | Route 1 | Route 2 | Route 3 |
|---|---:|---:|---:|
| Backend walking distance (m) | 5348.2 | 5257.2 | 6607.6 |
| Unique corridor features | 242 | 301 | 336 |
| roads_and_pedestrian_ways | 219 | 239 | 306 |
| pedestrian_infrastructure | 11 | 11 | 16 |
| ways_with_lit_tag | 7 | 7 | 12 |
| street_lamps | 0 | 0 | 0 |
| police_stations | 0 | 1 | 0 |
| healthcare_facilities | 4 | 9 | 6 |
| hospitals | 1 | 2 | 1 |
| pharmacies | 1 | 3 | 1 |
| shops_and_businesses | 19 | 54 | 23 |
| businesses_with_opening_hours | 1 | 0 | 1 |
| Lighting tags absent (%) | 96.80 | 97.07 | 96.08 |
| Sidewalk tags absent (%) | 96.80 | 97.07 | 96.41 |
| Business hours absent/blank (%) | 94.74 | 100.00 | 95.65 |
| Recorded road lit=yes | 7 | 6 | 12 |
| Recorded road lit=no | 0 | 1 | 0 |
| Road line length inside corridor (m) | 23134.5 | 25920.9 | 31321.9 |
| Of that, line length with any lit tag (m) | 526.1 | 827.0 | 1659.7 |
| Of that, line length with sidewalk keys (m) | 526.1 | 827.0 | 1445.9 |

Road-length figures sum clipped OSM way segments, not the walked route length. Nearby parallel/cross streets are included; overlapping geometries can contribute separately. Polygonal pedestrian areas have no centerline length in these figures.

## Route length within 100 m of mapped features

This second measure intersects the actual route polyline with the union of 100 m buffers around each category’s feature geometries. Overlap is counted once. It describes mapped proximity along the route, not which OSM street the user walks, actual lighting of that street, access to a facility entrance, operating status, service capacity or real-world completeness.

| Category proximity | Route 1 (%) | Route 2 (%) | Route 3 (%) |
|---|---:|---:|---:|
| roads_and_pedestrian_ways | 100.00 | 100.00 | 100.00 |
| ways_with_lit_tag | 14.14 | 16.05 | 23.34 |
| shops_and_businesses | 17.14 | 50.21 | 18.44 |
| healthcare_facilities | 5.98 | 18.62 | 9.83 |
| police_stations | 0.00 | 2.67 | 0.00 |

## Potential duplicates

No duplicate typed OSM IDs were found. Four existing same-name/category proximity hints were rechecked; no objects were merged. These hints use representative points within 30 m and can miss unnamed or differently named node/polygon duplicates. Similar names near each other can also represent distinct facilities.

| Pair | Recorded name | Separation (m) | Route buffers containing either record |
|---|---|---:|---|
| node/2426783543 / node/4245892677 | Bharat Bakery | 28.82 | None |
| node/2910379109 / node/2910383874 | State Bank of India | 28.92 | None |
| node/6235433846 / node/9289123731 | aushdhalay medical store | 0.42 | None |
| way/516914807 / way/1360582441 | Tiwari Petrol Pump | 11.98 | 2 |

## Limits and next step

- Missing lit/sidewalk tags mean unknown mapping information. Explicit lit=no is a recorded tag, not a safety assessment. Zero lamps means no mapped lamp records in this extraction scope; it does not mean no physical lamps exist.
- Opening hours are sparse. A business record does not prove it is currently open. Facilities may have moved or changed since the snapshot; public OSM metadata has known omissions.
- Highway ways include differing access and road classes. Corridor membership is not walking accessibility or a street match. Add validated route-to-road matching, explicit denominators and unknown flags before attributing street properties to a walked segment.
- Geographic containment and valid output geometry establish a usable local dataset, not exhaustive OSM selection correctness or real-world feature completeness. This verifies exported data; it does not independently reselect all 44 million regional objects.
- Ready for route-level feature engineering based on explainable mapped proximity/counts, road geometry and explicit tag-availability measures. Review duplicate hints first for facility-count comparisons. Lighting and opening hours are too sparse for complete route-wide claims. Do not infer safety from presence, absence or missingness.

## Automated validation results

**93 tests passed in 12.6991 seconds: 0 failures, 0 errors, 0 skipped.** This includes 11 new post-extraction tests and all 82 existing offline tests. Evidence: [test summary](offline_validation_runs/20261009T165040_065837Z/summary.json) and [full test log](offline_validation_runs/20261009T165040_065837Z/tests.log).

New tests exercise inside/outside/boundary-touching features, crossing geometry without interior vertices, clipped road length, overlapping proximity buffers, repeated route traversal, enclosing polygons, empty denominators, missing lighting versus explicit `no`, typed-ID uniqueness, corrupt artifact rejection, missing references and invalid coordinate rejection. Existing network-error messages in the test console are mocked failure cases; no new routing or Overpass requests were made.

No implemented integrity or analysis checks failed. Remaining limitations are sparse mapping attributes, potential semantic duplicates and the absence of validated route-to-road matching, rather than missing or unreadable extraction outputs.

## Reproduce and evidence

Run from D:\shepath:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\verify_post_extraction.py
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p test_post_extraction.py -v
```

Detailed measurements and exact per-route feature IDs: [20261009T165055_620406Z/results.json](post_verification_runs/20261009T165055_620406Z/results.json). All source extraction artifacts remain unchanged. No additional routing/Overpass requests were made. © OpenStreetMap contributors, ODbL 1.0; source provider Geofabrik.
