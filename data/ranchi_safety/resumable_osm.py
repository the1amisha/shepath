"""Sequential, persistent tile/category extraction. Never calls the old large query."""
import argparse
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import hashlib
import json
import math
import os
from pathlib import Path
import time
from urllib import error, parse, request

import extract_expanded_osm as expanded
import extract_osm as original
import verify_route_coverage as coverage
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent
PLAN = ROOT / "expanded_outputs" / "20261008T142703_316466Z" / "boundary_plan.json"
DEFAULT_RUN = ROOT / "tiled_runs" / "phase4b_20261009_2x2"
EXPECTED_BBOX = [23.335059, 85.308481, 23.38, 85.34]
KINDS = ("roads", "lighting", "police", "healthcare", "pharmacies", "businesses")
RETRY_CODES = {429, 500, 502, 503, 504}


def utc():
    return datetime.now(timezone.utc)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    original.write_json(temporary, value)
    temporary.replace(path)


def local_path(path):
    resolved = path.resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError("All pipeline files must stay inside data/ranchi_safety/")
    return resolved


@contextmanager
def exclusive():
    path = ROOT / ".tiled_pipeline.lock"
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise RuntimeError("Another tiled pipeline process holds the lock. If it crashed, verify it stopped before removing .tiled_pipeline.lock") from exc
    try:
        with os.fdopen(fd, "w") as handle:
            handle.write(str(os.getpid()))
        yield
    finally:
        path.unlink()


def tiles(bbox, size):
    if not isinstance(size, int) or not 1 <= size <= 10:
        raise ValueError("Grid size must be between 1 and 10")
    south, west, north, east = bbox
    lat = [south + (north - south) * i / size for i in range(size + 1)]
    lon = [west + (east - west) * i / size for i in range(size + 1)]
    lat[-1], lon[-1] = north, east
    return [{"id": f"r{row:02d}c{col:02d}", "bbox": [lat[row], lon[col], lat[row + 1], lon[col + 1]]}
            for row in range(size) for col in range(size)]


def verify_tiles(bbox, grid):
    polygons = [box(t["bbox"][1], t["bbox"][0], t["bbox"][3], t["bbox"][2]) for t in grid]
    whole = box(bbox[1], bbox[0], bbox[3], bbox[2])
    if not unary_union(polygons).equals(whole):
        raise ValueError("Tiles do not cover the requested extent exactly")
    if any(a.intersection(b).area > 1e-15 for i, a in enumerate(polygons) for b in polygons[i + 1:]):
        raise ValueError("Tile interiors overlap")


def query_for(kind, bbox):
    b = ",".join(format(v, ".12f").rstrip("0").rstrip(".") for v in bbox)
    medical = "|".join(sorted(expanded.MEDICAL))
    commercial = "|".join(sorted(expanded.COMMERCIAL))
    lodging = "|".join(sorted(expanded.LODGING))
    selectors = {
        "roads": ['way["highway"]', 'nwr["highway"~"^(crossing|traffic_signals|elevator|steps|footway|path|pedestrian)$"]',
                  'nwr["crossing"]', 'nwr["kerb"]', 'nwr["barrier"]', 'nwr["sidewalk"]'],
        "lighting": ['nwr["highway"="street_lamp"]', 'nwr["highway"]["lit"]'],
        "police": ['nwr["amenity"="police"]'],
        "healthcare": ['nwr["healthcare"]', f'nwr["amenity"~"^({medical})$"]'],
        "pharmacies": ['nwr["amenity"="pharmacy"]', 'nwr["healthcare"="pharmacy"]'],
        "businesses": ['nwr["shop"]', 'nwr["office"]', 'nwr["craft"]',
                       f'nwr["amenity"~"^({commercial})$"]', 'nwr["healthcare"="pharmacy"]',
                       f'nwr["tourism"~"^({lodging})$"]'],
    }
    return '[out:json][timeout:25];\n(\n' + "\n".join(f"  {s}({b});" for s in selectors[kind]) + '\n);\nout meta geom;\nout count;\n'


def matches(e, kind):
    t = e.get("tags", {})
    c = expanded.categories(e)
    return {"roads": ((e["type"] == "way" and "highway" in t) or "pedestrian_infrastructure" in c),
            "lighting": (t.get("highway") == "street_lamp" or "highway" in t and "lit" in t),
            "police": "police_stations" in c, "healthcare": "healthcare_facilities" in c,
            "pharmacies": "pharmacies" in c, "businesses": "shops_and_businesses" in c}[kind]


