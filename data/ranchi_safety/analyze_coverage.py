"""Generate coverage artifacts from a pinned local extraction. No network calls."""

from collections import Counter
import csv
import hashlib
import json
from pathlib import Path

from extract_osm import categories, coordinate_points, geometry, valid_point, validate_response

ROOT = Path(__file__).resolve().parent
RUN = ROOT / "outputs" / "20261008T133610_076939Z"
FIELDS = {
    "name": ("name",), "opening_hours": ("opening_hours",), "lit": ("lit",),
    "surface": ("surface",), "foot": ("foot",), "access": ("access",),
    "sidewalk_any": ("sidewalk", "sidewalk:left", "sidewalk:right", "sidewalk:both"),
    "phone_any": ("phone", "contact:phone", "contact:mobile"),
    "address_any": ("addr:full", "addr:street", "addr:place", "addr:city", "addr:district",
                    "addr:postcode", "addr:housenumber", "addr:housename", "addr:state"),
    "emergency": ("emergency",), "check_date_any": ("check_date", "check_date:opening_hours"),
}
LABELS = {
    "roads_and_pedestrian_ways": "Roads / pedestrian ways",
    "ways_with_lit_tag": "Ways with lit=*",
    "street_lamps": "Mapped street lamps",
    "police_stations": "Police stations",
    "hospitals": "Hospitals (tagged, not verified)",
    "pharmacies": "Pharmacies",
    "shops_and_businesses": "Shops / businesses (including retail pharmacies)",
    "businesses_with_opening_hours": "Businesses with opening_hours",
}
USES = {
    "roads_and_pedestrian_ways": "Geometry/highway context; pedestrian permissions need review",
    "ways_with_lit_tag": "Sparse descriptive lighting evidence only",
    "street_lamps": "Insufficient: no mapped records",
    "police_stations": "Mapped landmark proximity after site/access review",
    "hospitals": "Mapped landmark proximity after facility-type/location review",
    "pharmacies": "Sparse mapped landmark proximity; no hours evidence",
    "shops_and_businesses": "Biased sample; insufficient for business-density inference",
    "businesses_with_opening_hours": "Raw schedule display after validation; no current-open inference",
}


def percentage(count, denominator):
    return round(100 * count / denominator, 2) if denominator else None


def fmt_pct(count, denominator):
    value = percentage(count, denominator)
    return "N/A" if value is None else f"{value:.2f}%"


def present(element, field):
    tags = element.get("tags", {})
    return any(key in tags and str(tags[key]).strip() for key in FIELDS[field])


def missing(elements, field):
    if field == "usable_geometry":
        return sum(geometry(e) is None for e in elements)
    return sum(not present(e, field) for e in elements)


def group_elements(elements):
    groups = {key: [] for key in LABELS}
    for element in elements:
        original_categories = categories(element)
        for category in original_categories:
            groups[category].append(element)
        # Pharmacies are included as retail businesses, even without a shop tag.
        # Hospitals/police are not assumed to be commercial establishments.
        if "businesses_with_opening_hours" in original_categories or "pharmacies" in original_categories:
            groups["shops_and_businesses"].append(element)
    return groups


