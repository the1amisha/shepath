"""Small Ranchi OSM experiment. Python 3.10+, standard library only."""

import argparse
from collections import Counter
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import math
from pathlib import Path
import sys
import time
from urllib import error, parse, request

ROOT = Path(__file__).resolve().parent
# South, west, north, east; about 3.3 x 3.0 km, NOT a city boundary.
BBOX = (23.350, 85.310, 23.380, 85.340)
ENDPOINT = "https://overpass-api.de/api/interpreter"
ATTRIBUTION = "© OpenStreetMap contributors"
CATEGORIES = ("roads_and_pedestrian_ways", "ways_with_lit_tag", "street_lamps",
              "police_stations", "hospitals", "pharmacies", "businesses_with_opening_hours")


def build_query():
    """Union avoids repeating an element that matches several categories."""
    box = ",".join(str(value) for value in BBOX)
    return f'''[out:json][timeout:45];
(
  way["highway"]({box});
  nwr["highway"="street_lamp"]({box});
  nwr["amenity"~"^(police|hospital|pharmacy)$"]({box});
  nwr["healthcare"~"^(hospital|pharmacy)$"]({box});
  nwr["shop"]["opening_hours"]({box});
  nwr["office"]["opening_hours"]({box});
  nwr["craft"]["opening_hours"]({box});
  nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bank|fuel|ice_cream|food_court|car_rental|car_wash)$"]["opening_hours"]({box});
);
out meta geom;
'''


def categories(element):
    tags = element.get("tags", {})
    result = []
    if element.get("type") == "way" and "highway" in tags and tags["highway"] != "street_lamp":
        result.append(CATEGORIES[0])
        if "lit" in tags:
            result.append(CATEGORIES[1])
    if tags.get("highway") == "street_lamp":
        result.append(CATEGORIES[2])
    for value, category in zip(("police", "hospital", "pharmacy"), CATEGORIES[3:6]):
        if tags.get("amenity") == value or (value != "police" and tags.get("healthcare") == value):
            result.append(category)
    commercial_amenities = {"restaurant", "cafe", "fast_food", "bar", "pub", "bank",
                           "fuel", "ice_cream", "food_court", "car_rental", "car_wash"}
    if "opening_hours" in tags and (any(key in tags for key in ("shop", "office", "craft"))
                                   or tags.get("amenity") in commercial_amenities):
        result.append(CATEGORIES[6])
    return result


def valid_point(point):
    lat, lon = point.get("lat"), point.get("lon")
    return all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
               for v in (lat, lon)) and -90 <= lat <= 90 and -180 <= lon <= 180


def coordinate_points(element):
    """Inspect original coordinates, including relation member geometry."""
    if element.get("type") == "node":
        return [element]
    if element.get("type") == "way":
        return element.get("geometry", [])
    points = []
    for member in element.get("members", []):
        if member.get("type") == "node":
            points.append(member)
        points.extend(member.get("geometry", []))
    return points


def geometry(element):
    """Do not invent centroids or join incomplete relation rings."""
    kind = element.get("type")
    if kind == "node":
        return {"type": "Point", "coordinates": [element["lon"], element["lat"]]} if valid_point(element) else None
    if kind == "way":
        points = element.get("geometry", [])
        if len(points) < 2 or not all(valid_point(p) for p in points):
            return None
        return {"type": "LineString", "coordinates": [[p["lon"], p["lat"]] for p in points]}
    members = element.get("members", [])
    parts = [geometry(member) for member in members if member.get("type") in ("node", "way")]
    if not parts or any(part is None for part in parts) or any(m.get("type") == "relation" for m in members):
        return None
    return {"type": "GeometryCollection", "geometries": parts}


def validate_response(data):
    if not isinstance(data, dict) or not isinstance(data.get("elements"), list):
        raise ValueError("Response is not an Overpass JSON elements collection")
    if data.get("remark"):
        raise ValueError("Overpass reported an error/partial response: " + str(data["remark"]))
    for element in data["elements"]:
        if (not isinstance(element, dict) or element.get("type") not in {"node", "way", "relation"}
                or not isinstance(element.get("id"), int) or isinstance(element.get("id"), bool)
                or not isinstance(element.get("tags", {}), dict)):
            raise ValueError("Malformed OSM element; raw response retained for inspection")