def validate_payload(raw, kind):
    data = json.loads(raw)
    if (not isinstance(data, dict) or data.get("remark") or not isinstance(data.get("elements"), list)
            or not data["elements"] or not isinstance(data["elements"][-1], dict)
            or data["elements"][-1].get("type") != "count"):
        raise ValueError("Malformed/partial Overpass response or missing terminal count")
    if not isinstance(data.get("osm3s"), dict) or not data["osm3s"].get("timestamp_osm_base"):
        raise ValueError("Missing OSM snapshot timestamp")
    datetime.fromisoformat(data["osm3s"]["timestamp_osm_base"].replace("Z", "+00:00"))
    records = data["elements"][:-1]
    original.validate_response({"elements": records})
    counts = Counter(e["type"] for e in records)
    sentinel = data["elements"][-1].get("tags", {})
    try:
        expected = {k: int(sentinel[k]) for k in ("nodes", "ways", "relations", "total")}
    except (ValueError, TypeError, KeyError) as exc:
        raise ValueError("Invalid terminal count fields") from exc
    if (expected["total"] != len(records) or any(counts[k] != expected[k + "s"] for k in ("node", "way", "relation"))
            or len({(e["type"], e["id"]) for e in records}) != len(records)):
        raise ValueError("Terminal counts or within-task unique IDs disagree")
    if any(not matches(e, kind) for e in records):
        raise ValueError("Unexpected records outside the requested category")
    if kind == "roads" and not records:
        raise ValueError("Unexpected zero-road result in this urban tile; requires review")
    # Sparse categories can legitimately be zero when the count sentinel confirms it.
    if any(not e.get("timestamp") or not isinstance(e.get("version"), int) for e in records):
        raise ValueError("Missing edit metadata from out meta request")
    for e in records:
        if any(not original.valid_point(p) for p in original.coordinate_points(e)):
            raise ValueError("Invalid supplied coordinates; raw response retained")
    return data, records


def create_manifest(run, size, endpoint):
    run = local_path(run)
    if size < 2:
        raise ValueError("Public-server runs require at least a 2×2 grid")
    endpoint_url = parse.urlsplit(endpoint)
    if endpoint_url.scheme != "https" or not endpoint_url.hostname or endpoint_url.username or endpoint_url.password:
        raise ValueError("Use an HTTPS Overpass endpoint without credentials")
    if (run / "manifest.json").exists():
        raise ValueError("Manifest already exists; resume it rather than initializing over it")
    saved_plan = expanded.load_json(PLAN)
    if saved_plan["bbox_south_west_north_east"] != EXPECTED_BBOX:
        raise ValueError("Validated saved boundary differs from the requested boundary")
    saved_routes = expanded.load_json(expanded.ROUTE_RUN / "routes.json")
    coverage.validate_routes(saved_routes)
    metrics = [coverage.measure_route(r, EXPECTED_BBOX, 100)[0] for r in saved_routes["routes"]]
    if len(metrics) != 3 or not all(r["centerline_fully_covered"] and r["analysis_buffer"]["fully_covered"] for r in metrics):
        raise ValueError("Saved route/buffer containment failed")
    grid = tiles(EXPECTED_BBOX, size)
    verify_tiles(EXPECTED_BBOX, grid)
    run.mkdir(parents=True, exist_ok=True)
    tasks = []
    for tile in grid:
        for kind in KINDS:
            query = query_for(kind, tile["bbox"])
            tasks.append({"id": tile["id"] + "-" + kind, "tile": tile["id"], "category": kind,
                          "bbox": tile["bbox"], "query": query, "query_sha256": digest(query.encode()),
                          "status": "pending", "attempts": [], "success": None})
    manifest = {"schema_version": 1, "created_at_utc": utc().isoformat(), "bbox": EXPECTED_BBOX,
                "grid_size": size, "tiles": grid, "endpoint": endpoint, "tasks": tasks,
                "next_request_at_utc": None, "route_coverage": metrics,
                "boundary_metadata_file": str(PLAN.relative_to(ROOT)), "boundary_metadata_sha256": expanded.sha(PLAN),
                "route_input_file": str((expanded.ROUTE_RUN / "routes.json").relative_to(ROOT)),
                "route_input_sha256": expanded.sha(expanded.ROUTE_RUN / "routes.json"),
                "attribution": original.ATTRIBUTION, "license": "ODbL 1.0", "not_city_inventory": True}
    atomic_json(run / "manifest.json", manifest)
    return manifest


