# Offline extraction: complete

Source: `pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf`; SHA-256 `2d712eaa733a6e0df8a290350d7e9bae90e9e5299e1f54c398741e417786a2a4`.

Boundary [south, west, north, east]: [23.23, 85.25, 23.43, 85.5].

Unique analysis features: 23719; supporting objects: 240827.

Counts overlap by category. See manifest.json for counts, tag completeness and route/buffer measurements; issues.jsonl lists unresolved geometry.

| Category | Feature count |
|---|---:|
| businesses_with_opening_hours | 44 |
| healthcare_facilities | 274 |
| hospitals | 152 |
| pedestrian_infrastructure | 446 |
| pharmacies | 16 |
| police_stations | 17 |
| recorded_highway_lighting | 107 |
| roads_and_pedestrian_ways | 22664 |
| shops_and_businesses | 652 |
| ways_with_lit_tag | 107 |

```json
{
  "unique_features": 23719,
  "feature_types": {
    "node": 800,
    "relation": 4,
    "way": 22915
  },
  "category_memberships": {
    "pedestrian_infrastructure": 446,
    "shops_and_businesses": 652,
    "police_stations": 17,
    "healthcare_facilities": 274,
    "hospitals": 152,
    "pharmacies": 16,
    "businesses_with_opening_hours": 44,
    "roads_and_pedestrian_ways": 22664,
    "ways_with_lit_tag": 107,
    "recorded_highway_lighting": 107
  },
  "category_types": {
    "pedestrian_infrastructure:node": 67,
    "shops_and_businesses:node": 482,
    "police_stations:node": 13,
    "healthcare_facilities:node": 254,
    "hospitals:node": 133,
    "pharmacies:node": 16,
    "businesses_with_opening_hours:node": 29,
    "shops_and_businesses:relation": 4,
    "businesses_with_opening_hours:relation": 1,
    "roads_and_pedestrian_ways:way": 22664,
    "ways_with_lit_tag:way": 107,
    "recorded_highway_lighting:way": 107,
    "pedestrian_infrastructure:way": 379,
    "shops_and_businesses:way": 166,
    "businesses_with_opening_hours:way": 14,
    "healthcare_facilities:way": 20,
    "hospitals:way": 19,
    "police_stations:way": 4
  },
  "supporting_objects": 240827,
  "source_unique_records": 44483763,
  "duplicate_records": {},
  "lighting_values": {
    "<absent>": 22557,
    "yes": 87,
    "no": 20
  },
  "lighting": {
    "present": 107,
    "denominator": 22664,
    "missing": 22557,
    "missing_percent": 99.52788563360396
  },
  "sidewalk_tag_presence": {
    "present": 100,
    "denominator": 22664,
    "missing": 22564,
    "missing_percent": 99.55877162019061
  },
  "opening_hours_nonblank": {
    "present": 44,
    "denominator": 652,
    "missing": 608,
    "missing_percent": 93.25153374233129
  },
  "unresolved_issues": 0,
  "potential_facility_duplicate_pairs": 4
}
```

| Saved route | Length inside (%) | 100m buffer inside (%) |
|---|---:|---:|
| heigit-foot-walking-route-1 | 100.000000 | 100.000000 |
| heigit-foot-walking-route-2 | 100.000000 | 100.000000 |
| heigit-foot-walking-route-3 | 100.000000 | 100.000000 |

Complete means the requested processing and reference checks passed for this source. It does not establish real-world mapping completeness or provider geographic coverage. Unknown lighting is not unlit; opening hours do not establish current operation.

Potential node/polygon facility duplicates are retained for later review, never merged by name. The hints use exact normalized names, shared category and representative points within 30m; unnamed or differently named duplicates can be missed. Public PBF metadata may omit user/changeset information; PyOsmium defaults of zero/empty are not evidence of supplied metadata.

© OpenStreetMap contributors; ODbL 1.0. No safety scores.