def process(data, source):
    validate_response(data)
    counts = Counter()
    missing = {category: Counter() for category in CATEGORIES}
    seen, duplicate_ids, features = set(), [], []
    point_count = invalid_points = outside_points = no_points = 0
    lighting = Counter()
    for element in data["elements"]:
        identity = f'{element["type"]}/{element["id"]}'
        if identity in seen:
            duplicate_ids.append(identity)
            continue
        seen.add(identity)
        groups = categories(element)
        if not groups:
            continue
        tags = element.get("tags", {})
        points = coordinate_points(element)
        no_points += not bool(points)
        for point in points:
            point_count += 1
            if not valid_point(point):
                invalid_points += 1
            elif not (BBOX[0] <= point["lat"] <= BBOX[2] and BBOX[1] <= point["lon"] <= BBOX[3]):
                outside_points += 1
        shape = geometry(element)
        for category in groups:
            counts[category] += 1
            for field in ("name", "opening_hours"):
                if field not in tags or not str(tags[field]).strip():
                    missing[category][field] += 1
            if shape is None:
                missing[category]["usable_geometry"] += 1
        if CATEGORIES[0] in groups:
            lighting["tag_present" if "lit" in tags else "tag_absent_unknown"] += 1
            if "lit" in tags:
                lighting["value:" + str(tags["lit"])] += 1
        features.append({"type": "Feature", "id": identity, "geometry": shape,
                         "properties": {"osm_type": element["type"], "osm_id": element["id"],
                                        "osm_url": f"https://www.openstreetmap.org/{identity}",
                                        "categories": groups, "tags": tags,
                                        "original_osm_element": element, "source": source,
                                        "lighting_interpretation": "unknown" if "lit" not in tags else "tag_recorded_only",
                                        "current_open_status": "not_evaluated"}})
    roads = counts[CATEGORIES[0]]
    summary = {
        "source": source, "raw_element_count": len(data["elements"]),
        "unique_raw_element_count": len(seen), "processed_feature_count": len(features),
        "counts_by_category": {c: counts[c] for c in CATEGORIES},
        "missing_fields_by_category": {c: {f: missing[c][f] for f in ("name", "opening_hours", "usable_geometry")} for c in CATEGORIES},
        "coordinates": {"checked_points": point_count, "invalid_points": invalid_points,
                        "features_without_coordinate_points": no_points,
                        "features_without_usable_geometry": sum(f["geometry"] is None for f in features),
                        "points_outside_pilot_bbox": outside_points},
        "duplicates": {"extra_records_by_osm_type_and_id": len(duplicate_ids), "ids": duplicate_ids},
        "lighting": {"road_way_count": roads, "tag_present": lighting["tag_present"],
                     "tag_absent_unknown": lighting["tag_absent_unknown"],
                     "tag_completeness_percent": round(100 * lighting["tag_present"] / roads, 2) if roads else None,
                     "recorded_values": {k[6:]: v for k, v in lighting.items() if k.startswith("value:")}},
        "notes": ["Counts overlap across categories; ways are OSM objects, not unique streets.",
                  "Missing fields indicate mapping gaps, not real-world absence.",
                  "Absent lit tags mean unknown; present tags are not field verification.",
                  "Opening hours are preserved verbatim; current open status is not evaluated.",
                  "Coordinates outside the box can belong to crossing ways or relations.",
                  "Duplicate detection uses type/id only; separate IDs may describe the same place."]}
    return {"type": "FeatureCollection", "source": source, "features": features}, summary


def retry_delay(header, attempt):
    if header:
        try:
            return max(0, float(header))
        except ValueError:
            try:
                return max(0, (parsedate_to_datetime(header) - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError):
                pass
    return 5 * 2 ** attempt


def fetch(query, endpoint, folder, attempts=3, retry_floor_seconds=0):
    payload = parse.urlencode({"data": query}).encode("utf-8")
    for attempt in range(attempts):
        req = request.Request(endpoint, data=payload, headers={
            "User-Agent": "SHEPATH-Ranchi-OSM-experiment/0.1", "Accept": "application/json"})
        try:
            with request.urlopen(req, timeout=60) as response:
                raw = response.read()
            # Preserve the exact successful HTTP body, even if it reports an API error.
            (folder / f"response_attempt_{attempt + 1}.json").write_bytes(raw)
            data = json.loads(raw)
            validate_response(data)
            return data, raw
        except error.HTTPError as exc:
            (folder / f"http_error_{attempt + 1}.txt").write_bytes(exc.read())
            if exc.code not in {429, 500, 502, 503, 504}:
                raise RuntimeError(f"Overpass HTTP {exc.code}; error body saved") from exc
            delay = retry_delay(exc.headers.get("Retry-After"), attempt)
        except (error.URLError, TimeoutError, OSError, ValueError) as exc:
            delay = retry_delay(None, attempt)
            print(f"Attempt {attempt + 1} failed: {exc}", file=sys.stderr)
        if attempt + 1 < attempts:
            delay = max(delay, retry_floor_seconds)
            # Respect long server cooldowns by stopping instead of retrying early.
            if delay > 60:
                raise RuntimeError(f"Server requested a {delay:.0f}s cooldown; retry manually later")
            print(f"Retrying in {delay:.0f}s", file=sys.stderr)
            time.sleep(delay)
    raise RuntimeError("Overpass extraction failed after bounded retries; extraction remains unverified")


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Process an existing Overpass JSON offline; does not contact OSM")
    parser.add_argument("--endpoint", default=ENDPOINT, help="Overpass interpreter URL")
    args = parser.parse_args()
    # Each run is isolated so a failed run cannot masquerade as an earlier success.
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    folder = ROOT / "outputs" / stamp
    folder.mkdir(parents=True)
    query = build_query()
    (folder / "query.overpassql").write_text(query, encoding="utf-8")
    source = {"attribution": ATTRIBUTION, "license": "ODbL 1.0",
              "license_url": "https://www.openstreetmap.org/copyright",
              "bbox_south_west_north_east": BBOX, "run_time_utc": stamp,
              "mode": "offline_reprocessing" if args.input else "live_overpass",
              "endpoint": None if args.input else args.endpoint,
              "input_file": str(args.input.resolve()) if args.input else None}
    try:
        if args.input:
            raw = args.input.read_bytes()
            (folder / "raw_response.json").write_bytes(raw)
            data = json.loads(raw)
        else:
            data, raw = fetch(query, args.endpoint, folder)
            (folder / "raw_response.json").write_bytes(raw)
        validate_response(data)
        source["osm_base_timestamp"] = data.get("osm3s", {}).get("timestamp_osm_base")
        collection, summary = process(data, source)
        write_json(folder / "features.geojson", collection)
        write_json(folder / "quality_summary.json", summary)
        write_json(folder / "run_status.json", {"status": "success", "source": source})
        print(f"Saved {len(collection['features'])} features and quality summary to {folder}")
        return 0
    except (RuntimeError, ValueError, OSError, error.URLError) as exc:
        write_json(folder / "run_status.json", {"status": "failed", "error": str(exc), "source": source,
                                               "extraction_verified": False})
        print(f"Extraction remains unverified: {exc}. Details: {folder}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
