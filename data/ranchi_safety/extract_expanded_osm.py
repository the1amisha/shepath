"""Phase 4B: derive and validate an expanded extent, then extract a new OSM snapshot."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

import extract_osm as original
import verify_route_coverage as coverage
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parent
ROUTE_RUN = ROOT / "route_coverage_runs" / "20261008T140112_006152Z"
COMMERCIAL = {"restaurant", "cafe", "fast_food", "bar", "pub", "bank", "fuel", "ice_cream",
              "food_court", "car_rental", "car_wash", "pharmacy", "marketplace"}
LODGING = {"hotel", "motel", "hostel", "guest_house"}
MEDICAL = {"hospital", "clinic", "doctors", "dentist", "nursing_home", "health_post", "pharmacy"}
GROUPS = ("roads_and_pedestrian_ways", "pedestrian_infrastructure", "ways_with_lit_tag", "street_lamps",
          "police_stations", "healthcare_facilities", "hospitals", "pharmacies", "shops_and_businesses",
          "businesses_with_opening_hours")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def projected_box(bbox):
    south, west, north, east = bbox
    ring = coverage.densify([(west, south), (east, south), (east, north), (west, north), (west, south)])
    return transform(coverage.TO_METRES.transform, Polygon(ring))


def derive_boundary(routes, old_bbox, margin_metres=50):
    """Include original pilot plus a route-derived 100m corridor and 50m margin."""
    if not coverage.finite(margin_metres) or margin_metres < 10 or margin_metres > 500:
        raise ValueError("Margin must be finite and between 10 and 500 metres")
    corridors = []
    for route in routes:
        coords = [(lon, lat) for lat, lon in route["coordinates"]]
        metric = transform(coverage.TO_METRES.transform, LineString(coverage.densify(coords)))
        corridors.append(metric.buffer(100, quad_segs=coverage.ARC_SEGMENTS))
    union = unary_union(corridors)
    with_margin = union.buffer(margin_metres, quad_segs=coverage.ARC_SEGMENTS)
    # Densify the metric envelope before inverse projection to retain extrema.
    rectangle = with_margin.envelope
    ring = list(rectangle.exterior.coords)
    dense = [ring[0]]
    for start, end in zip(ring, ring[1:]):
        steps = max(1, math.ceil(math.dist(start, end) / 25))
        dense.extend((start[0] + (end[0] - start[0]) * i / steps,
                      start[1] + (end[1] - start[1]) * i / steps) for i in range(1, steps + 1))
    left, bottom, right, top = transform(coverage.TO_WGS84.transform, Polygon(dense)).bounds
    # Preserve the entire old pilot as well as the route-derived envelope.
    bbox = [math.floor(min(bottom, old_bbox[0]) * 1e6) / 1e6,
            math.floor(min(left, old_bbox[1]) * 1e6) / 1e6,
            math.ceil(max(top, old_bbox[2]) * 1e6) / 1e6,
            math.ceil(max(right, old_bbox[3]) * 1e6) / 1e6]
    projected = projected_box(bbox)
    if not projected.covers(with_margin):
        raise ValueError("Derived boundary does not contain the corridor plus margin")
    metrics = [coverage.measure_route(route, bbox, 100)[0] for route in routes]
    if not all(m["centerline_fully_covered"] and m["analysis_buffer"]["fully_covered"] for m in metrics):
        raise ValueError("Derived boundary failed complete route/buffer containment")
    return bbox, metrics, union


def build_query(bbox):
    b = ",".join(str(v) for v in bbox)
    medical = "|".join(sorted(MEDICAL))
    commercial = "|".join(sorted(COMMERCIAL))
    lodging = "|".join(sorted(LODGING))
    return f'''[out:json][timeout:45];
(
  way["highway"]({b});
  nwr["highway"~"^(street_lamp|crossing|traffic_signals|elevator|steps|footway|path|pedestrian)$"]({b});
  nwr["crossing"]({b});
  nwr["kerb"]({b});
  nwr["barrier"]({b});
  nwr["sidewalk"]({b});
  nwr["amenity"="police"]({b});
  nwr["healthcare"]({b});
  nwr["amenity"~"^({medical})$"]({b});
  nwr["shop"]({b});
  nwr["office"]({b});
  nwr["craft"]({b});
  nwr["amenity"~"^({commercial})$"]({b});
  nwr["tourism"~"^({lodging})$"]({b});
);
out meta geom;
'''


def categories(element):
    t = element.get("tags", {})
    groups = []
    if element["type"] == "way" and "highway" in t and t["highway"] != "street_lamp":
        groups.append("roads_and_pedestrian_ways")
        if "lit" in t:
            groups.append("ways_with_lit_tag")
    if (t.get("highway") in {"crossing", "traffic_signals", "elevator", "steps", "footway", "path", "pedestrian"}
            or any(k in t for k in ("crossing", "kerb", "barrier", "sidewalk"))):
        groups.append("pedestrian_infrastructure")
    if t.get("highway") == "street_lamp":
        groups.append("street_lamps")
    if t.get("amenity") == "police":
        groups.append("police_stations")
    if "healthcare" in t or t.get("amenity") in MEDICAL:
        groups.append("healthcare_facilities")
    if t.get("amenity") == "hospital" or t.get("healthcare") == "hospital":
        groups.append("hospitals")
    if t.get("amenity") == "pharmacy" or t.get("healthcare") == "pharmacy":
        groups.append("pharmacies")
    if (any(k in t for k in ("shop", "office", "craft")) or t.get("amenity") in COMMERCIAL
            or t.get("healthcare") == "pharmacy" or t.get("tourism") in LODGING):
        groups.append("shops_and_businesses")
        if "opening_hours" in t:
            groups.append("businesses_with_opening_hours")
    return groups


def nonblank(tags, keys):
    return any(k in tags and str(tags[k]).strip() for k in keys)


def assess(data, bbox, source):
    original.validate_response(data)
    unique, duplicates, conflicting = {}, [], []
    for e in data["elements"]:
        key = (e["type"], e["id"])
        if key in unique:
            duplicates.append(f"{key[0]}/{key[1]}")
            if unique[key] != e:
                conflicting.append(f"{key[0]}/{key[1]}")
        else:
            unique[key] = e
    if conflicting:
        raise ValueError("Conflicting duplicate OSM IDs; snapshot not accepted")
    groups = {k: [] for k in GROUPS}
    features = []
    invalid = point_count = outside = missing_coords = 0
    for (kind, identity), e in unique.items():
        memberships = categories(e)
        for group in memberships:
            groups[group].append(e)
        points = original.coordinate_points(e)
        missing_coords += not bool(points)
        for p in points:
            point_count += 1
            if not original.valid_point(p):
                invalid += 1
            elif not (bbox[0] <= p["lat"] <= bbox[2] and bbox[1] <= p["lon"] <= bbox[3]):
                outside += 1
        features.append({"type": "Feature", "id": f"{kind}/{identity}", "geometry": original.geometry(e),
                         "properties": {"osm_type": kind, "osm_id": identity, "categories": memberships,
                                        "tags": e.get("tags", {}), "original_osm_element": e,
                                        "osm_url": f"https://www.openstreetmap.org/{kind}/{identity}", "source": source,
                                        "current_open_status": "not_evaluated"}})
    roads = groups["roads_and_pedestrian_ways"]
    businesses = groups["shops_and_businesses"]
    def completeness(elements, keys):
        n = len(elements)
        present = sum(nonblank(e.get("tags", {}), keys) for e in elements)
        keyed = sum(any(k in e.get("tags", {}) for k in keys) for e in elements)
        return {"denominator": n, "key_present": keyed, "nonblank": present, "missing_or_blank": n - present,
                "nonblank_percent": round(100 * present / n, 4) if n else None}
    # Candidate duplicate facilities: same normalized name and <=100m geometry distance.
    facilities = [e for e in unique.values() if any(c in categories(e) for c in
                  ("police_stations", "healthcare_facilities", "shops_and_businesses"))]
    named = {}
    candidates = []
    for e in facilities:
        name = " ".join(str(e.get("tags", {}).get("name", "")).casefold().split())
        geom = original.geometry(e)
        if not name or geom is None:
            continue
        metric = transform(coverage.TO_METRES.transform, shape(geom))
        for previous, previous_shape in named.get(name, []):
            distance = metric.distance(previous_shape)
            if distance <= 100:
                candidates.append({"name": e["tags"]["name"],
                                   "osm_ids": [f"{previous['type']}/{previous['id']}", f"{e['type']}/{e['id']}"],
                                   "geometry_distance_metres": distance,
                                   "status": "potential_duplicate_requires_manual_review"})
        named.setdefault(name, []).append((e, metric))
    summary = {"source": source, "raw_record_count": len(data["elements"]), "unique_records": len(unique),
               "osm_types": dict(Counter(e["type"] for e in unique.values())),
               "counts_by_category": {c: len(g) for c, g in groups.items()},
               "types_by_category": {c: {k: sum(e["type"] == k for e in g) for k in ("node", "way", "relation")} for c, g in groups.items()},
               "duplicate_osm_records": duplicates, "unclassified_records": sum(not categories(e) for e in unique.values()),
               "coordinates": {"checked_occurrences": point_count, "invalid": invalid, "outside_bbox": outside,
                               "records_without_coordinate_points": missing_coords,
                               "records_without_usable_geometry": sum(f["geometry"] is None for f in features)},
               "road_lighting": completeness(roads, ("lit",)),
               "road_sidewalk": completeness(roads, ("sidewalk", "sidewalk:left", "sidewalk:right", "sidewalk:both")),
               "recorded_lit_values": dict(Counter(e["tags"]["lit"] for e in roads if "lit" in e["tags"])),
               "recorded_sidewalk_values": dict(Counter(f"{k}={v}" for e in roads for k, v in e["tags"].items() if k in
                                                         ("sidewalk", "sidewalk:left", "sidewalk:right", "sidewalk:both"))),
               "business_opening_hours": completeness(businesses, ("opening_hours",)),
               "business_hours_values": dict(Counter(e["tags"]["opening_hours"] for e in businesses if "opening_hours" in e["tags"])),
               "potential_facility_duplicates": candidates,
               "missing_names_by_category": {c: sum(not nonblank(e.get("tags", {}), ("name",)) for e in g) for c, g in groups.items()},
               "missing_edit_timestamps": sum(not e.get("timestamp") for e in unique.values()),
               "response_completeness": "Valid Overpass elements response with no remark; no partial responses merged; not a field inventory guarantee"}
    return {"type": "FeatureCollection", "source": source, "features": features}, summary


def prepare(folder, margin):
    report = ROOT / "ROUTE_COVERAGE_REPORT.md"
    report.read_text(encoding="utf-8")
    saved = load_json(ROUTE_RUN / "routes.json")
    coverage.validate_routes(saved)
    if saved.get("request") != coverage.ROUTE_REQUEST or len(saved["routes"]) != 3:
        raise ValueError("Expected the three saved Ranchi walking routes")
    prior = load_json(ROUTE_RUN / "coverage_results.json")
    uncovered = load_json(ROUTE_RUN / "uncovered_areas.geojson")
    old_bbox, old_source = coverage.read_snapshot(coverage.DEFAULT_SNAPSHOT)
    bbox, route_metrics, corridors = derive_boundary(saved["routes"], old_bbox, margin)
    ids = {r["id"] for r in saved["routes"]}
    if {r["route_id"] for r in prior["routes"]} != ids:
        raise ValueError("Saved coverage/route IDs disagree")
    for feature in uncovered["features"]:
        if feature["properties"]["route_id"] not in ids:
            raise ValueError("Uncovered-area route ID is not in saved routes")
        if not box(bbox[1], bbox[0], bbox[3], bbox[2]).covers(shape(feature["geometry"])):
            raise ValueError("Expanded boundary fails to contain a previously uncovered area")
    provenance = {str(p.relative_to(ROOT)): sha(p) for p in [report, ROUTE_RUN / "routes.json",
                  ROUTE_RUN / "coverage_results.json", ROUTE_RUN / "uncovered_areas.geojson"]}
    plan = {"bbox_south_west_north_east": bbox, "original_bbox": old_bbox, "analysis_buffer_metres": 100,
            "extra_margin_metres": margin, "construction": "Envelope of metric route-buffer union plus margin, union original pilot bbox; outward rounded to 6 decimals",
            "geometric_validation_before_download": "all three centerlines, full 100m buffers, buffer-plus-margin union and prior uncovered geometry contained",
            "saved_route_retrieved_at_utc": saved["retrieved_at_utc"], "input_sha256": provenance,
            "original_snapshot": old_source, "route_coverage": route_metrics}
    original.write_json(folder / "boundary_plan.json", plan)
    original.write_json(folder / "route_buffers.geojson", {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"kind": "saved_route_buffer_union", "buffer_metres": 100},
         "geometry": mapping(transform(coverage.TO_WGS84.transform, corridors))},
        {"type": "Feature", "properties": {"kind": "expanded_extraction_bbox"}, "geometry": mapping(box(bbox[1], bbox[0], bbox[3], bbox[2]))}]})
    return plan, saved


def report(folder, plan, summary=None, failure=None):
    text = f'''# Phase 4B — expanded Ranchi OSM coverage

Run: `{folder.relative_to(ROOT)}`. Expanded bbox (south, west, north, east):
**{plan['bbox_south_west_north_east']}**. Original bbox: **{plan['original_bbox']}**.
The boundary uses the actual saved three walking geometries, their 100 m union
corridor, a **{plan['extra_margin_metres']:g} m extra margin**, and the whole original
pilot rectangle. Metric envelope edges were densified, inverse-projected and
rounded outward to six decimal degrees. Before downloading, geometric checks
confirmed containment of every centerline, complete buffer, margin union and
previously uncovered geometry. It remains a selected Ranchi pilot extent, not
the entire city. `boundary_plan.json` records exact source-file hashes.

## Geographic route coverage against the new boundary

| Route ID | Original length inside | Expanded length inside | Expanded length outside | Expanded buffer area inside | Full buffer covered |
| --- | ---: | ---: | ---: | ---: | --- |
'''
    previous = load_json(ROUTE_RUN / "coverage_results.json")
    by_id = {r["route_id"]: r for r in previous["routes"]}
    for r in plan["route_coverage"]:
        text += f"| {r['route_id']} | {by_id[r['route_id']]['inside_percent']:.4f}% | {r['inside_percent']:.4f}% | {r['outside_percent']:.4f}% | {r['analysis_buffer']['inside_percent']:.4f}% | {r['analysis_buffer']['fully_covered']} |\n"
    text += "\nThese geometric calculations use the previous validated clipping/ellipsoid and UTM-buffer method; they do not fetch new routes.\n"
    if summary is None:
        text += f"\n## Extraction status\n\n**{failure or 'Boundary validated; extraction has not been attempted.'}**\nNo extracted feature counts are claimed. Geographic containment of a planned box does not establish successful data acquisition.\n"
        text += "\nThe 100% entries above describe the proposed geographic extent only. They do not establish a downloaded dataset, complete feature inventory or successful extraction.\n"
        text += "\n## Comparison available before successful extraction\n\n"
        old_data = load_json(coverage.DEFAULT_SNAPSHOT / "raw_response.json")
        _, baseline = assess(old_data, plan["original_bbox"], {})
        text += "| Same analytical category | Original objects | Expanded downloaded objects |\n| --- | ---: | --- |\n"
        for c in GROUPS:
            text += f"| {c} | {baseline['counts_by_category'][c]} | unavailable / unverified |\n"
        text += f"\nOriginal unique records: {baseline['unique_records']}. No expanded records are claimed; this is not a zero-feature result.\n"
        for label, key in [("Lighting", "road_lighting"), ("Sidewalk", "road_sidewalk"), ("Business opening hours", "business_opening_hours")]:
            value = baseline[key]
            text += f"\n{label}: original {value['nonblank']}/{value['denominator']} nonblank ({value['nonblank_percent']}%); expanded completeness unavailable.\n"
        text += "\nThe new query deliberately removes the opening-hours filter, expands healthcare/infrastructure/business taxonomy and expands the area. Future count differences will reflect both extent and selector changes, not measured real-world growth. Quality checks on an expanded dataset cannot run until a valid complete response is acquired.\n"
        text += "\nThe original opening-hours percentage describes the biased selected sample only: general businesses required an hours tag to enter the original query; the three retail pharmacies entered separately. It is not pilot-wide business-hours completeness.\n"
        errors = sorted(folder.glob("http_error_*.txt"))
        for path in errors:
            body = path.read_text(encoding="utf-8", errors="replace")
            diagnosis = ("Overpass dispatcher timeout: server reported too busy" if "probably too busy" in body else
                         "HTTP 500 Internal Server Error page" if "500 Internal Server Error" in body else
                         "HTTP error body retained; inspect file")
            text += f"\nTransport evidence: `{path.name}` — {diagnosis}.\n"
    else:
        old = load_json(coverage.DEFAULT_SNAPSHOT / "raw_response.json")
        old_collection, old_summary = assess(old, plan["original_bbox"], {})
        source = summary["source"]
        text += f'''
## Snapshot provenance and response integrity

Unique expanded OSM records: **{summary['unique_records']}**; OSM types:
{summary['osm_types']}. Base timestamp: `{source['osm_base_timestamp']}`.
Retrieval UTC: `{source['retrieved_at_utc']}`. Raw SHA-256:
`{source['raw_response_sha256']}`. Exact request is `query.overpassql`;
`raw_response.json` preserves response bytes and `features.geojson` preserves
every original element with IDs, tags, geometry, timestamps and attribution.
GeoJSON coordinates are [longitude, latitude]; saved backend routes remain
[latitude, longitude]. No previous snapshots or reports were overwritten.

Response integrity: {summary['response_completeness']}.
Duplicate type/ID records: {len(summary['duplicate_osm_records'])}; unclassified
records: {summary['unclassified_records']}; missing edit timestamps:
{summary['missing_edit_timestamps']}. The snapshot is standalone: old and new
responses were not merged. HTTP errors/partial remarks never count as a success.

## Original versus expanded categories

| Category (same analytical definition) | Original objects | Expanded objects | Expanded nodes | Expanded ways | Expanded relations |
| --- | ---: | ---: | ---: | ---: | ---: |
'''
        for c in GROUPS:
            t = summary["types_by_category"][c]
            text += f"| {c} | {old_summary['counts_by_category'][c]} | {summary['counts_by_category'][c]} | {t['node']} | {t['way']} | {t['relation']} |\n"
        text += f"\nUnique record totals: original **{old_summary['unique_records']}**, expanded **{summary['unique_records']}**. Category counts overlap and must not be summed.\n"
        old_ids = {f["id"] for f in old_collection["features"]}
        new_ids = {f"{e['type']}/{e['id']}" for e in load_json(folder / "raw_response.json")["elements"]}
        text += f"\nShared IDs: {len(old_ids & new_ids)}; new-only IDs: {len(new_ids - old_ids)}; original-only IDs: {len(old_ids - new_ids)}. These are object comparisons, not real-world openings/closures.\n"
        text += '''
The original query selected general businesses only when `opening_hours` existed.
The new query includes shop/office/craft tags regardless of hours, relevant
commercial amenities (including retail pharmacies/marketplaces) and lodging
tags. It also broadens healthcare beyond hospital/pharmacy tags and adds
pedestrian infrastructure (crossings, kerbs, barriers, signals and tagged ways).
All highway way tags, including surface, foot, access, sidewalk and lit, are retained.
This documented taxonomy is not an exhaustive business or infrastructure census.
Historical-category values above are recomputed using this same new analytical
definition on the old response; they do not add missing old data.

**Counts changed because the extent and query selection both changed**, and the
two snapshots may also have different base times. Increased counts do not measure
mapping improvement, actual facility growth or better safety. Expanding to include
the original box permits ID comparisons but does not remove the original sampling bias.

## Tag completeness and coordinates

| Attribute / denominator | Original nonblank | Expanded nonblank | Expanded key present | Expanded missing/blank | Expanded nonblank completeness |
| --- | ---: | ---: | ---: | ---: | ---: |
'''
        for label, key in [("lit / road ways", "road_lighting"), ("any sidewalk tag / road ways", "road_sidewalk"),
                           ("opening_hours / businesses", "business_opening_hours")]:
            a, b = old_summary[key], summary[key]
            text += f"| {label} | {a['nonblank']}/{a['denominator']} | {b['nonblank']}/{b['denominator']} | {b['key_present']} | {b['missing_or_blank']} | {b['nonblank_percent']}% |\n"
        text += f'''
Recorded lit values: {summary['recorded_lit_values']}.
Recorded sidewalk values (each key/value occurrence): {summary['recorded_sidewalk_values']}.
Coordinates: {summary['coordinates']}.

Absent lighting and sidewalk tags mean **unknown**, not absent infrastructure or
unsafe conditions. Nonblank counts include explicit `no`, which is recorded
information rather than availability. Side-specific tags are grouped once per
road for completeness; value tallies may contain multiple keys per road. Highway
objects are segmented OSM ways, not unique streets or road kilometres.
Outside-box coordinates can belong to whole ways selected through in-box nodes;
they are reported rather than silently clipped. Null geometry is retained and
flagged; valid global coordinates do not verify location accuracy. Closed facility
ways are exported as LineStrings; complex relation completeness/entrances need review.

Business hours are retained verbatim, with key-present and nonblank denominators
reported separately. No parser, holiday, timezone or current-operation evaluation
was performed; tag completeness does not mean a business is open. Unlike the
old biased sample, missing hours are now observable in the queried taxonomy.

## Potential facility duplicates and manual review

Potential duplicate pairs: **{len(summary['potential_facility_duplicates'])}**.
Candidates require the same casefolded/whitespace-normalized name and ≤100 m
minimum geometry distance. They are retained, not merged. This heuristic can
miss differently named duplicates and flag separate branches or generic names.
Full candidate IDs/distances are in `quality_summary.json`.

'''
        for candidate in summary["potential_facility_duplicates"][:25]:
            text += f"* {candidate['name']}: {', '.join(candidate['osm_ids'])}, {candidate['geometry_distance_metres']:.2f} m; manual review required.\n"
        text += '''
Hospitals and healthcare are tag matches, not verified human emergency services;
vet/clinic/specialist records, inconsistent addresses, import provenance and node/area
representations still need manual review. Police tags do not guarantee access,
staffing or response. Name, address and edit metadata do not prove current validity.
'''
    text += '''
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
'''
    (folder / "EXPANDED_DATA_COVERAGE_REPORT.md").write_text(text, encoding="utf-8")
    (ROOT / "EXPANDED_DATA_COVERAGE_REPORT.md").write_text(text, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan-only", action="store_true", help="Validate/save proposed boundary with no network access")
    parser.add_argument("--margin-metres", type=float, default=50)
    parser.add_argument("--endpoint", default=original.ENDPOINT)
    parser.add_argument("--attempts", type=int, choices=(1, 2, 3), default=2)
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    folder = ROOT / "expanded_outputs" / stamp
    folder.mkdir(parents=True)
    plan, saved = prepare(folder, args.margin_metres)
    query = build_query(plan["bbox_south_west_north_east"])
    (folder / "query.overpassql").write_text(query, encoding="utf-8")
    original.write_json(folder / "route_coverage.json", {"retrieved_at_utc": saved["retrieved_at_utc"], "routes": plan["route_coverage"]})
    if args.plan_only:
        original.write_json(folder / "run_status.json", {"status": "planned", "network_requested": False})
        report(folder, plan)
        print(f"Boundary validated before download: {plan['bbox_south_west_north_east']}; plan: {folder}")
        return 0
    original.write_json(folder / "request_provenance.json", {"endpoint": args.endpoint, "max_attempts": args.attempts,
                                                              "query_sha256": hashlib.sha256(query.encode()).hexdigest(),
                                                              "request_started_at_utc": coverage.utc_now()})
    try:
        data, raw = original.fetch(query, args.endpoint, folder, attempts=args.attempts, retry_floor_seconds=30)
        (folder / "raw_response.json").write_bytes(raw)
        if not data["elements"]:
            raise ValueError("Unexpected empty response in this populated pilot; extraction unverified")
        source = {"attribution": original.ATTRIBUTION, "license": "ODbL 1.0",
                  "license_url": "https://www.openstreetmap.org/copyright", "phase": "4B",
                  "bbox_south_west_north_east": plan["bbox_south_west_north_east"],
                  "retrieved_at_utc": coverage.utc_now(), "run_time_utc": stamp, "mode": "live_overpass",
                  "endpoint": args.endpoint, "osm_base_timestamp": data.get("osm3s", {}).get("timestamp_osm_base"),
                  "raw_response_sha256": hashlib.sha256(raw).hexdigest(),
                  "query_sha256": hashlib.sha256(query.encode()).hexdigest(),
                  "route_source_sha256": plan["input_sha256"], "business_selection": "No opening_hours filter"}
        collection, summary = assess(data, plan["bbox_south_west_north_east"], source)
        original.write_json(folder / "features.geojson", collection)
        original.write_json(folder / "quality_summary.json", summary)
        original.write_json(folder / "run_status.json", {"status": "success", "source": source})
        report(folder, plan, summary)
        print(f"Expanded extraction succeeded: {summary['unique_records']} unique records; {folder}")
        print(json.dumps(summary["counts_by_category"]))
        return 0
    except (OSError, ValueError, RuntimeError) as exc:
        original.write_json(folder / "run_status.json", {"status": "failed", "extraction_verified": False, "error": str(exc),
                                                        "endpoint": args.endpoint, "max_attempts": args.attempts,
                                                        "geographic_plan_validated": True})
        report(folder, plan, failure=f"Extraction failed; unverified: {exc}")
        print(f"Expanded extraction failed; no completeness claims: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