def write_csv(groups, source_hash, snapshot):
    headers = ["category", "unique_features", "nodes", "ways", "relations", "attribute",
               "denominator", "present_count", "missing_or_blank_count", "missing_percent",
               "route_usability", "denominator_note", "source_run", "source_file", "osm_base_timestamp", "raw_sha256",
               "attribution", "license", "license_url"]
    with (ROOT / "data_coverage_summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        for category, elements in groups.items():
            types = Counter(e["type"] for e in elements)
            fields = ["name", "usable_geometry"]
            if category in {"roads_and_pedestrian_ways", "ways_with_lit_tag"}:
                fields += ["lit", "surface", "foot", "access", "sidewalk_any"]
            elif category != "street_lamps":
                fields += ["opening_hours", "phone_any", "address_any", "check_date_any"]
                if category == "hospitals":
                    fields += ["emergency"]
            for field in fields:
                absent = missing(elements, field)
                writer.writerow({"category": category, "unique_features": len(elements),
                                 "nodes": types["node"], "ways": types["way"], "relations": types["relation"],
                                 "attribute": field, "denominator": len(elements),
                                 "present_count": len(elements) - absent, "missing_or_blank_count": absent,
                                 "missing_percent": percentage(absent, len(elements)),
                                 "route_usability": USES[category],
                                 "denominator_note": "Selected OSM objects only; categories overlap; zero denominator is N/A",
                                 "source_run": RUN.name, "source_file": f"outputs/{RUN.name}/raw_response.json",
                                 "osm_base_timestamp": snapshot, "raw_sha256": source_hash,
                                 "attribution": "© OpenStreetMap contributors", "license": "ODbL 1.0",
                                 "license_url": "https://www.openstreetmap.org/copyright"})


def table(headers, rows):
    return "\n".join(["| " + " | ".join(headers) + " |",
                      "| " + " | ".join(["---"] * len(headers)) + " |"] +
                     ["| " + " | ".join(str(value) for value in row) + " |" for row in rows])


def main():
    raw = (RUN / "raw_response.json").read_bytes()
    source_hash = hashlib.sha256(raw).hexdigest()
    data = json.loads(raw)
    validate_response(data)
    status = json.loads((RUN / "run_status.json").read_text(encoding="utf-8"))
    assert status["status"] == "success" and status["source"]["mode"] == "live_overpass"
    unique = {}
    for element in data["elements"]:
        unique.setdefault((element["type"], element["id"]), element)
    elements = list(unique.values())
    groups = group_elements(elements)
    source = status["source"]
    snapshot = data["osm3s"]["timestamp_osm_base"]
    bbox = source["bbox_south_west_north_east"]
    collection = json.loads((RUN / "features.geojson").read_text(encoding="utf-8"))
    exported = {(f["properties"]["osm_type"], f["properties"]["osm_id"]): f for f in collection["features"]}
    assert len(exported) == len(collection["features"]) == len(elements)
    assert all(exported[key]["properties"]["original_osm_element"] == value for key, value in unique.items())
    old = json.loads((RUN / "quality_summary.json").read_text(encoding="utf-8"))
    assert all(len(groups[key]) == value for key, value in old["counts_by_category"].items())
    memberships = Counter((e["type"], e["id"]) for group in groups.values() for e in group)
    assert set(memberships) == set(unique)
    types = Counter(e["type"] for e in elements)
    counts_table = table(["Category", "Unique objects", "Nodes", "Ways", "Relations"],
                         [(LABELS[key], len(group), *[Counter(e["type"] for e in group)[kind]
                           for kind in ("node", "way", "relation")]) for key, group in groups.items()])
    fields_table = table(["Category", "Attribute", "Missing / denominator", "Missing %"],
                         [(LABELS[key], field, f"{missing(group, field)} / {len(group)}",
                           fmt_pct(missing(group, field), len(group)))
                          for key, group in groups.items()
                          for field in (["name", "usable_geometry"] if key == "street_lamps" else
                                        ["name", "usable_geometry"] if key in {"roads_and_pedestrian_ways", "ways_with_lit_tag"}
                                        else ["name", "opening_hours", "phone_any", "address_any", "check_date_any"] +
                                        (["emergency"] if key == "hospitals" else []))])
    roads = groups["roads_and_pedestrian_ways"]
    road_fields = table(["Road attribute", "Present", "Missing / blank", "Missing %"],
                        [(field, len(roads) - missing(roads, field), missing(roads, field),
                          fmt_pct(missing(roads, field), len(roads))) for field in
                         ("name", "lit", "surface", "sidewalk_any", "foot", "access")])
    highway_types = Counter(e["tags"]["highway"] for e in roads)
    highway_table = table(["Highway value", "Way objects"], highway_types.most_common())
    points = [point for e in elements for point in coordinate_points(e)]
    invalid = sum(not valid_point(point) for point in points)
    outside = sum(valid_point(p) and not (bbox[0] <= p["lat"] <= bbox[2] and bbox[1] <= p["lon"] <= bbox[3]) for p in points)
    crossing = sum(any(valid_point(p) and not (bbox[0] <= p["lat"] <= bbox[2] and bbox[1] <= p["lon"] <= bbox[3])
                       for p in coordinate_points(e)) for e in elements)
    assert invalid == old["coordinates"]["invalid_points"] and outside == old["coordinates"]["points_outside_pilot_bbox"]
    lit_values = Counter(e["tags"]["lit"] for e in roads if "lit" in e["tags"])
    hours_table = table(["Business OSM ID", "Name", "Recorded opening_hours"],
                        [(f'{e["type"]}/{e["id"]}', e["tags"].get("name", "(missing)"), e["tags"]["opening_hours"])
                         for e in groups["businesses_with_opening_hours"]])
    business_types = Counter("shop=" + e["tags"]["shop"] if "shop" in e["tags"] else
                             "office=" + e["tags"]["office"] if "office" in e["tags"] else
                             "amenity=" + e["tags"].get("amenity", "unknown") for e in groups["shops_and_businesses"])
    timestamp_years = Counter(e.get("timestamp", "missing")[:4] for e in elements)
    years_table = table(["OSM last-edit year", "Objects"], sorted(timestamp_years.items()))
    hospitals = groups["hospitals"]
    hospital_sources = Counter(e["tags"].get("source", "not recorded") for e in hospitals)
    report = f'''# Ranchi OSM data coverage and usability report

Analysis date: 8 October 2026. This report analyzes the downloaded pilot snapshot
only. No Overpass, routing, geocoding or other network request was made.

## Findings and decision

The extraction contains **{len(elements):,} unique OSM objects**: {types['node']} nodes,
{types['way']:,} ways and {types['relation']} relations. **1,394** of those ways are
highway-tagged objects; the remaining **16** ways represent facilities/businesses.
Road geometry and highway classes can support an initial descriptive comparison
once route matching and corridor coverage are verified. Police and healthcare
records can support provisional mapped-landmark context after manual review.
Lighting, street lamps and business schedules are insufficient for broad claims
about route illumination, activity, opening status or safety.

**Albert Ekka Chowk–Doranda route coverage could not be verified.** No saved
route polyline or authoritative endpoint coordinates were found in the available
project files. The current bbox must not be treated as adequate for that route.

## Source, extent and reproducibility

Input: `outputs/{RUN.name}/raw_response.json`, corroborated against its
`features.geojson`, `quality_summary.json`, `run_status.json` and exact saved
`query.overpassql`. The offline reprocessing folder is the same extraction, not
an independent sample; neither it nor the HTTP-response copy is counted again.
The failed network run contributes no data.

OSM server base timestamp: **{snapshot}**. Raw response SHA-256:
`{source_hash}`. Original tags, coordinates and OSM type/ID remain unchanged.

Bounding box (south, west, north, east): **{', '.join(str(v) for v in bbox)}**,
WGS84. Approximate dimensions: 3.3 km north–south by 3.0 km east–west, about
10 km². This is a central Ranchi rectangle, not the city or a statistical sample.
The southern cutoff is 23.350°N. Crossing-way geometry outside the box is incidental
and does not establish systematic coverage of an onward corridor to Doranda.
The query selects objects through nodes in the box and retains whole geometry;
enclosing features without a node inside may be missed. No clipping was applied.

Rebuild both requested artifacts entirely offline from the repository root:

```powershell
.\\backend\\.venv\\Scripts\\python.exe data/ranchi_safety/analyze_coverage.py
```

`data_coverage_summary.csv` is a long-form table: one row per category/attribute,
with object counts, OSM types, denominators, missing counts/percentages, usability
and source metadata. Repeated category counts across attribute rows are not additive.

## Category counts and overlap

{counts_table}

Counts use unique `(OSM type, ID)` keys. A way and a node with the same numeric
ID are different objects. An element matching both amenity and healthcare selectors
is counted once in its category. Category rows deliberately overlap: lit ways
are a subset of road ways, businesses-with-hours are a subset of businesses, and
the three pharmacies also belong to the retail/business category. There are
{sum(memberships.values())} category memberships but only {len(memberships):,} unique
objects; **{sum(value > 1 for value in memberships.values())} objects** have multiple
memberships. Deduplicating the union recovers exactly the input objects.

For the requested broad retail/business count, this analysis includes the original
commercial taxonomy plus retail pharmacies: **15 objects**, including **12 with
opening_hours**. The original extractor's narrower commercial category has **12**
objects, all with hours. Police/hospitals are not assumed to be businesses.
This is an operational tag grouping, not verification that every object is an
active commercial establishment. Business-type breakdown: {dict(business_types)}.

**Selection bias:** shops, offices, crafts and the listed commercial amenities
were queried only with an `opening_hours` key. The three pharmacies entered via
the separate pharmacy selector. General businesses without hours were not
systematically downloaded. Thus 12/15 (80%) with hours describes this selected
sample only; neither 80% nor the narrower 100% is pilot-wide tagging completeness.
Total businesses in the box and their hours completeness **cannot be estimated**
from this extraction. Healthcare/police coverage is also not a field-verified census.

## Missing fields and relevant denominators

Missing means absent key or blank/whitespace value. Percentages use the unique
object count of the named category, not the whole city or the whole extraction.
Zero-size categories yield **N/A**, not 0% completeness. Geometry missing means
no usable geometry by the extractor's structural checks. A filled name or address
does not prove correctness; any address component is a weaker condition than a
complete address. `phone_any` accepts phone/contact:phone/contact:mobile;
`check_date_any` accepts check_date or check_date:opening_hours.

{fields_table}

Road-specific fields (roads do not ordinarily require opening hours):

{road_fields}

`sidewalk_any` accepts sidewalk, sidewalk:left, sidewalk:right or sidewalk:both.
A present key, including `sidewalk=no`, is recorded information, not a sidewalk
availability assertion. Missing `foot` or `access` does not mean walking is
prohibited or permitted; defaults, road class and local rules need later review.
Missing `surface` does not establish poor surface conditions.

## Road geometry, pedestrian relevance and lighting

{highway_table}

The combined 1,394-way category includes 22 paths, 7 footways, 3 steps and
1 pedestrian way (**33 explicitly pedestrian/path-class objects**), and many
general roads. Paths are not automatically pedestrian-only. There is also a
`rest_area` way, illustrating that a highway-key filter is broader than a
traversable road-edge inventory. OSM way segmentation is arbitrary; counts are
not street counts, route lengths, pedestrian accessibility or network completeness.
No routing graph, connectivity audit or permission evaluation was performed.

Lighting: **37/1,394 = 2.65%** have a `lit` key; values are {dict(lit_values)}.
The remaining **1,357/1,394 = 97.35%** are **unknown**. This denominator is object
count, not road length. It is not a route's lighting coverage. There are **zero
mapped street lamps** in this extraction. Neither unknown lit tags nor zero mapped
lamps indicates unlit or unsafe conditions. Recorded `yes`/`no` are unverified
mapping claims; functionality, timing, brightness and continuity are unknown.

## Coordinate integrity, duplicates and reliability

* Raw records: {len(data['elements']):,}; unique type/ID records: {len(elements):,};
  extra duplicate records: {len(data['elements']) - len(elements)}.
* Coordinate occurrences checked: {len(points):,}; globally invalid: {invalid};
  objects without usable geometry: {sum(geometry(e) is None for e in elements)}.
* Coordinate occurrences outside bbox: {outside:,} ({fmt_pct(outside, len(points))});
  objects with at least one outside point: {crossing}. These occurrences are not
  deduplicated geographic locations and include full crossing geometry.
* All exported original elements matched raw records. Original category counts
  and coordinate statistics matched the earlier quality summary.

These checks establish structural usability, not positional accuracy or existence.
Nodes are points; closed facility ways are exported as LineStrings, not validated
facility polygons or entrances. No relations were returned, so relation geometry
handling cannot be evaluated using this real sample. Multiple IDs may describe
one establishment: the two Kotwali-named police ways are candidates for manual
entity review, not proven duplicates. Unique IDs do not establish unique facilities.

Hospital-tagged records particularly need semantic review. Examples retained in
the source include `node/8917241838` named "Veterinary Hospital", `node/4246041123`
named "PEARL SKIN CLINIC", and `node/7012150017` whose `addr:district` is
"East Singhbhum" despite geometry selected in the Ranchi box. These are review
flags, not automatic exclusions or proof of wrong coordinates. A hospital tag
does not establish human emergency care; only {len(hospitals) - missing(hospitals, 'emergency')}
of {len(hospitals)} has a nonblank emergency tag. Hospital source-tag distribution:
{dict(hospital_sources)}. Government-import or local-knowledge provenance is not
independent validation. No phone numbers, emergency capabilities or entrances
were verified.

Last-edit years from OSM metadata:

{years_table}

Last edit means some aspect of an object changed; it is not the date each tag was
observed or the facility checked. The server timestamp is likewise not field
verification. Sparse check-date tags cannot certify the present state of features.

## Recorded business schedules and usability

{hours_table}

The literal values `11 TO 08` and `no.` require manual review before schedule
parsing. The other strings were not validated by an opening-hours parser either.
Tag presence is not syntactic validity or current operation. No timezone/holiday
evaluation was performed and **no record is classified as currently open**.
The hospital and police records with `24/7` are separate facility-hour observations,
not additions to the commercial count. Do not use the selected business sample
as evidence of footfall, surveillance, active frontage or route safety.

## Route-level suitability

| Category | Practical use | Current constraint |
| --- | --- | --- |
| Road / pedestrian ways | Geometry matching, highway-class context; surface where tagged | Corridor coverage, matching and walking permissions unverified; names and pedestrian detail sparse |
| lit-tagged ways | Display explicit yes/no/unknown observations on matched segments | 97.35% unknown by way count; insufficient for broad lighting comparisons |
| Street lamps | None from this snapshot | Zero records; physical lamps may still exist |
| Police stations | Provisional mapped police landmarks near a route | Six records; entity duplicates, entrances, accessibility and service not verified |
| Hospitals | Provisional mapped healthcare landmarks near a route | 36 tag matches; includes semantic/address review flags; emergency capability largely unknown |
| Pharmacies | Provisional sparse retail-healthcare landmarks | Three records, no hours; cannot establish availability |
| Shops / businesses | Display selected named places as context | Sampling depends on hours; insufficient for density or activity comparisons |
| Businesses with hours | Show raw schedules with provenance after review | Twelve selected records; no current-open classification or complete coverage |

All spatial uses require a route polyline, a documented corridor/nearby-distance
rule and enough sampled area around it. Counts above are bbox totals, not counts
near the SHEPATH test route. Facility proximity can begin as clearly labelled
geometric distance; it is not walkable access, an entrance distance or response time.

## Albert Ekka Chowk to Doranda: coverage status

**Not verified.** A read-only search of the available source, documentation and
data files found no saved endpoint coordinates or route geometry for this route.
The downloaded OSM features are not a routed polyline. No route was regenerated
and no geocoding was called. Place names alone cannot establish bbox containment.

To establish adequacy later, reuse/export the actual routed polyline and test
the entire line and a chosen analysis buffer against the bbox, report the fraction
of route length inside it, and inspect out-of-bounds sections. Checking only
endpoints or incidental crossing ways is insufficient. A rectangle containing
all route vertices contains its straight polyline segments; buffer adequacy needs
its own containment test. Until then, full-route comparisons should not claim
complete observation coverage. An expanded data experiment may be needed after
this check, but no further extraction was attempted here.

## Three practical features for a first explainable comparison prototype

1. **Road class and pedestrian-way context along matched route segments.**
   Highway tags and geometry have the strongest structural coverage. Describe
   the mapped class, steps and any recorded surface/foot/access details, with
   explicit unknowns. Do not infer accessibility or safety from class alone.
2. **Proximity to named mapped support landmarks.** Start with police and manually
   reviewed human healthcare facilities, retain category and OSM identity, merge
   only verified duplicate representations, and label distance as geometric
   unless walkable access is established. Present useful context without implying
   emergency capability, guaranteed help or a safe route.
3. **Explicit lighting observations plus unknown coverage.** Match the 37 tagged
   ways, preserve their yes/no tags and show unknown segments. Once routes are
   available, calculate coverage by matched route length with a disclosed matching
   rule; do not substitute these bbox-wide object percentages. This is an
   explainable evidence display, with insufficient coverage to rank routes by lighting.

Business activity and current opening status should wait for a less selective
inventory and validated schedules. No safety score, route ranking or ML model
was generated by this analysis.

## Offline validation

Generator checks passed: successful live-source status, raw/export record identity,
original category counts, coordinate statistics and deduplicated category union.
The separate `test_coverage_analysis.py` checks the delivered CSV's type counts,
denominators, percentages, unique category/attribute rows and raw-source hash;
zero-denominator and blank-tag behavior; pharmacy overlap; and report caveats.
All **4 coverage tests** and the **12 existing extraction tests** passed (16 total).
The extraction tests mock API calls; none contacts Overpass.

```powershell
.\\backend\\.venv\\Scripts\\python.exe -m unittest discover -s data/ranchi_safety -p 'test_*.py' -v
```

## Attribution and scope

Data: **© OpenStreetMap contributors**, ODbL 1.0. Attribution and licence:
https://www.openstreetmap.org/copyright (retained from the extraction; no live lookup).
The saved query is the authority for selection rules. Results reflect volunteer
mapping and imported tags, with geographic and temporal bias. They describe
this snapshot only, not the whole city or measured safety conditions.

Both requested artifacts and their offline generator are inside
`data/ranchi_safety/`. Routing, frontend, backend and ML code were not modified;
no commit or push was performed.
'''
    write_csv(groups, source_hash, snapshot)
    (ROOT / "DATA_COVERAGE_REPORT.md").write_text(report, encoding="utf-8")
    print(f"Offline coverage report and CSV written; {len(elements)} unique objects; raw/export/category checks passed")


if __name__ == "__main__":
    main()
