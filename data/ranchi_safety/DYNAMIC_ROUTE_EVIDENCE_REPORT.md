# Phase 5D — Stage 1: Dynamic Route-Level Geographic Evidence Engine

Implemented in `dynamic_route_evidence.py`, entirely inside `data/ranchi_safety/`.
This is reusable offline mapped-context analysis for new route geometries. It
does not compute safety scores, safety labels, predictions or route preferences.
The backend, frontend and saved-pilot comparison implementation are unchanged.

## Invocation from Python

From `D:\shepath`, use the existing local environment (Python 3.11, Shapely 2.1.2,
pyproj 3.7.2 and osmium 4.3.1). No download or installation is needed locally.

```python
import sys
sys.path.insert(0, r"D:\shepath\data\ranchi_safety")
from dynamic_route_evidence import PilotDataset, analyze_route

pilot = PilotDataset.load()  # Verify and project once at worker startup.
result = analyze_route(
    route_id="new-route-001",
    coordinates=[[23.355, 85.32], [23.36, 85.32]],  # latitude, longitude
    distance_metres=None,  # optional caller-reported metadata
    duration_seconds=None,
    buffer_metres=100,
    dataset=pilot,
)
if result["status"] == "available":
    print(result["route_context"]["categories"]["healthcare_facilities"])
else:
    print(result["coverage"]["reason"])  # route_context is null
```

`analyze_route(route_id, coordinates, distance_metres=None,
duration_seconds=None, buffer_metres=100, *, dataset=None)` returns the structured
dictionary described in [the output contract](DYNAMIC_ROUTE_EVIDENCE_SCHEMA.md).
`RouteEvidence` is the corresponding Python TypedDict. The result can be encoded
with `json.dumps(result, allow_nan=False)`. With no dataset argument, the first
call lazily loads a process-local cached snapshot; subsequent calls reuse it.
Explicit startup loading makes integrity failures and startup cost easier to handle.
Invalid arguments raise `ValueError`. Unsupported geographic extent returns an
explicit `coverage_unavailable` result with no analyzed counts or percentages.
Source corruption/missing files raise exceptions rather than empty evidence.

## Inputs inspected and reused

- Phase 5A: `build_route_features.py`, `route_feature_metrics.py`, saved feature
  artifacts and `ROUTE_FEATURE_ENGINEERING_REPORT.md`.
- Phase 5B: `compare_routes.py`, `route_comparison_engine.py`, the pinned comparison
  bundle and `ROUTE_COMPARISON_REPORT.md`.
- Geographic/data validation: `verify_route_coverage.py`, `verify_post_extraction.py`,
  `POST_EXTRACTION_VERIFICATION_REPORT.md`, the completed offline extraction manifest,
  boundary, GeoJSON, object JSONL, duplicate hints and saved route geometries.
- Backend route and pilot response models were read to confirm `[latitude, longitude]`,
  `distanceMeters`, `durationSeconds` and the fixed-journey applicability restriction.
  No API model or route handler was edited or called.

The engine reuses Phase 5A metric computation, geodesic densification, projection,
whole-geometry intersection, geometry reconstruction, tag classification, overlapping
buffer unions, repeated traversal measurement and conditional duplicate sensitivity.
The new loader does not require the three saved route IDs or saved route file.
Saved routes are used only in validation.

## Geographic support and numerical convention

The verified pilot bbox is `[23.335059, 85.308481, 23.38, 85.34]` in
`[south, west, north, east]` order. It is the extraction support boundary, not an
administrative definition of Ranchi. Original complete crossing-feature geometry
may extend outside this boundary; that does not extend supported route coverage.

The entire input polyline must be covered by the bbox. An endpoint-only check is
insufficient: intermediate excursions and crossing segments are checked too. Distant
routes return unavailable before projection or densification. Contained routes use
the Phase 5A linear longitude/latitude interpolation with at most 25 m segment spacing,
followed by EPSG:32645 projection. The analysis buffer uses round caps/joins and
64 segments per quadrant. All distances are projected metres except the explicitly
named geodesic polyline length. Supplied backend distance never replaces the geometry
denominator.

