# Ranchi OSM data-access and quality experiment

This is the initial Phase 4 experiment only. It does not change routing, assess
safety, rank routes, train models, or add frontend features. Python 3.10+ is
required; there are **no third-party dependencies**.

## Pilot extent

The fixed bounding box is **south 23.350, west 85.310, north 23.380, east 85.340**
(WGS84 latitude/longitude). This is an approximately 3.3 km north–south by 3.0 km
east–west rectangle around central Ranchi's Main Road/Albert Ekka Chowk area.
It is an experimental rectangle, not an administrative boundary, a validated
walking network, or a representation of the entire city. Review the extent at
https://www.openstreetmap.org/#map=14/23.3650/85.3250 before interpreting results.
Overpass selects objects touching the box through their nodes; full way and
relation geometry can extend outside it. Objects enclosing the box without
nodes inside it may be missed. Geometry is deliberately not clipped.

## Run from the repository root (PowerShell)

```powershell
python data/ranchi_safety/extract_osm.py
python -m unittest discover -s data/ranchi_safety -p 'test_*.py' -v
```

The first command contacts the public Overpass interpreter. It submits one
bounded union query with a 45-second server timeout and a 60-second client
timeout. Allow time for public service load; avoid repeatedly running it.
Use `--endpoint https://your-overpass-server/api/interpreter` if needed.

If your `python` on PATH is unavailable or broken, this repository's existing
Windows environment can run both commands without installing anything:

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/extract_osm.py
.\backend\.venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p 'test_*.py' -v
```

Reprocess a saved response offline:

```powershell
python data/ranchi_safety/extract_osm.py --input data/ranchi_safety/outputs/<run>/raw_response.json
```

Offline reprocessing does not verify the input's provenance or network access.
It assumes the saved input came from the documented pilot query. Synthetic
test records are never written as a live extraction.

## Extracted categories

* Highway-tagged ways: roads, footways, paths and other highway ways. These are
  candidates for inspection; access, foot permissions and connectivity are not evaluated.
* The subset of these ways with a `lit` key, preserving every original value.
* `highway=street_lamp` nodes, ways and relations.
* Police (`amenity=police`), hospitals and pharmacies (amenity or healthcare tags).
* Shops, offices and crafts with an `opening_hours` key, plus a documented
  commercial amenity list: restaurant, cafe, fast_food, bar, pub, bank, fuel,
  ice_cream, food_court, car_rental, car_wash. This is not an exhaustive taxonomy
  of businesses. Pharmacies with `shop=chemist` also match this category.

## Files produced per run

Every run creates a distinct UTC-named folder under `outputs/`:

* `query.overpassql`: exact query definition (reference only for offline runs).
* `raw_response.json`: original successful response bytes, or the supplied offline input.
* `response_attempt_N.json`: original HTTP-success bodies from network attempts,
  including bodies that report Overpass errors. These are not necessarily usable data.
* `http_error_N.txt`: HTTP error bodies when provided by the server.
* `features.geojson`: one feature per unique OSM type/ID, with category memberships,
  full tags, original OSM element including coordinates and relation members,
  object URL, attribution, source endpoint, run time and OSM base timestamp.
* `quality_summary.json`: counts, missing fields, coordinate checks, duplicates
  and lighting-tag completeness. Categories overlap; their counts should not be summed.
* `run_status.json`: success or failure and source metadata. Failed runs do not
  produce a quality summary or usable feature collection. Exit code is 1 on failure.

Nodes become Points; ways become LineStrings even if closed. Relations become
GeometryCollections of available direct members, not inferred polygons. Missing
or invalid geometry stays null; the original record remains available. GeoJSON
uses longitude, latitude coordinate order.

## Quality checks and interpretation

Counts refer to OSM objects, not unique streets or establishments. Duplicate
type/ID records are counted and only the first is processed; duplicates with
different IDs and node/area representations of the same place need later review.
Missing/blank `name` and `opening_hours` and unusable geometry are counted by
category. Opening hours are not expected for roads: these are descriptive missing
field counts, not a judgement that each field is mandatory.

Coordinates are checked for numeric finite values and global latitude/longitude
bounds; missing geometry is reported separately. Points outside the pilot box
are counted, not automatically rejected. These checks cannot verify positional
accuracy, completeness of relation geometry, or real-world existence.

Lighting completeness is the percentage of extracted road/pedestrian ways with
a `lit` key; all values, including blank or unusual ones, are tallied verbatim.
**An absent `lit` tag means unknown, never unlit.** A present `lit=yes` or `lit=no`
is a mapping claim, not a current field observation. Mapped street lamps do not
prove coverage, functionality, or visibility. Unequal mapping effort affects all
categories; zero records does not prove that a service is absent.

**No business is classified as currently open.** `opening_hours` is retained
without parsing. Schedules may be incomplete, outdated, conditional or affected
by holidays; the existence of a business record says nothing about its present status.

HTTP 429 and selected server errors, network failures, timeouts and invalid or
partial JSON receive at most three attempts with backoff. `Retry-After` is
respected; cooldowns longer than 60 seconds stop the run for a later manual retry.
Non-retryable HTTP errors stop immediately. Any Overpass `remark` is treated
conservatively as an unusable/partial response. No missing values are invented.
If network access fails, **live extraction remains unverified**, even when offline
tests pass. See `VALIDATION.md` for this implementation's actual checks.

## Analyze the existing snapshot without network requests

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/analyze_coverage.py
```

This pins the successful original run and produces `DATA_COVERAGE_REPORT.md`
and `data_coverage_summary.csv` in this folder. It does not run the extractor or
contact Overpass. The report explains the business selection bias, the expanded
retail/pharmacy grouping, missing-field percentages, usable categories and the
unverified Albert Ekka Chowk–Doranda route coverage. Coverage tests are included
in the unittest discovery command above.

## Verify the actual walking route's geographic coverage

See `ROUTE_COVERAGE_README.md` for the isolated geometry dependencies, local
`POST /route` experiment, 100 m buffer configuration, synthetic tests and offline
replay. Results are in `ROUTE_COVERAGE_REPORT.md`. Route retrievals are stored
separately in `route_coverage_runs/`, not mixed with OSM snapshots in `outputs/`.

## Attribution and sources

Data: **© OpenStreetMap contributors**, available under the Open Database License
(ODbL) 1.0. Preserve attribution with exports and review licence obligations when
redistributing data or derived databases:
https://www.openstreetmap.org/copyright

Query syntax reference:
https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL

OSM is volunteer-maintained, varies in completeness and recency, and is not a
verified inventory of safety infrastructure. The OSM base timestamp describes
the server snapshot; it is not the observation date of each tag. `out meta geom`
also retains OSM editing metadata in raw records; consider that when sharing outputs.
