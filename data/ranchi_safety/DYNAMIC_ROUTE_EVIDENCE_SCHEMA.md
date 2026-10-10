# Dynamic route evidence v1 contract

The API-independent Python function returns a JSON-serializable dictionary conforming
to `RouteEvidence` in `dynamic_route_evidence.py`. No backend schema is changed.
All numbers are finite; unavailable measurements are `null`, never NaN. Distances
are metres, durations seconds, areas square metres, percentages 0–100.

| Required top-level field | Type / meaning |
|---|---|
| `schema_version` | Literal `SHEPATH.dynamic_route_evidence.v1` |
| `status` | `available` or `coverage_unavailable` |
| `route` | String `id`; original ordered coordinates normalized to floats; `coordinate_order`; `geometry_sha256`; nullable `supplied_distance_metres` and `supplied_duration_seconds` |
| `analysis` | Buffer, projection, densification, buffer resolution, conservative containment parameters, selection rule, denominator and hash convention |
| `coverage` | Pilot bbox `[south,west,north,east]`; boolean `centerline_fully_covered` and `full_buffer_covered`; nullable machine-readable `reason`; `nominal_buffer` only when the centerline is contained |
| `route_context` | Object described below when available; **null when coverage is unavailable** |
| `evidence_completeness` | Analysis status; available results additionally carry real-world completeness (`unknown`), lighting, sidewalk and business-hours availability indicators |
| `uncertainty_flags` | List of machine-readable strings; baseline flags always include unknown OSM completeness, unverified street attribution, unknown activity/operation and no negative safety inference from missing tags |
| `source_provenance` | Pinned extraction manifest hash, source PBF hash (historical identity, not reread), snapshot timestamp, URL, boundary hash, artifact hashes, full geometry provenance, dataset content hash, code hashes, package versions, attribution/license and small export byte count |
| `evidence_identity_sha256` | Geometry + analysis parameters + schema + source/code/version provenance hash; excludes route label and caller distance/duration |

## Available route context

All Phase 5A metric fields remain intact. Additions are explicit below.

| Field | Contract |
|---|---|
| `buffer_metres` | Positive configured buffer |
| `projected_route_length_metres` | EPSG:32645 traversed length; denominator for route proximity, including repeat traversal |
| `route_length_geodesic_metres` | WGS84 geodesic sum over densified polyline segments |
| `nearby_unique_object_count` | Unique typed OSM IDs intersecting the corridor |
| `nearby_evidence[]` | `osm_id`, category memberships, minimum geometric distance in metres, proximity relation and null verified street attribution |
| `categories` | All ten Phase 5A groups are always present, including groups with zero matching records |
| `categories.<group>` | `count`, `count_unit=unique_OSM_objects`, sorted `ids`, OSM `types` counts, `data_availability`, `real_world_completeness=unknown`, `route_proximity` ratio |
| `lighting` | Road-object denominator; `states.yes/no/other_recorded/unknown`; each with object ratio, IDs, clipped object-line ratio and route-proximity ratio; raw tag counts and missing/blank counts; nullable walked-street coverage |
| `sidewalk` | Same road context with `states.available/unknown`, usable tag ratio, raw sidewalk-family values; `sidewalk=no` is available information, not a missing tag or safety label |
| `opening_hours` | Nonblank **business** tag ratio; recorded/missing IDs; missing/blank counts; `syntax_validated=false`, `currently_open=null`, operating evidence unavailable. Added `all_selected_recorded_tags[]` preserves raw values and IDs across **all** nearby feature categories, including blanks |
| `duplicate_sensitivity` | For business, healthcare and police: raw count, conditional count if all flagged pairs are one entity, selected members and pairs, `records_merged=false`; not a bound on physical facilities |
| `verified_on_walked_street` | `status=not_performed`, `osm_ids=null`, `tag_coverage=null` |
| `evidence_confidence` | Phase 5A categorical completeness and uncertainty, never probability or safety confidence |
| `overlap_rule` | Categories and state proximity can overlap; never add percentages |
| `source_features[]` | Added full original GeoJSON features, sorted by typed ID, including exact WGS84 geometry, original properties/tags, node references and source metadata |
| `duplicate_pairs[]` | Added original selected duplicate hints; pairs may include a second record outside the corridor; full pair records remain traceable through hashed pilot exports |
| `nearby_road_geometry` | Added `unique_clipped_line_length_metres` from unioned line geometry and `OSM_object_line_sum_metres` for comparison; excludes polygon boundaries |

Every ratio has `numerator`, `denominator`, `unit`, `percent`. A zero denominator
produces `percent=null`. Units distinguish `metres_of_route`, `OSM_road_objects`,
`metres_of_nearby_OSM_road_lines` and `business_OSM_objects`. The Phase 5A road-line
ratios sum clipped OSM object lengths and are **not unique geographic coverage**.
Use `nearby_road_geometry.unique_clipped_line_length_metres` for unioned length.

The ten category keys are `roads_and_pedestrian_ways`, `pedestrian_infrastructure`,
`ways_with_lit_tag`, `street_lamps`, `police_stations`, `healthcare_facilities`,
`hospitals`, `pharmacies`, `shops_and_businesses`, `businesses_with_opening_hours`.

## Errors and coverage

Invalid input raises `ValueError`: missing/nonblank route ID, malformed/nonfinite/
out-of-range coordinates, fewer than two vertices, stationary geometry, negative
or nonfinite optional metadata, invalid buffer, or configured complexity limits.
Booleans and numeric strings are rejected. Tuples and lists are accepted.
Dataset integrity failures raise exceptions; a future backend adapter must handle
these as dataset-unavailable errors, never as empty evidence. No exception is
converted into a misleading `available` response.

Geographically valid coordinates outside the supported pilot return
`coverage_unavailable`; counts and percentages are omitted by setting the entire
context to null. The centerline is checked before local projection, including
all segments and intermediate vertices. Full-buffer acceptance requires a
conservative whole-geometry containment check, including round endpoint caps.
The `nominal_buffer` area percentages are diagnostic and never decide acceptance.

Production loading has pinned verified provenance. Explicit synthetic constructor
fixtures instead declare `integrity=synthetic_unverified_fixture`; callers must
not present fixture outputs as verified pilot observations.