def read_manifest(run):
    run = local_path(run)
    m = expanded.load_json(run / "manifest.json")
    if m.get("schema_version") != 1 or m["bbox"] != EXPECTED_BBOX:
        raise ValueError("Unsupported manifest or altered boundary")
    grid = tiles(m["bbox"], m["grid_size"])
    if grid != m["tiles"]:
        raise ValueError("Manifest tile configuration changed")
    verify_tiles(m["bbox"], grid)
    expected = {(t["id"] + "-" + kind): (t, kind) for t in grid for kind in KINDS}
    if len(m["tasks"]) != len(expected) or {t["id"] for t in m["tasks"]} != set(expected):
        raise ValueError("Missing or duplicated manifest tasks")
    for t in m["tasks"]:
        tile, kind = expected[t["id"]]
        if (t["bbox"] != tile["bbox"] or t["category"] != kind or t["tile"] != tile["id"]
                or t["query"] != query_for(kind, tile["bbox"]) or t["query_sha256"] != digest(t["query"].encode())
                or t["status"] not in {"pending", "successful", "failed"}):
            raise ValueError("Task configuration/status inconsistent with manifest")
    for filekey, hashkey in [("boundary_metadata_file", "boundary_metadata_sha256"), ("route_input_file", "route_input_sha256")]:
        if expanded.sha(local_path(ROOT / m[filekey])) != m[hashkey]:
            raise ValueError("Pinned source input changed since initialization")
    saved = expanded.load_json(local_path(ROOT / m["route_input_file"]))
    coverage.validate_routes(saved)
    recomputed = [coverage.measure_route(r, m["bbox"], 100)[0] for r in saved["routes"]]
    if (len(recomputed) != 3 or recomputed != m["route_coverage"]
            or not all(r["centerline_fully_covered"] and r["analysis_buffer"]["fully_covered"] for r in recomputed)):
        raise ValueError("Saved route coverage no longer matches verified extent")
    return m


def read_success(run, task, endpoint):
    success = task["success"]
    path = local_path(run / success["response_file"])
    if not path.is_relative_to(run.resolve()):
        raise ValueError("Task response path escapes the run folder")
    raw = path.read_bytes()
    if (digest(raw) != success["response_sha256"] or success["endpoint"] != endpoint
            or success["query_sha256"] != task["query_sha256"] or success["bbox"] != task["bbox"]
            or expanded.sha(path.parent / "query.overpassql") != task["query_sha256"]):
        raise ValueError("Successful-task provenance/hash mismatch; no automatic redownload")
    return validate_payload(raw, task["category"])


def cooldown(header, attempt):
    delay = 30 * 2 ** attempt
    if header:
        try:
            requested = float(header)
        except ValueError:
            try:
                requested = (parsedate_to_datetime(header) - utc()).total_seconds()
            except (ValueError, TypeError, OverflowError):
                requested = 0
        if math.isfinite(requested):
            delay = max(delay, requested)
    return delay


def wait_until_ready(m):
    if m.get("next_request_at_utc"):
        delay = (datetime.fromisoformat(m["next_request_at_utc"]) - utc()).total_seconds()
        if delay > 60:
            raise RuntimeError(f"Cooldown persists until {m['next_request_at_utc']}; resume after that time")
        if delay > 0:
            time.sleep(delay)


