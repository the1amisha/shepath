# Phase 4B — expanded Ranchi OSM coverage

Run: `expanded_outputs\20261008T142703_316466Z`. Expanded bbox (south, west, north, east):
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

**Boundary validated; extraction has not been attempted.**
No extracted feature counts are claimed. Geographic containment of a planned box does not establish successful data acquisition.

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