Full-buffer acceptance is stricter than the old nominal polygon check: the containment
buffer radius is `r / cos(pi/256) + 0.01` metres, and the densified projected pilot
boundary is eroded by 0.01 m. Inflation compensates for polygonal circular-arc
underapproximation, with a small conservative numerical margin. No area-percentage
threshold allows small outside slivers. At 100 m this can reject a route within
roughly 3 cm of the mathematical containment threshold; this is intentional.
This is a documented local projected geometry model, not surveyed ground accuracy
or an exact ellipsoidal offset. The nominal 100 m buffer remains the feature-analysis
buffer so Phase 5A measurements remain comparable. Rejected routes have
`route_context=null`; geographic uncertainty never becomes zero facilities.

## Identity and provenance

Route labels are metadata. Geometry identity is SHA-256 of UTF-8 compact JSON of
the ordered coordinate pairs after converting finite numbers to binary64 floats
and serializing each number with Python `float.hex()`. Signed zero is normalized
to positive zero. Latitude precedes longitude. There is no decimal rounding,
vertex sorting, duplicate removal or simplification. Integer and equivalent float
coordinates match; reversing, repeating, inserting or changing vertices changes
identity. This identifies the actual submitted sequence, not a topologically
equivalent path. The output retains that sequence for audit.

Evidence identity additionally hashes the analysis parameters, schema version,
source/content hashes, implementation hashes and package versions. Two different
routes with the same label cannot reuse each other's evidence. Renaming a route
or changing caller-reported distance/duration does not change the geometric evidence
identity. If caching entire responses in a future adapter, retain caller metadata
separately rather than treating this evidence identity as a full-response hash.

The source snapshot is **2026-10-08T20:21:06Z**, from Geofabrik/OpenStreetMap.
The loader pins extraction manifest SHA-256
`ae9d1e9134b276c4ca20297b02dacf38320e2ed98e001a4419788f310e9a1d0b`,
checks all six small artifact hashes and the boundary hash, and reconstructs the
2,720 feature geometries from the 21,591 exported original/support objects. It
checks metadata, tags, categories, reference closure and inventory agreement.
The small pilot PBF is hash-checked against the previously verified snapshot; it
does not need reparsing on each load. Regional source identity is inherited from
the pinned verified manifest, not independently rehashed during analysis.

Selected evidence includes complete original GeoJSON geometry and properties,
typed OSM IDs, version/edit metadata and raw tags. The source artifact hashes
identify the exact original reference records. Geometry is never replaced by
centroids. Attribution is © OpenStreetMap contributors, ODbL 1.0.

## Missingness, duplicate handling and coverage denominators

Each typed OSM ID is counted once; duplicate typed IDs fail validation. The four
previously reviewed ambiguous facility pairs remain separate. Existing conditional
same-entity counts are retained, with no claim that they count physical establishments.
Duplicate hints can miss unnamed or differently named duplicates. Proximity uses
unioned feature buffers, so overlapping facilities never multiply covered route
length. Repeated route traversal does multiply the traversed length and denominator.

Lighting retains `yes`, `no`, `other_recorded` and `unknown`. Sidewalk-family
availability preserves explicit `no`, directional and detail values without
asserting a continuous sidewalk. Opening-hours strings are retained verbatim,
including non-business facilities; business completeness retains its explicit
business-object denominator. No current-open status, schedule validity, accessibility
or pedestrian activity is inferred. Zero matching records means zero mapped
records in the verified selection, not absence in the real world. Empty object
denominators have null percentages. Missing data is never negative safety evidence.

Mapped proximity remains distinct from walked-street attribution. Parallel and
crossing roads can be nearby; actual street matching is `not_performed`. State and
category proximity percentages overlap and must not be summed. Phase 5A's clipped
road-length ratios sum OSM object lines, which can overlap. They remain explicitly
labeled for parity, and the new `nearby_road_geometry` field also reports unioned
unique clipped line length. Polygon boundaries are not road centerlines.

## Validation and reproduction