def run_tasks(run, m, limit=1, task_id=None, attempts=2, interval=30):
    selected = [t for t in m["tasks"] if task_id is None or t["id"] == task_id]
    if task_id and not selected:
        raise ValueError("Unknown task ID")
    attempted_tasks = 0
    for t in selected:
        if t["status"] == "successful":
            read_success(run, t, m["endpoint"])
            continue
        if attempted_tasks >= limit:
            break
        wait_until_ready(m)
        attempted_tasks += 1
        for index in range(attempts):
            wait_until_ready(m)
            attempt_folder = run / "tasks" / t["id"] / utc().strftime("%Y%m%dT%H%M%S_%fZ")
            attempt_folder.mkdir(parents=True)
            (attempt_folder / "query.overpassql").write_bytes(t["query"].encode("utf-8"))
            history = {"started_at_utc": utc().isoformat(), "endpoint": m["endpoint"], "bbox": t["bbox"],
                       "query_sha256": t["query_sha256"], "attempt_folder": str(attempt_folder.relative_to(run))}
            t["attempts"].append(history)
            atomic_json(attempt_folder / "provenance.json", history)
            atomic_json(run / "manifest.json", m)
            retry, delay = False, interval
            try:
                req = request.Request(m["endpoint"], data=parse.urlencode({"data": t["query"]}).encode(),
                                      headers={"User-Agent": "SHEPATH-Ranchi-tiled-experiment/0.1", "Accept": "application/json"})
                with request.urlopen(req, timeout=45) as response:
                    raw = response.read()
                # Persist raw bytes BEFORE any validation or success flag.
                (attempt_folder / "response.json").write_bytes(raw)
                data, records = validate_payload(raw, t["category"])
                history.update({"result": "successful", "retrieved_at_utc": utc().isoformat(),
                                "record_count": len(records), "osm_base_timestamp": data["osm3s"]["timestamp_osm_base"],
                                "response_file": str((attempt_folder / "response.json").relative_to(run)), "response_sha256": digest(raw)})
                t["success"] = dict(history)
                t["status"] = "successful"
                print(f"{t['id']}: successful, {len(records)} records")
            except error.HTTPError as exc:
                (attempt_folder / "http_error.txt").write_bytes(exc.read())
                history.update({"result": "failed", "error": f"HTTP {exc.code}", "http_status": exc.code})
                retry = exc.code in RETRY_CODES
                delay = cooldown(exc.headers.get("Retry-After"), index) if retry else interval
                t["status"] = "failed"
            except (error.URLError, TimeoutError, OSError) as exc:
                history.update({"result": "failed", "error": str(exc)})
                t["status"] = "failed"
                retry, delay = True, cooldown(None, index)
            except (ValueError, TypeError, KeyError, AttributeError) as exc:
                history.update({"result": "failed", "error": f"Response rejected: {exc}"})
                t["status"] = "failed"
                # Don't automatically repeat malformed/partial responses.
                delay = 30
            m["next_request_at_utc"] = (utc() + timedelta(seconds=max(interval, delay))).isoformat()
            atomic_json(attempt_folder / "provenance.json", history)
            atomic_json(run / "manifest.json", m)
            if t["status"] == "successful" or not retry or index + 1 == attempts:
                break
            wait_until_ready(m)
        if t["status"] == "failed":
            print(f"{t['id']}: failed — {t['attempts'][-1]['error']}; stopping this batch")
            break  # avoid sending another category while the server is failing
    return attempted_tasks


def merge_records(inputs):
    selected, sources, variants = {}, {}, []
    for task_id, records in inputs:
        for e in records:
            key = (e["type"], e["id"])
            sources.setdefault(key, []).append(task_id)
            if key not in selected:
                selected[key] = (task_id, e)
                continue
            prior_task, prior = selected[key]
            if prior == e:
                continue
            variants.append({"osm_id": f"{key[0]}/{key[1]}", "tasks": [prior_task, task_id],
                             "versions": [prior.get("version"), e.get("version")],
                             "same_version_disagreement": prior.get("version") == e.get("version")})
            def rank(item):
                return (item.get("version", 0), item.get("timestamp", ""),
                        original.geometry(item) is not None, digest(json.dumps(item, sort_keys=True).encode()))
            if rank(e) > rank(prior):
                selected[key] = (task_id, e)
    return [value[1] for value in selected.values()], sources, variants, selected


