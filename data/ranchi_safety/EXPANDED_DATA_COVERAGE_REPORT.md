# Phase 4B — expanded Ranchi OSM coverage

Run: `expanded_outputs\20261009T123052_580371Z`. Expanded bbox (south, west, north, east):
**[23.335059, 85.308481, 23.38, 85.34]**. Original bbox: **[23.35, 85.31, 23.38, 85.34]**.
The boundary uses the actual saved three walking geometries, their 100 m union
corridor, a **50 m extra margin**, and the whole original
pilot rectangle. Metric envelope edges were densified, inverse-projected and
rounded outward to six decimal degrees. Before downloading, geometric checks
confirmed containment of every centerline, complete buffer, margin union and
previously uncovered geometry. It remains a selected Ranchi pilot extent, not
the entire city. `boundary_plan.json` records exact source-file hashes.

## Geographic route coverage against the new boundary

| Route ID | Original length inside | Expanded length inside | Expanded length outside | Expanded buffer area inside | Full buffer covered |
| --- | ---: | ---: | ---: | ---: | --- |
| heigit-foot-walking-route-1 | 54.1863% | 100.0000% | 0.0000% | 100.0000% | True |
| heigit-foot-walking-route-2 | 56.6007% | 100.0000% | 0.0000% | 100.0000% | True |
| heigit-foot-walking-route-3 | 63.9492% | 100.0000% | 0.0000% | 100.0000% | True |

These geometric calculations use the previous validated clipping/ellipsoid and UTM-buffer method; they do not fetch new routes.

## Extraction status

**Extraction failed; unverified: Overpass extraction failed after bounded retries; extraction remains unverified**
No extracted feature counts are claimed. Geographic containment of a planned box does not establish successful data acquisition.

The 100% entries above describe the proposed geographic extent only. They do not establish a downloaded dataset, complete feature inventory or successful extraction.

## Comparison available before successful extraction

| Same analytical category | Original objects | Expanded downloaded objects |
| --- | ---: | --- |
| roads_and_pedestrian_ways | 1394 | unavailable / unverified |
| pedestrian_infrastructure | 65 | unavailable / unverified |
| ways_with_lit_tag | 37 | unavailable / unverified |
| street_lamps | 0 | unavailable / unverified |
| police_stations | 6 | unavailable / unverified |
| healthcare_facilities | 39 | unavailable / unverified |
| hospitals | 36 | unavailable / unverified |
| pharmacies | 3 | unavailable / unverified |
| shops_and_businesses | 15 | unavailable / unverified |
| businesses_with_opening_hours | 12 | unavailable / unverified |

Original unique records: 1451. No expanded records are claimed; this is not a zero-feature result.

Lighting: original 37/1394 nonblank (2.6542%); expanded completeness unavailable.

Sidewalk: original 36/1394 nonblank (2.5825%); expanded completeness unavailable.

Business opening hours: original 12/15 nonblank (80.0%); expanded completeness unavailable.

The new query deliberately removes the opening-hours filter, expands healthcare/infrastructure/business taxonomy and expands the area. Future count differences will reflect both extent and selector changes, not measured real-world growth. Quality checks on an expanded dataset cannot run until a valid complete response is acquired.

The original opening-hours percentage describes the biased selected sample only: general businesses required an hours tag to enter the original query; the three retail pharmacies entered separately. It is not pilot-wide business-hours completeness.

Transport evidence: `http_error_1.txt` — Overpass dispatcher timeout: server reported too busy.

## Geographic extent versus feature completeness

All three planned 100 m route corridors are geometrically within this new extent.
That does **not** certify real-world OSM feature completeness, tagging accuracy,
freshness, walking permissions, network connectivity, lamp functionality or facility
availability. Overpass bbox selection can miss enclosing objects with no nodes
inside; complex relations can extend beyond the boundary. Review the downloaded
geometry and missing tags before route matching or feature engineering. Preserve
unknowns and source IDs; manual geocoding/entrance/entity checks remain necessary.

Reproduction: `EXPANDED_EXTRACTION_README.md`. Synthetic tests validate extent
construction, hours-independent business selection, tag denominators and rejection
of partial/conflicting responses; existing route tests validate clipping and buffers.
Data: © OpenStreetMap contributors, ODbL 1.0,
https://www.openstreetmap.org/copyright. Query syntax reference retained from the
original experiment: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL.
No safety score, route safety classification, ranking or model was generated.
No backend/frontend/ML changes, commit or push.
