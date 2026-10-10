"""Call SHEPATH's local /route API and compare real geometry with the saved OSM box."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib import error, parse, request

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / ".route_coverage_deps"))
try:
    import pyproj
    import shapely
    from pyproj import Geod, Transformer
    from shapely.geometry import LineString, Polygon, box, mapping
    from shapely.ops import transform
except ImportError as exc:
    raise SystemExit("Install route_coverage_requirements.txt into .route_coverage_deps; see ROUTE_COVERAGE_README.md") from exc

DEFAULT_SNAPSHOT = ROOT / "outputs" / "20261008T133610_076939Z"
ROUTE_REQUEST = {"origin": "Albert Ekka Chowk, Ranchi", "destination": "Doranda, Ranchi", "travelMode": "walk"}
GEOD = Geod(ellps="WGS84")
TO_METRES = Transformer.from_crs("EPSG:4326", "EPSG:32645", always_xy=True)
TO_WGS84 = Transformer.from_crs("EPSG:32645", "EPSG:4326", always_xy=True)
STEP_METRES = 25
ARC_SEGMENTS = 64


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")


def inside_workspace(path):
    resolved = path.resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError("Experiment inputs must be inside data/ranchi_safety/")
    return resolved


def read_snapshot(folder):
    folder = inside_workspace(folder)
    metadata = json.loads((folder / "run_status.json").read_text(encoding="utf-8"))
    if metadata.get("status") != "success":
        raise ValueError("OSM snapshot is not a successful extraction")
    source = metadata["source"]
    bbox = source["bbox_south_west_north_east"]
    if (len(bbox) != 4 or not all(finite(v) for v in bbox)
            or not (-90 <= bbox[0] < bbox[2] <= 90 and -180 <= bbox[1] < bbox[3] <= 180)):
        raise ValueError("Invalid saved bounding box")
    raw = (folder / "raw_response.json").read_bytes()
    return bbox, {"snapshot_folder": str(folder.relative_to(ROOT)), "source": source,
                  "raw_response_sha256": hashlib.sha256(raw).hexdigest()}


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_routes(response):
    if not isinstance(response, dict) or not isinstance(response.get("routes"), list) or not response["routes"]:
        raise ValueError("Backend response contained no usable routes")
    ids = set()
    for route in response["routes"]:
        if not isinstance(route, dict) or not isinstance(route.get("id"), str) or not route["id"]:
            raise ValueError("Route is missing its string ID")
        if route["id"] in ids:
            raise ValueError("Backend returned duplicate route IDs")
        ids.add(route["id"])
        for field in ("distanceMeters", "durationSeconds"):
            if not finite(route.get(field)) or route[field] < 0:
                raise ValueError("Invalid route " + field)
        coords = route.get("coordinates")
        if not isinstance(coords, list) or len(coords) < 2:
            raise ValueError("Route requires at least two coordinates")
        for coordinate in coords + [route.get("startPoint"), route.get("endPoint")]:
            if (not isinstance(coordinate, list) or len(coordinate) != 2
                    or not all(finite(v) for v in coordinate)
                    or not (-90 <= coordinate[0] <= 90 and -180 <= coordinate[1] <= 180)):
                raise ValueError("Invalid backend [latitude, longitude] coordinate")
        if route["startPoint"] != coords[0] or route["endPoint"] != coords[-1]:
            raise ValueError("Route endpoints disagree with coordinates")


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Local backend redirected the request; refusing redirection")


def fetch_routes(base_url, folder):
    url = parse.urlsplit(base_url)
    if (url.scheme not in {"http", "https"} or url.hostname not in {"localhost", "127.0.0.1", "::1"}
            or url.username or url.password or url.query or url.fragment or url.path not in {"", "/"}):
        raise ValueError("--base-url must be a loopback backend base URL without credentials")
    endpoint = base_url.rstrip("/") + "/route"
    req = request.Request(endpoint, data=json.dumps(ROUTE_REQUEST).encode(),
                          headers={"Content-Type": "application/json", "Accept": "application/json"})
    # Explicitly bypass proxy settings for this loopback-only request.
    opener = request.build_opener(request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(req, timeout=90) as response:
            raw = response.read()
    except error.HTTPError as exc:
        (folder / "backend_error_body.txt").write_bytes(exc.read())
        raise RuntimeError(f"Local POST /route returned HTTP {exc.code}; response body saved") from exc
    retrieved = utc_now()
    (folder / "backend_response.json").write_bytes(raw)
    response = json.loads(raw)
    validate_routes(response)
    saved = {"artifact_kind": "local_backend_route_retrieval_not_osm_snapshot",
             "retrieved_at_utc": retrieved, "backend_endpoint": endpoint,
             "request": ROUTE_REQUEST, "coordinate_order": "latitude, longitude",
             "response_sha256": hashlib.sha256(raw).hexdigest(), "routes": response["routes"]}
    write_json(folder / "routes.json", saved)
    return saved


def densify(coords):
    """Linear lon/lat interpolation of each returned polyline segment, <=25m spacing."""
    dense = [coords[0]]
    for start, end in zip(coords, coords[1:]):
        distance = GEOD.inv(*start, *end)[2]
        steps = max(1, math.ceil(distance / STEP_METRES))
        for i in range(1, steps + 1):
            t = i / steps
            dense.append((start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])))
    return dense


def line_parts(shape):
    if shape.is_empty:
        return []
    if shape.geom_type == "LineString":
        return [shape]
    if hasattr(shape, "geoms"):
        return [part for child in shape.geoms for part in line_parts(child)]
    return []  # Boundary touches at a single point have zero length.


def geodesic_length(shape):
    return sum(GEOD.line_length(*zip(*part.coords)) for part in line_parts(shape))


def clipped_lengths(coords_lon_lat, boundary):
    """Clip each segment, preserving traversed length even on repeated/backtracking edges."""
    total = covered = 0.0
    outside = []
    for start, end in zip(coords_lon_lat, coords_lon_lat[1:]):
        if start == end:
            continue
        segment = LineString([start, end])
        total += geodesic_length(segment)
        covered += geodesic_length(segment.intersection(boundary))
        outside.extend(line_parts(segment.difference(boundary)))
    if total <= 0:
        raise ValueError("Route has zero geometric length; coverage percentage is undefined")
    covered = min(total, max(0, covered))
    return total, covered, outside


def buffer_coverage(metric_line, metric_boundary, metres):
    if not finite(metres) or metres <= 0:
        raise ValueError("Buffer must be a finite positive number of metres")
    corridor = metric_line.buffer(metres, quad_segs=ARC_SEGMENTS, cap_style="round", join_style="round")
    missing = corridor.difference(metric_boundary)
    inside_area = corridor.intersection(metric_boundary).area
    return {"buffer_metres": metres, "total_area_m2": corridor.area,
            "inside_area_m2": inside_area, "outside_area_m2": missing.area,
            "inside_percent": 100 * inside_area / corridor.area,
            "outside_percent": 100 * missing.area / corridor.area,
            "fully_covered": metric_boundary.covers(corridor)}, corridor, missing


def measure_route(route, bbox, buffer_metres):
    coords = [(lon, lat) for lat, lon in route["coordinates"]]
    # This metric projection is appropriate to Ranchi, not arbitrary distant geocodes.
    if any(abs(lon - 85.325) > 1 or abs(lat - 23.365) > 1 for lon, lat in coords):
        raise ValueError("Route lies far outside the Ranchi region; check geocoding before using this metric projection")
    south, west, north, east = bbox
    boundary = box(west, south, east, north)
    dense = densify(coords)
    total, covered, outside = clipped_lengths(dense, boundary)
    ring = densify([(west, south), (east, south), (east, north), (west, north), (west, south)])
    metric_boundary = transform(TO_METRES.transform, Polygon(ring))
    metric_line = transform(TO_METRES.transform, LineString(dense))
    buffer, corridor, missing = buffer_coverage(metric_line, metric_boundary, buffer_metres)
    missing_wgs84 = transform(TO_WGS84.transform, missing)
    corridor_wgs84 = transform(TO_WGS84.transform, corridor)
    directions = []
    if not missing_wgs84.is_empty:
        left, bottom, right, top = missing_wgs84.bounds
        for condition, name in [(bottom < south, "south"), (top > north, "north"),
                                (left < west, "west"), (right > east, "east")]:
            if condition:
                directions.append(name)
    metrics = {"route_id": route["id"], "backend_distance_metres": route["distanceMeters"],
               "backend_duration_seconds": route["durationSeconds"], "coordinate_count": len(coords),
               "polyline_length_metres": total, "inside_length_metres": covered,
               "outside_length_metres": total - covered, "inside_percent": 100 * covered / total,
               "outside_percent": 100 * (total - covered) / total,
               "centerline_fully_covered": boundary.covers(LineString(coords)),
               "analysis_buffer": buffer, "adequate_geographic_extent_for_full_route_analysis": buffer["fully_covered"],
               "missing_directions": directions,
               "missing_buffer_bounds_west_south_east_north": list(missing_wgs84.bounds) if not missing_wgs84.is_empty else None,
               "suggested_future_extraction_envelope_west_south_east_north": list(corridor_wgs84.bounds)}
    features = [{"type": "Feature", "properties": {"route_id": route["id"], "kind": "outside_centerline"},
                 "geometry": mapping(part)} for part in outside]
    if not missing_wgs84.is_empty:
        features.append({"type": "Feature", "properties": {"route_id": route["id"], "kind": "uncovered_analysis_buffer"},
                         "geometry": mapping(missing_wgs84)})
    return metrics, features


def write_report(folder, bbox, snapshot, saved=None, metrics=None, failure=None, buffer_metres=100, mode="local_api_retrieval"):
    report = f'''# SHEPATH route-coverage verification

Experiment time (UTC): {utc_now()}
Analysis mode: `{mode}`. Offline replay retains the original real retrieval timestamp.
Request: Albert Ekka Chowk, Ranchi → Doranda, Ranchi; `travelMode=walk`.
Saved OSM boundary (south, west, north, east): **{bbox}**.
OSM snapshot: `{snapshot['snapshot_folder']}`, base timestamp
`{snapshot['source'].get('osm_base_timestamp')}`; raw SHA-256
`{snapshot['raw_response_sha256']}`.
Run artifacts: `{folder.relative_to(ROOT)}`.
This route retrieval is a separate artifact from the older OSM extraction.

'''
    if failure:
        report += f'''## Retrieval / analysis failure

**{failure}**

Real routes returned: {len(saved['routes']) if saved else 'unknown — no valid response was obtained'}.
Coverage results: **not verified**. No coordinates, distances or coverage values
were invented. {'Valid retrieved routes were saved, but analysis did not complete.' if saved else 'No usable route retrieval is available for this run.'}
Check that the local SHEPATH backend is serving `/route` and that its upstream
configuration is working, then rerun the documented command. An HTTP error body,
if received, is retained in the run folder. A failed run does not establish
whether the pilot extent is adequate; missing areas remain unverified.
'''
    else:
        report += f'''## Actual returned routes

Real routes returned: **{len(saved['routes'])}**. Retrieved at **{saved['retrieved_at_utc']}**.
Endpoint: `{saved['backend_endpoint']}`. Coordinate order in `routes.json` is
the backend's **[latitude, longitude]**, not GeoJSON order.

| Route ID | API distance (m) | API duration (s) | Measured polyline (m) | Length inside (%) | Length outside (%) | Buffer area inside (%) | Buffer area outside (%) | Buffer fully covered | Geographic extent adequate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
'''
        for result in metrics:
            buffer = result["analysis_buffer"]
            report += (f"| {result['route_id']} | {result['backend_distance_metres']:.2f} | "
                       f"{result['backend_duration_seconds']:.2f} | {result['polyline_length_metres']:.2f} | "
                       f"{result['inside_percent']:.4f}% | {result['outside_percent']:.4f}% | "
                       f"{buffer['inside_percent']:.4f}% | {buffer['outside_percent']:.4f}% | "
                       f"{'yes' if buffer['fully_covered'] else 'no'} | {'yes' if buffer['fully_covered'] else 'no'} |\n")
        report += "\n## Uncovered areas and adequacy\n\n"
        routes_by_id = {route["id"]: route for route in saved["routes"]}
        for result in metrics:
            buffer = result["analysis_buffer"]
            original = routes_by_id[result["route_id"]]
            report += (f"* **{result['route_id']}**: {result['outside_length_metres']:.2f} m of polyline outside; "
                       f"{buffer['outside_area_m2']:.2f} m² of the {buffer_metres:g} m buffer outside. "
                       f"Missing boundary sides: {', '.join(result['missing_directions']) or 'none'}. "
                       f"Missing-buffer bounds [west, south, east, north]: "
                       f"{result['missing_buffer_bounds_west_south_east_north']}.\n")
            report += (f"  Returned endpoints [latitude, longitude]: {original['startPoint']} → {original['endPoint']}. "
                       "These are backend-resolved locations, not independently verified place coordinates.\n")
        if all(result["analysis_buffer"]["fully_covered"] for result in metrics):
            report += "\nThe saved extent covers all returned routes and their analysis buffers geometrically.\n"
        else:
            report += "\n**The existing pilot extent is insufficient for full-route feature analysis** for routes whose buffers are not fully covered.\n"
        report += '''
`uncovered_areas.geojson` contains actual out-of-box centerline pieces and uncovered
buffer polygons, with route IDs. `coverage_results.json` retains precise lengths,
areas and bounds, plus a suggested future corridor envelope. These are areas to
review for a future extraction, not a changed pilot boundary. No further OSM
download was performed. Incidental OSM ways extending beyond the box do not
establish systematic feature coverage there. In-box geometry does not establish
complete or reliable OSM tags; the DATA_COVERAGE_REPORT limitations still apply.
'''
    report += f'''
## Method and precision

The boundary comes directly from the successful saved extraction metadata.
Each returned segment is densified by linear longitude/latitude interpolation
at approximately ≤{STEP_METRES} m spacing, then geometrically intersected with
the WGS84 bbox using Shapely. Interior **and boundary-following** portions count
as covered. Pyproj's WGS84 ellipsoid measures the clipped polyline lengths.
Segment-wise calculation preserves traversed distance on repeated edges; it
does not union away backtracking. Isolated boundary touches have zero length.
Percentages use measured geometry, not the API distance, which is preserved
separately and can differ because of provider geometry/generalization.

The **{buffer_metres:g} metre** buffer is a round-capped, round-joined union corridor
in **WGS84 / UTM zone 45N (EPSG:32645)**. Both polyline and geographic-box edges
are densified before projection. Buffer-area coverage is the intersection area
divided by total buffer area; it is not route-length coverage. Full coverage uses
the polygon `covers` predicate, not rounded percentages. Boundary-following
centerlines can be 100% covered while their buffers are only partially covered.
Circular arcs use {ARC_SEGMENTS} segments per quadrant (polygon approximation);
UTM distances/areas have small local scale distortion and are not survey precision.
Near-boundary millimetre differences are subject to projection/densification and
floating-point tolerances. The method is restricted to the Ranchi region.

Library versions: Shapely {shapely.__version__}; pyproj {pyproj.__version__}.
Offline tests cover inside/outside/crossing/boundary-following lines, buffer
containment and partial area, repeated traversal, invalid schemas and failure
handling. Reproduction and dependency installation: `ROUTE_COVERAGE_README.md`.

Method references: [Shapely geometry operations](https://shapely.readthedocs.io/en/stable/manual.html),
[pyproj ellipsoidal lengths](https://pyproj4.github.io/pyproj/stable/api/geod.html),
[pyproj coordinate transforms](https://pyproj4.github.io/pyproj/stable/api/transformer.html).
OSM pilot attribution: © OpenStreetMap contributors, ODbL 1.0,
https://www.openstreetmap.org/copyright. Route provenance is the local SHEPATH
API response; OSM-snapshot attribution is not substituted for routing provenance.

No safety score, safety classification, ranking or ML result was produced.
Backend, routing API and frontend code were not changed; no commit or push.
'''
    (ROOT / "ROUTE_COVERAGE_REPORT.md").write_text(report, encoding="utf-8")
    (folder / "ROUTE_COVERAGE_REPORT.md").write_text(report, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--buffer-metres", type=float, default=100)
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--saved-routes", type=Path, help="Offline reanalysis of a previously saved routes.json")
    args = parser.parse_args()
    if not finite(args.buffer_metres) or args.buffer_metres <= 0:
        parser.error("--buffer-metres must be finite and positive")
    bbox, snapshot = read_snapshot(args.snapshot)
    folder = ROOT / "route_coverage_runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    folder.mkdir(parents=True)
    write_json(folder / "experiment_config.json", {"request": ROUTE_REQUEST, "snapshot": snapshot,
                                                   "buffer_metres": args.buffer_metres,
                                                   "base_url": args.base_url, "offline_input": str(args.saved_routes) if args.saved_routes else None})
    saved = None
    mode = "offline_reanalysis" if args.saved_routes else "local_api_retrieval"
    try:
        if args.saved_routes:
            candidate = json.loads(inside_workspace(args.saved_routes).read_text(encoding="utf-8"))
            if (not isinstance(candidate, dict)
                    or candidate.get("artifact_kind") != "local_backend_route_retrieval_not_osm_snapshot"
                    or candidate.get("request") != ROUTE_REQUEST or not candidate.get("retrieved_at_utc")
                    or candidate.get("coordinate_order") != "latitude, longitude"):
                raise ValueError("Offline input is not a compatible saved route retrieval")
            validate_routes(candidate)
            saved = candidate
            write_json(folder / "routes.json", saved)
        else:
            saved = fetch_routes(args.base_url, folder)
        results, features = [], []
        for route in saved["routes"]:
            result, parts = measure_route(route, bbox, args.buffer_metres)
            results.append(result)
            features.extend(parts)
        write_json(folder / "coverage_results.json", {"snapshot": snapshot, "route_retrieved_at_utc": saved["retrieved_at_utc"],
                                                       "analyzed_at_utc": utc_now(), "routes": results})
        write_json(folder / "uncovered_areas.geojson", {"type": "FeatureCollection", "features": features})
        write_report(folder, bbox, snapshot, saved, results, buffer_metres=args.buffer_metres, mode=mode)
        write_json(folder / "run_status.json", {"status": "success", "mode": mode,
                                               "route_count": len(saved["routes"])})
        print(f"Measured {len(results)} real routes; saved artifacts in {folder}")
        for result in results:
            print(f"{result['route_id']}: length inside {result['inside_percent']:.4f}%; buffer inside {result['analysis_buffer']['inside_percent']:.4f}%")
        return 0
    except (OSError, ValueError, RuntimeError, error.URLError) as exc:
        failure = f"{type(exc).__name__}: {exc}"
        write_json(folder / "run_status.json", {"status": "failed", "error": failure, "coverage_verified": False})
        write_report(folder, bbox, snapshot, saved=saved, failure=failure, buffer_metres=args.buffer_metres, mode=mode)
        print("Route coverage remains unverified: " + failure, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
