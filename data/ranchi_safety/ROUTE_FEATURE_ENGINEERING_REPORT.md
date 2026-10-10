# Phase 5A — Route-level safety-context features

**Ready for an evidence-aware comparison of mapped context. Actual street attributes remain unverified.** This dataset contains no personal-safety scores, safety labels, operating-status guesses or pedestrian-activity estimates.

## Method and outputs

The three previously saved HeiGIT walking routes are processed independently. The verified pilot PBF/JSONL/GeoJSON artifacts are rechecked locally; no regional extraction or network request occurs. All route centerlines and complete 100 m buffers fit the existing pilot boundary. Full OSM geometry intersections include crossing features and buffer-edge touches. Each typed OSM ID counts once per route, while categories and routes can overlap.

Output folder: `route_feature_runs/20261009T170001_897709Z`. `route_features.json` is the canonical dataset; individual route JSON files contain the same per-route records. `feature_evidence.json` preserves original feature IDs, tags, versions, edit timestamps and geometries for audit. `duplicate_review.json` records the four decisions and geometry/tag comparisons. `run_manifest.json` hashes all outputs. No input artifacts are overwritten.

Measured geodesic polyline length is distinguished from the backend distance and UTM projected length. Proximity percentages use projected traversed route length: the route is intersected with the union of 100 m buffers around matching features. Overlap counts once, repeated travel along a segment counts each traversal. Corridor roads can be parallel or crossing roads, not the actual walked street.

## Route comparison

| Metric | Route 1 | Route 2 | Route 3 |
|---|---:|---:|---:|
| Geodesic route polyline length (m) | 5336.8 | 5245.3 | 6596.8 |
| Backend distance (m) | 5348.2 | 5257.2 | 6607.6 |
| roads_and_pedestrian_ways — nearby records | 219 | 239 | 306 |
| roads_and_pedestrian_ways — route proximity (%) | 100.0 | 100.0 | 100.0 |
| pedestrian_infrastructure — nearby records | 11 | 11 | 16 |
| pedestrian_infrastructure — route proximity (%) | 21.74 | 18.71 | 29.4 |
| shops_and_businesses — nearby records | 19 | 54 | 23 |
| shops_and_businesses — route proximity (%) | 17.14 | 50.21 | 18.44 |
| healthcare_facilities — nearby records | 4 | 9 | 6 |
| healthcare_facilities — route proximity (%) | 5.98 | 18.62 | 9.83 |
| hospitals — nearby records | 1 | 2 | 1 |
| hospitals — route proximity (%) | 4.16 | 7.66 | 3.36 |
| pharmacies — nearby records | 1 | 3 | 1 |
| pharmacies — route proximity (%) | 1.59 | 8.5 | 1.29 |
| police_stations — nearby records | 0 | 1 | 0 |
| police_stations — route proximity (%) | 0.0 | 2.67 | 0.0 |
| street_lamps — nearby records | 0 | 0 | 0 |
| street_lamps — route proximity (%) | 0.0 | 0.0 | 0.0 |
| Nearby road lit=yes count | 7 | 6 | 12 |
| Route near lit=yes roads (%) | 14.14 | 15.94 | 23.34 |
| Nearby road lit=no count | 0 | 1 | 0 |
| Route near lit=no roads (%) | 0.0 | 3.94 | 0.0 |
| Nearby road lit=other_recorded count | 0 | 0 | 0 |
| Route near lit=other_recorded roads (%) | 0.0 | 0.0 | 0.0 |
| Nearby road lit=unknown count | 212 | 232 | 294 |
| Route near lit=unknown roads (%) | 100.0 | 100.0 | 100.0 |
| Usable sidewalk-family tags / nearby roads | 7/219 | 7/239 | 11/306 |
| Unknown sidewalk-family tags / nearby roads | 212 | 232 | 295 |
| Nonblank opening hours / nearby businesses | 1/19 | 0/54 | 1/23 |
| Business count if flagged pairs each represent one entity | 19 | 53 | 23 |

The lit=yes/no/other/unknown object counts partition nearby roads, but their route-proximity percentages do not partition the route: a point can be near differently tagged roads. Unknown lighting includes absent/blank and literal unknown tags. Other recorded values are preserved without treating them as yes or no. Sidewalk-family availability includes directional/detail keys and does not prove sidewalk existence or continuity. Exact denominators, units, raw values and IDs are in JSON.

## Duplicate inspection and count sensitivity