def summarize(run, m):
    verify_tiles(m["bbox"], m["tiles"])
    inputs, invalid_tasks = [], []
    for t in m["tasks"]:
        if t["status"] == "successful":
            try:
                _, records = read_success(run, t, m["endpoint"])
                inputs.append((t["id"], records))
            except (ValueError, OSError, TypeError, KeyError, AttributeError) as exc:
                invalid_tasks.append({"task_id": t["id"], "error": str(exc)})
    records, sources, variants, selected = merge_records(inputs)
    complete = all(t["status"] == "successful" for t in m["tasks"]) and not invalid_tasks
    # Same-version disagreements need review before producing a complete merged dataset.
    complete = complete and not any(v["same_version_disagreement"] for v in variants)
    output = run / ("complete" if complete else "partial") / utc().strftime("%Y%m%dT%H%M%S_%fZ")
    output.mkdir(parents=True)
    source = {"attribution": original.ATTRIBUTION, "license": "ODbL 1.0", "license_url": "https://www.openstreetmap.org/copyright",
              "bbox_south_west_north_east": m["bbox"], "manifest": str((run / "manifest.json").relative_to(ROOT)),
              "complete_requested_task_set": complete, "mode": "tiled_multi_time_snapshot", "endpoint": m["endpoint"],
              "task_snapshot_timestamps": {t["id"]: t["success"]["osm_base_timestamp"] for t in m["tasks"] if t["status"] == "successful"}}
    collection, quality = expanded.assess({"elements": records}, m["bbox"], source)
    for feature in collection["features"]:
        key = (feature["properties"]["osm_type"], feature["properties"]["osm_id"])
        feature["properties"]["task_sources"] = sorted(set(sources[key]))
        feature["properties"]["selected_from_task"] = selected[key][0]
    original.write_json(output / "merged_records.json", {"source": source, "elements": records})
    original.write_json(output / "features.geojson", collection)
    original.write_json(output / "quality_summary.json", quality)
    original.write_json(output / "record_variants.json", {"variants": variants, "invalid_success_artifacts": invalid_tasks})
    original.write_json(output / "manifest_snapshot.json", m)
    counts = Counter(t["status"] for t in m["tasks"])
    report = f'''# Resumable Ranchi extraction status

Run: `{run.relative_to(ROOT)}`; generated {utc().isoformat()}.
Endpoint pinned to `{m['endpoint']}`. Requested bbox (south, west, north, east):
**{m['bbox']}**, verified against saved validated metadata (SHA-256
`{m['boundary_metadata_sha256']}`). Grid: **{m['grid_size']}×{m['grid_size']}**;
planned tasks: **{len(m['tasks'])}**. Successful: **{counts['successful']}**;
pending: **{counts['pending']}**; failed: **{counts['failed']}**.

Acquisition status: **{'complete requested tile/category task set' if complete else 'PARTIAL / INCOMPLETE'}**.
Unique records from validated successful tasks: **{len(records)}**.
Merged artifacts: `{output.relative_to(ROOT)}`. This is never claimed as a complete
Ranchi inventory. Category counts overlap and are not additive.

## Category acquisition coverage

| Request category | Successful tiles | Requested tiles | Successful-tile area % |
| --- | ---: | ---: | ---: |
'''
    for kind in KINDS:
        good = [t for t in m["tasks"] if t["category"] == kind and t["id"] in {i[0] for i in inputs}]
        polygons = [box(t["bbox"][1], t["bbox"][0], t["bbox"][3], t["bbox"][2]) for t in good]
        area = unary_union(polygons).area if polygons else 0
        whole = box(m["bbox"][1], m["bbox"][0], m["bbox"][3], m["bbox"][2]).area
        report += f"| {kind} | {len(good)} | {len(m['tiles'])} | {100 * area / whole:.4f}% |\n"
    report += "\nArea % is geographic tile acquisition coverage, not mapped-feature completeness; whole crossing-way geometry does not expand verified sampled area.\n"
    report += "\n## Unique feature counts from downloaded tasks only\n\n"
    for kind, count in quality["counts_by_category"].items():
        report += f"* {kind}: {count}\n"
    report += "\nCategories with zero records may be unrequested or partially requested, not absent in the real world. Sparse successful zero-result tasks require a valid zero-count sentinel.\n"
    report += "\n## Requested extent versus the three saved routes\n\n| Route ID | Length inside % | 100 m buffer area inside % | Full buffer contained |\n| --- | ---: | ---: | --- |\n"
    for r in m["route_coverage"]:
        report += f"| {r['route_id']} | {r['inside_percent']:.4f} | {r['analysis_buffer']['inside_percent']:.4f} | {r['analysis_buffer']['fully_covered']} |\n"
    report += "\nAll three saved route corridors fit the requested extent geometrically. Until every tile/category task validates, acquired feature coverage is incomplete and cannot support full-route comparisons across all categories.\n"
    report += "\n## Failed tasks / rejected success artifacts\n\n"
    for t in m["tasks"]:
        if t["status"] == "failed":
            report += f"* {t['id']}: {t['attempts'][-1]['error']}\n"
    if not counts["failed"]:
        report += "No failed tasks recorded.\n"
    for item in invalid_tasks:
        report += f"* {item['task_id']}: {item['error']}\n"
    report += f'''
## Quality and provenance limitations

Coordinates: {quality['coordinates']}.
Lighting completeness among downloaded road records: {quality['road_lighting']}.
Sidewalk completeness among downloaded road records: {quality['road_sidewalk']}.
Business opening-hours completeness among downloaded business records: {quality['business_opening_hours']}.
Potential facility duplicate pairs: {len(quality['potential_facility_duplicates'])}.
Cross-task record variants: {len(variants)}; conflicting same-version variants
prevent complete merged output. Different versions use the newest version/edit
timestamp, then usable geometry and a stable tie-break, retaining the whole chosen
record rather than combining tags. All alternatives remain in immutable task raw
responses. A multi-time extraction is not a simultaneous OSM snapshot.

No `opening_hours` selector filters businesses. Missing lit/sidewalk means unknown;
explicit `no` is recorded information, not proof of current conditions. Hours are
not parsed and no business is classified currently open. Null/incomplete relation
geometry is retained and flagged. Global coordinate validity does not prove
position accuracy, walking access, facility operation or exhaustive mapping.
Tile interiors do not overlap; inclusive Overpass boundaries can return shared
edge records and whole crossing ways. These are deduplicated by (type, ID), not
by name or coordinates. Sparse results are not proof of physical absence.

Successful raw JSON, exact query, bbox, endpoint, retrieval/edit/base timestamps
and hashes are stored per task before marking success. A terminal `out count`
must match records and per-type counts. Missing count, remarks, malformed JSON,
unexpected records or invalid coordinates cannot become successful tasks.
Resume revalidates hashes and raw contents and skips valid successes. Partial
outputs stay separate; manifest/task geometry checks precede every merge.

Attribution: © OpenStreetMap contributors, ODbL 1.0,
https://www.openstreetmap.org/copyright. Count-query reference:
https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL.
No route request, HeiGIT request, key access, safety score, backend/frontend/ML
edit, commit or push. Usage and tests: `RESUMABLE_EXTRACTION_README.md`.
'''
    (output / "TILED_EXTRACTION_REPORT.md").write_text(report, encoding="utf-8")
    (run / "TILED_EXTRACTION_REPORT.md").write_text(report, encoding="utf-8")
    return {"planned": len(m["tasks"]), "statuses": dict(counts), "unique_records": len(records),
            "complete": complete, "output_folder": str(output.relative_to(ROOT))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("init", "run", "merge", "status"))
    parser.add_argument("--run", type=Path, default=DEFAULT_RUN)
    parser.add_argument("--grid-size", type=int, default=2)
    parser.add_argument("--endpoint", help="Initialization only; endpoint stays pinned thereafter")
    parser.add_argument("--max-tasks", type=int, default=1, help="Maximum tasks this invocation; defaults to one")
    parser.add_argument("--task", help="Specific task ID; successful tasks are never downloaded again")
    parser.add_argument("--attempts", type=int, choices=(1, 2, 3), default=2)
    parser.add_argument("--interval-seconds", type=int, default=30)
    args = parser.parse_args()
    if args.max_tasks < 1 or args.interval_seconds < 30:
        parser.error("Task limit must be positive and request interval at least 30 seconds")
    run = local_path(args.run)
    with exclusive():
        if args.command == "init":
            m = create_manifest(run, args.grid_size, args.endpoint or original.ENDPOINT)
            print(f"Initialized {len(m['tasks'])} tasks at {run / 'manifest.json'}; no network request")
        else:
            m = read_manifest(run)
            if args.endpoint and args.endpoint != m["endpoint"]:
                raise ValueError("Existing manifest endpoint is pinned; no endpoint switching on resume")
            if args.command == "run":
                try:
                    run_tasks(run, m, args.max_tasks, args.task, args.attempts, args.interval_seconds)
                except (RuntimeError, ValueError, OSError) as exc:
                    print(f"Batch stopped: {exc}")
                    result = summarize(run, m)
                    print(json.dumps(result))
                    return 1
        result = summarize(run, m)
        print(json.dumps(result))
        return 1 if args.command == "run" and any(t["status"] == "failed" for t in m["tasks"] if args.task is None or t["id"] == args.task) else 0


if __name__ == "__main__":
    raise SystemExit(main())
