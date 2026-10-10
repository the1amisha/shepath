# Offline extraction: complete

Source: `pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf`; SHA-256 `2d712eaa733a6e0df8a290350d7e9bae90e9e5299e1f54c398741e417786a2a4`.

Boundary [south, west, north, east]: [23.335059, 85.308481, 23.38, 85.34].

Unique analysis features: 2720; supporting objects: 18871.

Counts overlap by category. See manifest.json for counts, tag completeness and route/buffer measurements; issues.jsonl lists unresolved geometry.

| Category | Feature count |
|---|---:|
| businesses_with_opening_hours | 16 |
| healthcare_facilities | 78 |
| hospitals | 42 |
| pedestrian_infrastructure | 115 |
| pharmacies | 5 |
| police_stations | 7 |
| recorded_highway_lighting | 44 |
| roads_and_pedestrian_ways | 2278 |
| shops_and_businesses | 351 |
| ways_with_lit_tag | 44 |

```json
{
  "unique_features": 2720,
  "feature_types": {
    "node": 343,
    "way": 2377
  },
  "category_memberships": {
    "pedestrian_infrastructure": 115,
    "shops_and_businesses": 351,
    "police_stations": 7,
    "healthcare_facilities": 78,
    "hospitals": 42,
    "pharmacies": 5,
    "businesses_with_opening_hours": 16,
    "roads_and_pedestrian_ways": 2278,
    "ways_with_lit_tag": 44,
    "recorded_highway_lighting": 44
  },
  "category_types": {
    "pedestrian_infrastructure:node": 10,
    "shops_and_businesses:node": 265,
    "police_stations:node": 4,
    "healthcare_facilities:node": 69,
    "hospitals:node": 34,
    "pharmacies:node": 5,
    "businesses_with_opening_hours:node": 9,
    "roads_and_pedestrian_ways:way": 2278,
    "ways_with_lit_tag:way": 44,
    "recorded_highway_lighting:way": 44,
    "pedestrian_infrastructure:way": 105,
    "shops_and_businesses:way": 86,
    "businesses_with_opening_hours:way": 7,
    "healthcare_facilities:way": 9,
    "hospitals:way": 8,
    "police_stations:way": 3
  },
  "supporting_objects": 18871,
  "source_unique_records": 44483763,
  "duplicate_records": {},
  "lighting_values": {
    "<absent>": 2234,
    "yes": 40,
    "no": 4
  },
  "lighting": {
    "present": 44,
    "denominator": 2278,
    "missing": 2234,
    "missing_percent": 98.06848112379281
  },
  "sidewalk_tag_presence": {
    "present": 44,
    "denominator": 2278,
    "missing": 2234,
    "missing_percent": 98.06848112379281
  },
  "opening_hours_nonblank": {
    "present": 16,
    "denominator": 351,
    "missing": 335,
    "missing_percent": 95.44159544159544
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
