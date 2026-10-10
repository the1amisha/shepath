"""Metadata-only Geofabrik investigation. Never GETs an OSM PBF."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import shutil
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / ".route_coverage_deps"))
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

URLS = {
    "eastern_latest": "https://download.geofabrik.de/asia/india/eastern-zone-latest.osm.pbf",
    "eastern_dated": "https://download.geofabrik.de/asia/india/eastern-zone-261006.osm.pbf",
    "india_latest_fallback": "https://download.geofabrik.de/asia/india-latest.osm.pbf",
}
POLY_URL = "https://download.geofabrik.de/asia/india/eastern-zone.poly"


def poly_geometry(text):
    lines = iter(text.splitlines()[1:])
    shells, holes = [], []
    for line in lines:
        label = line.strip()
        if not label:
            continue
        if label == "END":
            break
        ring = []
        for coordinate in lines:
            if coordinate.strip() == "END":
                break
            lon, lat = map(float, coordinate.split())
            ring.append((lon, lat))
        (holes if label.startswith("!") else shells).append(Polygon(ring))
    geometry = unary_union(shells)
    if holes:
        geometry = geometry.difference(unary_union(holes))
    if geometry.is_empty or not geometry.is_valid:
        raise ValueError("Provider polygon is empty/invalid")
    return geometry


def main():
    folder = ROOT / "pbf_source_checks" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    folder.mkdir(parents=True)
    plan_path = ROOT / "expanded_outputs/20261008T142703_316466Z/boundary_plan.json"
    bbox = json.loads(plan_path.read_text(encoding="utf-8"))["bbox_south_west_north_east"]
    result = {"checked_at_utc": datetime.now(timezone.utc).isoformat(), "pbf_downloaded": False,
              "bbox_south_west_north_east": bbox, "head_checks": {},
              "local_python": sys.version.split()[0], "local_architecture": platform.machine(),
              "disk_free_bytes": shutil.disk_usage(ROOT).free,
              "boundary_metadata_sha256": hashlib.sha256(plan_path.read_bytes()).hexdigest()}
    for label, url in URLS.items():
        try:
            with urlopen(Request(url, method="HEAD", headers={"User-Agent": "SHEPATH-PBF-source-check/0.1"}), timeout=20) as response:
                result["head_checks"][label] = {"requested_url": url, "final_url": response.url,
                    "status": response.status, "content_length": response.headers.get("Content-Length"),
                    "last_modified": response.headers.get("Last-Modified"), "etag": response.headers.get("ETag"),
                    "accept_ranges": response.headers.get("Accept-Ranges"), "content_type": response.headers.get("Content-Type")}
        except OSError as exc:
            result["head_checks"][label] = {"requested_url": url, "error": str(exc)}
    try:
        with urlopen(POLY_URL, timeout=20) as response:
            raw = response.read(131073)
        if len(raw) > 131072:
            raise ValueError("Polygon exceeds small-metadata download limit")
        (folder / "eastern-zone.poly").write_bytes(raw)
        geometry = poly_geometry(raw.decode())
        south, west, north, east = bbox
        result["provider_boundary"] = {"url": POLY_URL, "bytes_downloaded": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(), "covers_entire_pilot_bbox": geometry.covers(box(west, south, east, north))}
    except (OSError, ValueError) as exc:
        result["provider_boundary"] = {"url": POLY_URL, "error": str(exc)}
    (folder / "source_verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    print("Evidence folder:", folder)
    return 0 if result.get("provider_boundary", {}).get("covers_entire_pilot_bbox") and result["head_checks"]["eastern_latest"].get("status") == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())
