# SHEPATH route-coverage verification

Experiment time (UTC): 2026-10-08T14:01:12.341794+00:00
Analysis mode: `offline_reanalysis`. Offline replay retains the original real retrieval timestamp.
Request: Albert Ekka Chowk, Ranchi → Doranda, Ranchi; `travelMode=walk`.
Saved OSM boundary (south, west, north, east): **[23.35, 85.31, 23.38, 85.34]**.
OSM snapshot: `outputs\20261008T133610_076939Z`, base timestamp
`2026-10-08T13:33:00Z`; raw SHA-256
`010156f527f69ca1fee7897349459bc878d9bfd27e7c8a43361ab6dd1cbe1d11`.
Run artifacts: `route_coverage_runs\20261008T140112_006152Z`.
This route retrieval is a separate artifact from the older OSM extraction.

## Actual returned routes

Real routes returned: **3**. Retrieved at **2026-10-08T13:59:45.189759+00:00**.
Endpoint: `http://127.0.0.1:8000/route`. Coordinate order in `routes.json` is
the backend's **[latitude, longitude]**, not GeoJSON order.

| Route ID | API distance (m) | API duration (s) | Measured polyline (m) | Length inside (%) | Length outside (%) | Buffer area inside (%) | Buffer area outside (%) | Buffer fully covered | Geographic extent adequate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| heigit-foot-walking-route-1 | 5348.20 | 3850.60 | 5336.77 | 54.1863% | 45.8137% | 54.4067% | 45.5933% | no | no |
| heigit-foot-walking-route-2 | 5257.20 | 3785.10 | 5245.25 | 56.6007% | 43.3993% | 56.3355% | 43.6645% | no | no |
| heigit-foot-walking-route-3 | 6607.60 | 4757.40 | 6596.84 | 63.9492% | 36.0508% | 60.7716% | 39.2284% | no | no |

## Uncovered areas and adequacy

* **heigit-foot-walking-route-1**: 2444.97 m of polyline outside; 473727.68 m² of the 100 m buffer outside. Missing boundary sides: south. Missing-buffer bounds [west, south, east, north]: [85.31260211383153, 23.335603048961037, 85.3192155958333, 23.350000000032196].
  Returned endpoints [latitude, longitude]: [23.36989, 85.325061] → [23.336929, 85.317833]. These are backend-resolved locations, not independently verified place coordinates.
* **heigit-foot-walking-route-2**: 2276.40 m of polyline outside; 452724.70 m² of the 100 m buffer outside. Missing boundary sides: south. Missing-buffer bounds [west, south, east, north]: [85.31685515916922, 23.335943057166624, 85.3276879547364, 23.350000000045892].
  Returned endpoints [latitude, longitude]: [23.36989, 85.325061] → [23.336929, 85.317833]. These are backend-resolved locations, not independently verified place coordinates.
* **heigit-foot-walking-route-3**: 2378.22 m of polyline outside; 495009.60 m² of the 100 m buffer outside. Missing boundary sides: south, west. Missing-buffer bounds [west, south, east, north]: [85.30907501196218, 23.335603048961037, 85.31881084546177, 23.365079756666958].
  Returned endpoints [latitude, longitude]: [23.36989, 85.325061] → [23.336929, 85.317833]. These are backend-resolved locations, not independently verified place coordinates.

**The existing pilot extent is insufficient for full-route feature analysis** for routes whose buffers are not fully covered.

`uncovered_areas.geojson` contains actual out-of-box centerline pieces and uncovered
buffer polygons, with route IDs. `coverage_results.json` retains precise lengths,
areas and bounds, plus a suggested future corridor envelope. These are areas to
review for a future extraction, not a changed pilot boundary. No further OSM
download was performed. Incidental OSM ways extending beyond the box do not
establish systematic feature coverage there. In-box geometry does not establish
complete or reliable OSM tags; the DATA_COVERAGE_REPORT limitations still apply.

## Method and precision

The boundary comes directly from the successful saved extraction metadata.
Each returned segment is densified by linear longitude/latitude interpolation
at approximately ≤25 m spacing, then geometrically intersected with
the WGS84 bbox using Shapely. Interior **and boundary-following** portions count
as covered. Pyproj's WGS84 ellipsoid measures the clipped polyline lengths.
Segment-wise calculation preserves traversed distance on repeated edges; it
does not union away backtracking. Isolated boundary touches have zero length.
Percentages use measured geometry, not the API distance, which is preserved
separately and can differ because of provider geometry/generalization.

The **100 metre** buffer is a round-capped, round-joined union corridor
in **WGS84 / UTM zone 45N (EPSG:32645)**. Both polyline and geographic-box edges
are densified before projection. Buffer-area coverage is the intersection area
divided by total buffer area; it is not route-length coverage. Full coverage uses
the polygon `covers` predicate, not rounded percentages. Boundary-following
centerlines can be 100% covered while their buffers are only partially covered.
Circular arcs use 64 segments per quadrant (polygon approximation);
UTM distances/areas have small local scale distortion and are not survey precision.
Near-boundary millimetre differences are subject to projection/densification and
floating-point tolerances. The method is restricted to the Ranchi region.

Library versions: Shapely 2.1.2; pyproj 3.7.2.
Offline tests cover inside/outside/crossing/boundary-following lines, buffer
containment and partial area, repeated traversal, invalid schemas and failure
handling. Reproduction and dependency installation: `ROUTE_COVERAGE_README.md`.

Method references: [Shapely geometry operations](https://shapely.readthedocs.io/en/stable/manual.html),
[pyproj ellipsoidal lengths](https://pyproj4.github.io/pyproj/stable/api/geod.html),
[pyproj coordinate transforms](https://pyproj4.github.io/pyproj/stable/api/transformer.html).
OSM pilot attribution: © OpenStreetMap contributors, ODbL 1.0,
https://www.openstreetmap.org/copyright. Route provenance is the local SHEPATH
API response; OSM-snapshot attribution is not substituted for routing provenance.

No safety score, safety classification, ranking or ML result was produced.
Backend, routing API and frontend code were not changed; no commit or push.