- **node/2426783543 + node/4245892677**: Same bakery name/category 28.82 m apart; one has cuisine detail and multilingual names differ. Neither has a unique shared business identifier. Could be separate entrances, premises or duplicate mapping; retain both. Geometry minimum distance 28.82 m; overlap area 0.00 m². No merge.
- **node/2910379109 + node/2910383874**: Same bank brand/name 28.92 m apart. One explicitly says branch=administration office; the other has a website. A shared brand is not a unique branch identity. May represent different functions; retain both. Geometry minimum distance 28.92 m; overlap area 0.00 m². No merge.
- **node/6235433846 + node/9289123731**: Near-coincident medical-store names (0.42 m), but hospital/general-clinic tags conflict with pharmacy tags and edit dates differ. Likely identity/classification ambiguity needing local or edit-history validation. Do not merge or relabel either record. Geometry minimum distance 0.42 m; overlap area 0.00 m². No merge.
- **way/516914807 + way/1360582441**: Same fuel-station name and overlapping polygons of different size, with 2021 versus 2025 edits and different address/operator detail. Plausible duplicate or site/component representation; no verified common entity identifier. Retain both and publish conditional business count. Geometry minimum distance 0.00 m; overlap area 102.10 m². No merge.

Only the fuel-station pair affects these buffers. Route 2 retains 54 business OSM records; 53 is a conditional same-entity scenario, not an asserted physical-business count or a statistical confidence interval. Other pairs have no selected members along these three corridors. Geometry unions prevent additive proximity double-counting, but uncertain facility extents still affect proximity. Unflagged semantic duplicates may remain.

## Evidence confidence and availability

Confidence indicators are categorical descriptions of evidence, never probabilities of personal safety: source integrity is verified, corridor extent is complete, record-based geometry is reproducible, real-world OSM completeness is unknown, and actual street attribution is unverified. Lighting/sidewalk/hour availability is reported as absent, partial or complete only relative to selected records. Each flag has the corresponding count denominator; zero matching landmarks means zero extracted records, not verified physical absence.

`verified_on_walked_street.osm_ids` and actual street tag coverage are null with status `not_performed`. No automatic nearest-road match is presented as verified. Business current-open status and pedestrian activity remain unavailable. Recorded opening-hours strings are retained, but syntax, holidays and current operation are not evaluated.

## What the prototype can support

- Compare measured route length, mapped nearby business/healthcare/police/pedestrian context, proximity coverage and explicit missingness, with OSM IDs available for inspection.
- Display raw facility counts alongside duplicate sensitivity and unknown-data indicators. Do not use unknown tags as a negative score or rank routes by personal safety.
- Before attaching lighting/sidewalk tags to the walked street, validate route-to-road matching using geometry, topology and pedestrian access. Street-level attributes are currently unverified for all three routes.
- Obtain field or other validated evidence for lighting condition/continuity, pedestrian activity, facility access and current business operation. Lighting, sidewalk and hours tags are too sparse for comprehensive street-level comparisons.
- This is a single OSM snapshot and three overlapping example routes, not a representative training dataset. Resolve important facility identity/classification ambiguities before counting physical establishments.

## Validation results

**112 offline tests passed in 21.2743 seconds: 0 failures, 0 errors, 0 skipped.** This includes 19 new feature-engineering tests and all 93 existing tests. See the [test summary](offline_validation_runs/20261009T170003_321407Z/summary.json) and [full test log](offline_validation_runs/20261009T170003_321407Z/tests.log).

The new tests cover feature counts, missing/blank/explicit negative tags, directional sidewalk fields, opening-hours non-interpretation, full geometry and boundary intersection, polygon holes, proximity overlap, repeated traversal, duplicate sensitivity including connected pairs, independent route calculations, null denominators, invalid geometry, and absence of fabricated street matches. The integration test rebuilds all three real-route datasets twice and checks byte-for-byte canonical equality. Network connection attempts are forbidden in that integration test. Existing retry/error console messages are mocked offline test cases.

The generated [route dataset](route_feature_runs/20261009T170001_897709Z/route_features.json), [duplicate review](route_feature_runs/20261009T170001_897709Z/duplicate_review.json), and [source-feature evidence](route_feature_runs/20261009T170001_897709Z/feature_evidence.json) contain no model output or personal-safety score. The tested source extraction and its prior verification report are preserved.

## Reproduce

From `D:\shepath`:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\build_route_features.py
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p test_route_features.py -v
```

Each run creates a new timestamped folder. Canonical feature JSON excludes wall-clock run timestamps; the run manifest stores creation time separately. Identical input hashes, code, parameters and package versions yield identical feature bytes. The JSON has explicit metric denominators and evidence status fields; counts across categories must not be summed. © OpenStreetMap contributors, ODbL 1.0; downloaded source provider Geofabrik.
