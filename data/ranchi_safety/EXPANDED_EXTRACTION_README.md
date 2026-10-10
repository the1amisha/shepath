# Phase 4B expanded extraction

All inputs/outputs stay in this experiment folder. Requires the isolated Shapely
and pyproj dependencies installed per `ROUTE_COVERAGE_README.md`. Uses the
existing backend Python environment as an interpreter; does not import backend
code, read keys or call routing again.

Run from the repository root:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p 'test_expanded_extraction.py' -v
.\backend\.venv\Scripts\python.exe data/ranchi_safety/extract_expanded_osm.py --plan-only
.\backend\.venv\Scripts\python.exe data/ranchi_safety/extract_expanded_osm.py
```

`--plan-only` makes no network request. Every live run also recomputes and checks
the boundary **before** issuing a query. The initial 100 m buffer is fixed to the
completed route experiment. The additional modest margin defaults to 50 m;
`--margin-metres` can adjust it between 10 and 500 m. The expanded box is the
route-buffer-plus-margin envelope combined with the original pilot rectangle,
rounded outward to six decimal degrees. Keeping the old rectangle preserves
the old sampled area for comparison. Full metric containment, whole polylines
and earlier uncovered polygons are validated; endpoint checks alone are not used.

Inputs are pinned to the three saved routes and coverage outputs in
`route_coverage_runs/20261008T140112_006152Z/`, plus the original OSM snapshot
`outputs/20261008T133610_076939Z/` and `ROUTE_COVERAGE_REPORT.md`.
Route API [latitude, longitude] is explicitly converted for geometric operations;
output GeoJSON is [longitude, latitude]. Input-file hashes are saved for audit.

## Query scope and the commercial-bias correction

One bounded union query retrieves highway ways with all their existing tags,
mapped lamps, pedestrian-tagged ways and infrastructure nodes/objects (crossings,
signals, elevators, kerbs, barriers, sidewalk tags), police, all healthcare-key
objects plus hospital/clinic/doctors/dentist/nursing_home/health_post/pharmacy
amenities, and shop/office/craft objects. Commercial amenities include the previous
list plus pharmacies and marketplaces; lodging includes hotel/motel/hostel/guest_house.
**No business selector requires `opening_hours`.** Its completeness is calculated
after extraction. The taxonomy still does not guarantee an exhaustive business census.
Key presence can include unusual/no values, so original tags remain available.

The original standard-library Overpass transport is reused: POST, 45 s server
timeout, 60 s client timeout, bounded retries/backoff, HTTP error bodies retained,
Retry-After respected. Default is at most two attempts; `--attempts 1` disables
retries, `--attempts 3` allows the original maximum. Phase 4B waits at least 30 s
between failures; longer Retry-After cooldowns still control or stop retries.
There is no automatic second
successful query or merging of incomplete responses. Remarks and invalid JSON
are rejected; unexpected empty data and conflicting duplicate IDs are rejected.
`--endpoint` supports an alternate Overpass interpreter if needed. Avoid repeated
successful requests; inspect the saved snapshot instead.

## New snapshot files

Each run gets a distinct `expanded_outputs/<UTC timestamp>/` directory:

* `boundary_plan.json`: original/expanded bbox, margin, validation, input hashes.
* `route_buffers.geojson`: actual saved-route buffer union and expanded rectangle.
* `query.overpassql`: exact query submitted and its taxonomy.
* `route_coverage.json`: recalculated centerline and buffer coverage for all routes.
* `raw_response.json` and transport response/error files: unmodified server bodies.
* `features.geojson`: every unique record with original IDs, tags, coordinates,
  edit timestamps, geometry, attribution and source provenance.
* `quality_summary.json`: overlapping category/type counts, coordinates, missing
  geometry/names/timestamps, lit/sidewalk/hour completeness and duplicate candidates.
* `run_status.json`: planned, success or honest failure status.
* `EXPANDED_DATA_COVERAGE_REPORT.md`: archived report; also published at this
  experiment folder's root. Earlier snapshot and route reports are preserved.

Duplicate candidates are same normalized names with minimum geometry distance
≤100 m; these are review suggestions, not confirmed entities, and no candidates
are merged. All category counts deduplicate type/ID within the category; category
memberships overlap. For tag completeness, absent and blank values are missing,
explicit `no` is nonblank, and side-specific sidewalk tags count once per road.
Raw category `businesses_with_opening_hours` means key-present, not valid schedule.

## Limits before feature engineering

Successful parsing with no Overpass runtime remark establishes response integrity,
not field completeness. Expanded geometric coverage says the box covers route
corridors, not that every street/service/sidewalk/lamp is mapped. Longitude/latitude
global bounds do not establish correct positions. Overpass bbox selection can miss
enclosing objects; returned geometry can extend beyond the box. Complex relations
and walking permissions/entrances still need review. Last edit is not a tag's
observation date. Absent lighting/sidewalk tags remain unknown; opening hours are
not evaluated for current opening status. Healthcare tags may describe specialist,
veterinary or questionable records. No safety interpretation or scores are produced.

Data: © OpenStreetMap contributors, ODbL 1.0:
https://www.openstreetmap.org/copyright.