Run all relevant offline regression tests and regenerate the saved-route evidence:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\validate_dynamic_route_evidence.py
```

The runner blocks socket connections and writes only `dynamic_validation/`.
It includes dynamic, Phase 5A, Phase 5B, route-coverage and post-extraction tests.
Synthetic tests exercise valid new routes, each boundary edge and corners,
partially/entirely outside routes, crossing and intermediate excursions, buffer-only
exceedance, malformed/missing coordinates, route identity, empty categories,
duplicate IDs, ambiguous and overlapping facilities, repeated traversal,
incomplete lighting/sidewalk/hours, source tampering, output isolation, no saved-route
dependency and no per-analysis file reads. Existing geometry tests cover polygon
holes, crossing features and touches. Results and measurements are recorded in
[summary.json](dynamic_validation/summary.json), [tests.log](dynamic_validation/tests.log)
and three full per-route dynamic JSON files in that directory.

**Validation completed: 80 tests passed, 0 failures, 0 errors, 0 skipped.** This
includes 14 new dynamic-engine test methods. The existing simulated backend-failure
test prints a coverage-unverified message as expected; no backend was contacted.

All three saved routes were accepted by the stricter complete-buffer gate.
Exact nested comparisons found **no differences** in category counts/IDs/proximity,
lighting, sidewalk, existing opening-hours metrics, duplicate sensitivity,
nearby-evidence distances, projected length or geodesic length versus the
hash-verified Phase 5A artifact.

| Saved route | Roads | Pedestrian infrastructure | Businesses | Healthcare | Police | Warm analysis seconds |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 219 | 11 | 19 | 4 | 0 | 1.97 |
| 2 | 239 | 11 | 54 | 9 | 1 | 2.06 |
| 3 | 306 | 16 | 23 | 6 | 0 | 4.68 |

The deliberate schema additions are geometry/evidence identity, explicit coverage
status, inline source geometry, opening-hours values across all categories, and
unioned nearby road-line length. They do not alter Phase 5A measurements. For these
three routes the unioned road-line length equals the object-line sum to floating-point
precision (maximum difference about `3e-11` m); synthetic overlapping-road tests
demonstrate the meaningful distinction when linework actually overlaps. Route 2
still retains 54 business objects and a conditional count of 53 for the ambiguous
fuel-station pair. No establishments were silently merged. The Phase 5B regression
tests retain the existing saved preference outcomes.

## Memory and runtime measurements

The loader checks **7,603,531 bytes (7.25 MiB)** across the six exported artifacts,
plus small manifest/boundary/code files. It never opens the approximately 11 GB
regional index or 247 MB source PBF, and warm analysis performs no file reads.
Geometry projection is performed once per loaded dataset.

The validation run measured **9,637,321 bytes (9.19 MiB)** of retained Python-managed
allocations and **60,340,895 bytes (57.55 MiB)** peak during loading with `tracemalloc`.
The traced load took 14.89 seconds; instrumentation adds overhead. These numbers
exclude interpreter/import baseline and native GEOS/PROJ heaps, and are **not a
total worker memory ceiling**. A worker therefore needs more than the measured
57.55 MiB startup peak, plus native geometry/workspace and response allocations.
Per-request buffers and unions scale with route complexity and selected features;
concurrent requests add transient memory. Measure total process peak at the chosen
concurrency before setting deployment memory limits. Per-worker duplication can be
avoided only through a separately designed serving architecture, not by this module.

Observed uninstrumented saved-route analysis was 1.97–4.68 seconds on this machine.
This is suitable for an offline prototype, not evidence of interactive production
latency. Avoid loading/validating the dataset per request. A spatial index and
carefully keyed metric caches may be useful later, but are not necessary to read
only the small verified artifacts in this stage.

## Backend integration readiness and limits

The engine is suitable for a subsequent backend integration stage as an offline,
bounded pilot evidence service. It is not wired into an endpoint in this stage.
A future adapter needs to translate validation/source errors, retain the two
coverage states, load one snapshot per worker and run CPU-heavy analysis outside
the async event loop with bounded concurrency. Full provenance/geometry responses
can be sizeable; a presentation layer may expose references while retaining audit
artifacts. No production latency or concurrency guarantee is established here.

Input limits are 10,000 submitted vertices, 50,000 densified vertices and a buffer
in `(0, 1000]` metres. The initial/default analysis is 100 m. Large requests fail
explicitly rather than being simplified or truncated. The small fixed inventory
is scanned in memory; no regional SQLite index or regional PBF is opened. Startup
requires the local verified exports; a new pilot snapshot must be explicitly
verified and its manifest pin updated. A loaded instance stays on its snapshot
until reloaded; it is immutable by convention and internal attributes must not
be modified. Returned evidence is copied to prevent caller mutation of the cache.

Limitations remain the small pilot extent, one historical OSM snapshot, sparse
lighting/sidewalk/hours tags, uncertain facility identity and access, unverified
walked-street attribution, no live activity/operation observations and unknown
real-world mapping completeness. None of these observations supports a personal
safety judgment. No network request, paid API, regional extraction, commit or push
was performed.
