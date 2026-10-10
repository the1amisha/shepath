# Resumable Ranchi extraction status

Run: `tiled_runs\phase4b_20261009_2x2`; generated 2026-10-09T12:45:16.911188+00:00.
Endpoint pinned to `https://overpass-api.de/api/interpreter`. Requested bbox (south, west, north, east):
**[23.335059, 85.308481, 23.38, 85.34]**, verified against saved validated metadata (SHA-256
`2355a8d987680815a074c53c0f0763e7eabdb33a4ed8280e7bd0b8c9fd5dda41`). Grid: **2×2**;
planned tasks: **24**. Successful: **0**;
pending: **23**; failed: **1**.

Acquisition status: **PARTIAL / INCOMPLETE**.
Unique records from validated successful tasks: **0**.
Merged artifacts: `tiled_runs\phase4b_20261009_2x2\partial\20261009T124516_907173Z`. This is never claimed as a complete
Ranchi inventory. Category counts overlap and are not additive.

## Category acquisition coverage

| Request category | Successful tiles | Requested tiles | Successful-tile area % |
| --- | ---: | ---: | ---: |
| roads | 0 | 4 | 0.0000% |
| lighting | 0 | 4 | 0.0000% |
| police | 0 | 4 | 0.0000% |
| healthcare | 0 | 4 | 0.0000% |
| pharmacies | 0 | 4 | 0.0000% |
| businesses | 0 | 4 | 0.0000% |

Area % is geographic tile acquisition coverage, not mapped-feature completeness; whole crossing-way geometry does not expand verified sampled area.

## Unique feature counts from downloaded tasks only

* roads_and_pedestrian_ways: 0
* pedestrian_infrastructure: 0
* ways_with_lit_tag: 0
* street_lamps: 0
* police_stations: 0
* healthcare_facilities: 0
* hospitals: 0
* pharmacies: 0
* shops_and_businesses: 0
* businesses_with_opening_hours: 0

Categories with zero records may be unrequested or partially requested, not absent in the real world. Sparse successful zero-result tasks require a valid zero-count sentinel.

## Requested extent versus the three saved routes

| Route ID | Length inside % | 100 m buffer area inside % | Full buffer contained |
| --- | ---: | ---: | --- |
| heigit-foot-walking-route-1 | 100.0000 | 100.0000 | True |
| heigit-foot-walking-route-2 | 100.0000 | 100.0000 | True |
| heigit-foot-walking-route-3 | 100.0000 | 100.0000 | True |

All three saved route corridors fit the requested extent geometrically. Until every tile/category task validates, acquired feature coverage is incomplete and cannot support full-route comparisons across all categories.

## Failed tasks / rejected success artifacts

* r00c00-police: HTTP 504

## Quality and provenance limitations

Coordinates: {'checked_occurrences': 0, 'invalid': 0, 'outside_bbox': 0, 'records_without_coordinate_points': 0, 'records_without_usable_geometry': 0}.
Lighting completeness among downloaded road records: {'denominator': 0, 'key_present': 0, 'nonblank': 0, 'missing_or_blank': 0, 'nonblank_percent': None}.
Sidewalk completeness among downloaded road records: {'denominator': 0, 'key_present': 0, 'nonblank': 0, 'missing_or_blank': 0, 'nonblank_percent': None}.
Business opening-hours completeness among downloaded business records: {'denominator': 0, 'key_present': 0, 'nonblank': 0, 'missing_or_blank': 0, 'nonblank_percent': None}.
Potential facility duplicate pairs: 0.
Cross-task record variants: 0; conflicting same-version variants
prevent complete merged output. Different versions use the newest version/edit
timestamp, then usable geometry and a stable tie-break, retaining the whole chosen
record rather than combining tags. All alternatives remain in immutable task raw
responses. A multi-time extraction is not a simultaneous OSM snapshot.

No `opening_hours` selector filters businesses. Missing lit/sidewalk means unknown;
explicit `no` is recorded information, not proof of current conditions. Hours are
not parsed and no business is classified currently open. Null/incomplete relation
geometry is retained and flagged. Global coordinate validity does not prove
position accuracy, walking access, facility operation or exhaustive mapping.
Tile interiors do not overlap; inclusive Overpass boundaries can return shared
edge records and whole crossing ways. These are deduplicated by (type, ID), not
by name or coordinates. Sparse results are not proof of physical absence.

Successful raw JSON, exact query, bbox, endpoint, retrieval/edit/base timestamps
and hashes are stored per task before marking success. A terminal `out count`
must match records and per-type counts. Missing count, remarks, malformed JSON,
unexpected records or invalid coordinates cannot become successful tasks.
Resume revalidates hashes and raw contents and skips valid successes. Partial
outputs stay separate; manifest/task geometry checks precede every merge.

Attribution: © OpenStreetMap contributors, ODbL 1.0,
https://www.openstreetmap.org/copyright. Count-query reference:
https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL.
No route request, HeiGIT request, key access, safety score, backend/frontend/ML
edit, commit or push. Usage and tests: `RESUMABLE_EXTRACTION_README.md`.
