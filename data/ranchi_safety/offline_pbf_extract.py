"""Offline, disk-indexed OSM extraction. No network calls. See OFFLINE_PBF_README.md."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import sqlite3
import struct

import osmium
import pyproj
from shapely.geometry import Point, LineString, Polygon, GeometryCollection, box, mapping
from shapely.ops import polygonize_full, unary_union

ROOT = Path(__file__).resolve().parent
BOUNDARY = ROOT / "expanded_outputs/20261008T142703_316466Z/boundary_plan.json"
ROUTES = ROOT / "route_coverage_runs/20261008T140112_006152Z/routes.json"
TYPE = {"n": "node", "w": "way", "r": "relation"}
MEDICAL = {"hospital", "clinic", "doctors", "dentist", "nursing_home", "health_post", "pharmacy"}
COMMERCIAL = {"restaurant", "cafe", "fast_food", "bar", "pub", "bank", "fuel", "ice_cream",
              "food_court", "car_rental", "car_wash", "pharmacy", "marketplace"}
LODGING = {"hotel", "motel", "hostel", "guest_house"}


def utc():
    return datetime.now(timezone.utc).isoformat()


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def local(path):
    p = Path(path).resolve()
    if not p.is_relative_to(ROOT):
        raise ValueError("Inputs and outputs must be inside data/ranchi_safety")
    return p


def write_json(path, data):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(path)


def categories(e):
    """Same business/medical scope as extract_expanded_osm; no hours requirement."""
    t, result = e["tags"], []
    if e["type"] == "way" and "highway" in t and t["highway"] != "street_lamp":
        result.append("roads_and_pedestrian_ways")
        if "lit" in t:
            result.append("ways_with_lit_tag")
    if (t.get("highway") in {"crossing", "traffic_signals", "elevator", "steps", "footway", "path", "pedestrian"}
            or any(k in t for k in ("crossing", "kerb", "barrier", "sidewalk"))):
        result.append("pedestrian_infrastructure")
    if t.get("highway") == "street_lamp": result.append("street_lamps")
    if "highway" in t and "lit" in t: result.append("recorded_highway_lighting")
    if t.get("amenity") == "police": result.append("police_stations")
    if "healthcare" in t or t.get("amenity") in MEDICAL: result.append("healthcare_facilities")
    if t.get("amenity") == "hospital" or t.get("healthcare") == "hospital": result.append("hospitals")
    if t.get("amenity") == "pharmacy" or t.get("healthcare") == "pharmacy": result.append("pharmacies")
    if (any(k in t for k in ("shop", "office", "craft")) or t.get("amenity") in COMMERCIAL
            or t.get("healthcare") == "pharmacy" or t.get("tourism") in LODGING):
        result.append("shops_and_businesses")
        if "opening_hours" in t: result.append("businesses_with_opening_hours")
    return result


def validate_pbf_framing(path):
    """Reject truncated containers before handing a file to the native decoder."""
    if path.suffix != ".pbf": return
    size, blocks = path.stat().st_size, 0
    with path.open("rb") as f:
        while f.tell() < size:
            raw = f.read(4)
            if len(raw) != 4: raise ValueError("Truncated PBF block length")
            length = struct.unpack(">I", raw)[0]
            if not 0 < length <= 65536: raise ValueError("Invalid PBF BlobHeader size")
            header = f.read(length)
            if len(header) != length: raise ValueError("Truncated PBF BlobHeader")
            pos, data_size = 0, None
            def varint():
                nonlocal pos
                value = 0
                for shift in range(0,70,7):
                    if pos >= len(header): raise ValueError("Invalid PBF varint")
                    byte = header[pos]; pos += 1
                    value |= (byte & 127) << shift
                    if byte < 128: return value
                raise ValueError("Oversized PBF varint")
            while pos < len(header):
                key = varint()
                if key & 7 == 0:
                    value = varint()
                    if key >> 3 == 3: data_size = value
                elif key & 7 == 2:
                    count = varint(); pos += count
                else: raise ValueError("Unsupported PBF BlobHeader wire type")
            if pos != len(header) or data_size is None or not 0 < data_size <= 32*1024*1024:
                raise ValueError("Invalid PBF data size")
            if f.tell()+data_size > size: raise ValueError("Truncated PBF blob")
            f.seek(data_size, 1)
            blocks += 1
    if blocks == 0: raise ValueError("Empty PBF")


def stream(path, handler):
    pool = osmium.io.ThreadPool(1, 2)
    with osmium.io.Reader(str(path), thread_pool=pool) as reader:
        osmium.apply(reader, handler)


def record(o, kind):
    e = dict(type=kind, id=o.id, version=o.version, timestamp=str(o.timestamp),
             changeset=o.changeset, uid=o.uid, user=o.user, visible=o.visible,
             tags=dict(o.tags))
    if kind == "node":
        e["coordinates"] = [o.location.lon, o.location.lat] if o.location.valid() else None
    elif kind == "way":
        e["nodes"] = [n.ref for n in o.nodes]
    else:
        e["members"] = [{"type": TYPE[m.type], "ref": m.ref, "role": m.role} for m in o.members]
    return e


def connect(path, cache_mb):
    db = sqlite3.connect(path)
    db.execute(f"PRAGMA cache_size=-{cache_mb * 1024}")
    db.execute("PRAGMA temp_store=FILE")
    db.execute("PRAGMA mmap_size=0")
    db.executescript("""
      CREATE TABLE IF NOT EXISTS objects(kind TEXT,id INTEGER,body TEXT,candidate INTEGER,
          PRIMARY KEY(kind,id)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS issues(stage TEXT,kind TEXT,id INTEGER,message TEXT);
      CREATE TABLE IF NOT EXISTS features(kind TEXT,id INTEGER,geometry TEXT,categories TEXT,
          PRIMARY KEY(kind,id)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS wanted(kind TEXT,id INTEGER,expanded INTEGER DEFAULT 0,
          PRIMARY KEY(kind,id)) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS counters(name TEXT PRIMARY KEY,value INTEGER);
      CREATE INDEX IF NOT EXISTS candidates ON objects(candidate,kind,id);
      CREATE INDEX IF NOT EXISTS work_queue ON wanted(expanded,kind,id);
    """)
    return db


class Indexer(osmium.SimpleHandler):
    def __init__(self, db):
        super().__init__()
        self.db, self.count = db, 0

    def add(self, o, kind):
        e = record(o, kind)
        body = json.dumps(e, sort_keys=True, separators=(",", ":"), allow_nan=False)
        old = self.db.execute("SELECT body FROM objects WHERE kind=? AND id=?", (kind, e["id"])).fetchone()
        if old:
            label = "identical_duplicates" if old[0] == body else "conflicting_duplicates"
            self.db.execute("INSERT INTO counters VALUES (?,1) ON CONFLICT(name) DO UPDATE SET value=value+1", (label,))
            if old[0] != body:
                self.db.execute("INSERT INTO issues VALUES ('index',?,?,?)", (kind, e["id"], "Conflicting duplicate; first retained; source PBF preserves evidence"))
        else:
            self.db.execute("INSERT INTO objects VALUES (?,?,?,?)", (kind, e["id"], body, bool(categories(e))))
        self.count += 1
        if self.count % 10000 == 0:
            self.db.commit()

    def node(self, o): self.add(o, "node")
    def way(self, o): self.add(o, "way")
    def relation(self, o): self.add(o, "relation")


class Resolver:
    def __init__(self, db, max_depth=12, max_members=100000):
        self.db, self.max_depth, self.max_members = db, max_depth, max_members
        self.visited = 0

    def get(self, kind, ident):
        row = self.db.execute("SELECT body FROM objects WHERE kind=? AND id=?", (kind, ident)).fetchone()
        if row is None:
            raise ValueError(f"Missing reference {kind}/{ident}")
        return json.loads(row[0])

    def geometry(self, kind, ident, path=()):
        self.visited += 1
        if self.visited > self.max_members:
            raise ValueError("Per-feature object limit exceeded")
        key = (kind, ident)
        if key in path: raise ValueError(f"Relation cycle at {key}")
        if len(path) > self.max_depth: raise ValueError("Reference depth limit exceeded")
        e = self.get(kind, ident)
        t = e["tags"]
        if kind == "node":
            p = e["coordinates"]
            if not p or not all(math.isfinite(v) for v in p) or not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90):
                raise ValueError(f"Invalid coordinates node/{ident}")
            return Point(p)
        if kind == "way":
            if len(e["nodes"]) > self.max_members: raise ValueError("Way node limit exceeded")
            coords = [self.geometry("node", n, path + (key,)).coords[0] for n in e["nodes"]]
            if len(set(coords)) < 2: raise ValueError(f"Degenerate way/{ident}")
            area = (t.get("area") == "yes" or ("highway" not in t and bool(categories(e)))) and t.get("area") != "no"
            geom = Polygon(coords) if area and len(coords) >= 4 and e["nodes"][0] == e["nodes"][-1] else LineString(coords)
        else:
            if len(e["members"]) > self.max_members: raise ValueError("Relation member limit exceeded")
            if not e["members"]: raise ValueError("Empty relation")
            if t.get("type") == "multipolygon":
                outer, inner = [], []
                for member in e["members"]:
                    if member["type"] != "way" or member["role"] not in {"", "outer", "inner"}:
                        raise ValueError("Unsupported multipolygon member type/role; requires review")
                    w = self.get("way", member["ref"])
                    coords = [self.geometry("node", n, path + (key,)).coords[0] for n in w["nodes"]]
                    if len(coords) < 2: raise ValueError("Degenerate multipolygon member")
                    (inner if member["role"] == "inner" else outer).append(LineString(coords))
                def rings(lines):
                    if not lines: return GeometryCollection()
                    polygons, cuts, dangles, invalid = polygonize_full(lines)
                    if not cuts.is_empty or not dangles.is_empty or not invalid.is_empty:
                        raise ValueError("Unclosed or invalid multipolygon rings")
                    return unary_union(polygons)
                shell, holes = rings(outer), rings(inner)
                if shell.is_empty or (not holes.is_empty and not shell.covers(holes)):
                    raise ValueError("Missing outer ring or inner ring outside outer")
                geom = shell.difference(holes)
            else:
                geom = GeometryCollection([self.geometry(m["type"], m["ref"], path + (key,)) for m in e["members"]])
        if geom.is_empty or not geom.is_valid: raise ValueError(f"Invalid geometry {kind}/{ident}")
        return geom


def select(db, bbox, max_depth, max_members):
    db.execute("DELETE FROM features")
    db.execute("DELETE FROM wanted")
    db.execute("DELETE FROM issues WHERE stage='selection'")
    region = box(bbox[1], bbox[0], bbox[3], bbox[2])
    for kind, ident, body in db.execute("SELECT kind,id,body FROM objects WHERE candidate=1"):
        try:
            geom = Resolver(db, max_depth, max_members).geometry(kind, ident)
            if geom.intersects(region):
                db.execute("INSERT INTO features VALUES (?,?,?,?)", (kind, ident, json.dumps(mapping(geom)), json.dumps(categories(json.loads(body)))))
                db.execute("INSERT OR IGNORE INTO wanted(kind,id) VALUES (?,?)", (kind, ident))
        except ValueError as exc:
            db.execute("INSERT INTO issues VALUES ('selection',?,?,?)", (kind, ident, str(exc)))
    # Disk-backed work queue; no regional set of IDs held in Python.
    while True:
        row = db.execute("SELECT kind,id FROM wanted WHERE expanded=0 LIMIT 1").fetchone()
        if row is None: break
        kind, ident = row
        e = Resolver(db).get(kind, ident)
        refs = ([('node', n) for n in e["nodes"]] if kind == "way" else
                [(m["type"], m["ref"]) for m in e["members"]] if kind == "relation" else [])
        for ref in refs:
            Resolver(db).get(*ref)  # Must exist before output can be called complete.
            db.execute("INSERT OR IGNORE INTO wanted(kind,id) VALUES (?,?)", ref)
        db.execute("UPDATE wanted SET expanded=1 WHERE kind=? AND id=?", row)
    db.commit()


def export(db, source, folder):
    pbf = folder / "pilot.osm.pbf"
    pool = osmium.io.ThreadPool(1, 2)
    writer = osmium.SimpleWriter(str(pbf), thread_pool=pool)
    db.execute("CREATE TEMP TABLE emitted(kind TEXT,id INTEGER,PRIMARY KEY(kind,id)) WITHOUT ROWID")
    class Exporter(osmium.SimpleHandler):
        def add(self, o, kind):
            key = (kind, o.id)
            if db.execute("SELECT 1 FROM wanted WHERE kind=? AND id=?", key).fetchone():
                if db.execute("SELECT 1 FROM emitted WHERE kind=? AND id=?", key).fetchone(): return
                getattr(writer, "add_" + kind)(o)
                db.execute("INSERT INTO emitted VALUES (?,?)", key)
        def node(self, o): self.add(o, "node")
        def way(self, o): self.add(o, "way")
        def relation(self, o): self.add(o, "relation")
    try:
        stream(source, Exporter())
    finally:
        writer.close()
    if db.execute("SELECT COUNT(*) FROM wanted").fetchone() != db.execute("SELECT COUNT(*) FROM emitted").fetchone():
        raise ValueError("Output records missing from source scan")
    class Validator(osmium.SimpleHandler):
        count = 0
        def check(self, o, kind):
            expected = Resolver(db).get(kind, o.id)
            if record(o, kind) != expected: raise ValueError("PBF round-trip metadata/reference mismatch")
            self.count += 1
        def node(self, o): self.check(o, "node")
        def way(self, o): self.check(o, "way")
        def relation(self, o): self.check(o, "relation")
    validation = Validator()
    stream(pbf, validation)
    if validation.count != db.execute("SELECT COUNT(*) FROM wanted").fetchone()[0]:
        raise ValueError("Output PBF count mismatch")
    with (folder / "objects.jsonl").open("w", encoding="utf-8") as f:
        for body, selected in db.execute("SELECT o.body,f.id FROM wanted w JOIN objects o USING(kind,id) LEFT JOIN features f USING(kind,id)"):
            e = json.loads(body)
            e["extraction_role"] = "feature" if selected is not None else "geometry_support"
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    with (folder / "features.geojson").open("w", encoding="utf-8") as f:
        f.write('{"type":"FeatureCollection","features":[')
        sep = ""
        for kind, ident, geom, cats, body in db.execute("SELECT f.kind,f.id,f.geometry,f.categories,o.body FROM features f JOIN objects o USING(kind,id)"):
            props = json.loads(body)
            props["categories"] = json.loads(cats)
            f.write(sep + json.dumps(dict(type="Feature", id=f"{kind}/{ident}", geometry=json.loads(geom), properties=props), ensure_ascii=False))
            sep = ","
        f.write("]}\n")
    db.execute("DROP TABLE emitted")
    db.commit()


def quality(db):
    counts, types, lit, category_types = Counter(), Counter(), Counter(), Counter()
    roads = sidewalk = businesses = hours = 0
    for kind, cats, body in db.execute("SELECT f.kind,f.categories,o.body FROM features f JOIN objects o USING(kind,id)"):
        cs, t = json.loads(cats), json.loads(body)["tags"]
        counts.update(cs)
        category_types.update(f"{c}:{kind}" for c in cs)
        types[kind] += 1
        if "roads_and_pedestrian_ways" in cs:
            roads += 1
            lit[t.get("lit", "<absent>")] += 1
            sidewalk += any(k == "sidewalk" or k.startswith("sidewalk:") for k in t)
        if "shops_and_businesses" in cs:
            businesses += 1
            hours += bool(t.get("opening_hours", "").strip())
    def completeness(present, total):
        return dict(present=present, denominator=total, missing=total-present,
                    missing_percent=100*(total-present)/total if total else None)
    return dict(unique_features=sum(types.values()), feature_types=dict(types), category_memberships=dict(counts), category_types=dict(category_types),
                supporting_objects=db.execute("SELECT COUNT(*) FROM wanted").fetchone()[0]-sum(types.values()),
                source_unique_records=db.execute("SELECT COUNT(*) FROM objects").fetchone()[0],
                duplicate_records=dict(db.execute("SELECT name,value FROM counters")),
                lighting_values=dict(lit), lighting=completeness(roads-lit["<absent>"], roads),
                sidewalk_tag_presence=completeness(sidewalk, roads), opening_hours_nonblank=completeness(hours, businesses),
                unresolved_issues=db.execute("SELECT COUNT(*) FROM issues").fetchone()[0])


def potential_duplicates(db, folder):
    """Conservative same-name/category proximity hints; never merge objects."""
    from shapely.geometry import shape
    db.execute("CREATE TEMP TABLE facilities(kind TEXT,id INTEGER,name TEXT,x REAL,y REAL,cats TEXT)")
    relevant = {"police_stations", "healthcare_facilities", "shops_and_businesses"}
    for kind, ident, geom, cats, body in db.execute("SELECT f.kind,f.id,f.geometry,f.categories,o.body FROM features f JOIN objects o USING(kind,id)"):
        groups = relevant.intersection(json.loads(cats))
        name = " ".join(json.loads(body)["tags"].get("name", "").casefold().split())
        if groups and name:
            p = shape(json.loads(geom)).representative_point()
            db.execute("INSERT INTO facilities VALUES (?,?,?,?,?,?)", (kind, ident, name, p.x, p.y, json.dumps(sorted(groups))))
    db.execute("CREATE INDEX facility_names ON facilities(name)")
    geod, count = pyproj.Geod(ellps="WGS84"), 0
    with (folder/"potential_duplicates.jsonl").open("w", encoding="utf-8") as f:
        for a, ai, b, bi, ax, ay, bx, by, ac, bc in db.execute("SELECT a.kind,a.id,b.kind,b.id,a.x,a.y,b.x,b.y,a.cats,b.cats FROM facilities a JOIN facilities b ON a.name=b.name AND (a.kind<b.kind OR (a.kind=b.kind AND a.id<b.id)) AND ABS(a.x-b.x)<0.001 AND ABS(a.y-b.y)<0.001"):
            distance = geod.inv(ax, ay, bx, by)[2]
            if distance <= 30 and set(json.loads(ac)).intersection(json.loads(bc)):
                count += 1
                f.write(json.dumps(dict(first=f"{a}/{ai}", second=f"{b}/{bi}", distance_metres=distance, reason="same normalized name/category within 30m; review only"))+"\n")
    db.execute("DROP TABLE facilities")
    return count


def run(source, output, resume=False, source_url=None, expected_sha256=None, cache_mb=64,
        max_depth=12, max_members=100000, stop_after=None):
    source, output = local(source), local(output)
    if source.suffix not in {".pbf", ".osm"}: raise ValueError("Supply a finished .pbf or synthetic .osm, not .part")
    if not 8 <= cache_mb <= 512 or not 1 <= max_depth <= 64 or not 10 <= max_members <= 1000000:
        raise ValueError("Invalid resource limits")
    boundary = json.loads(BOUNDARY.read_text(encoding="utf-8"))
    bbox = boundary["bbox_south_west_north_east"]
    fingerprint = dict(source_sha256=sha(source), source_bytes=source.stat().st_size,
                       boundary_sha256=sha(BOUNDARY), script_sha256=sha(Path(__file__)),
                       routes_sha256=sha(ROUTES), max_depth=max_depth, max_members=max_members,
                       versions={p: importlib.metadata.version(p) for p in ("osmium", "shapely", "pyproj")})
    if expected_sha256 and fingerprint["source_sha256"] != expected_sha256.lower(): raise ValueError("Source checksum mismatch")
    if output.exists() and not (output / "manifest.json").exists() and any(output.iterdir()):
        raise ValueError("Output folder contains files without this pipeline's manifest; choose a new folder")
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".lock"
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.close(fd)
    db = None
    manifest = None
    try:
        mp = output / "manifest.json"
        if mp.exists():
            if not resume: raise ValueError("Run exists; use --resume or a new output folder")
            saved = json.loads(mp.read_text(encoding="utf-8"))
            if saved["fingerprint"] != fingerprint: raise ValueError("Inputs, code or parameters changed; create a new run")
            if source_url is not None and saved["source_url"] != source_url:
                raise ValueError("Source URL changed; create a new run")
            manifest = saved
            if manifest["status"] in {"complete", "partial"}:
                for name, digest in manifest["artifacts"].items():
                    if sha(output / name) != digest: raise ValueError(f"Artifact changed: {name}")
                return manifest
        else:
            if resume: raise ValueError("Cannot resume without a manifest")
            manifest = dict(status="pending", created_at=utc(), fingerprint=fingerprint,
                            source_path=str(source.relative_to(ROOT)), source_url=source_url,
                            attribution="© OpenStreetMap contributors", license="ODbL 1.0",
                            license_url="https://www.openstreetmap.org/copyright",
                            bbox_south_west_north_east=bbox, stages={}, attempts=[])
        write_json(mp, manifest)
        if manifest["stages"].get("index") == "successful" and not (output / "index.sqlite").is_file():
            raise ValueError("Missing completed SQLite index; create a new run")
        db = connect(output / "index.sqlite", cache_mb)
        if db.execute("PRAGMA quick_check").fetchone()[0] != "ok": raise ValueError("SQLite integrity check failed")
        for stage in ("index", "selection", "export"):
            if manifest["stages"].get(stage) == "successful": continue
            manifest["status"] = "running"
            manifest["stages"][stage] = "running"
            write_json(mp, manifest)
            if stage == "index":
                for table in ("objects", "issues", "features", "wanted", "counters"):
                    db.execute(f"DELETE FROM {table}")
                db.commit()
                validate_pbf_framing(source)
                pool = osmium.io.ThreadPool(1, 2)
                with osmium.io.Reader(str(source), thread_pool=pool) as reader:
                    header = reader.header()
                    manifest["pbf_header"] = {k: header.get(k) for k in ("generator", "osmosis_replication_timestamp", "osmosis_replication_sequence_number", "osmosis_replication_base_url")}
                    if header.has_multiple_object_versions: raise ValueError("History PBF unsupported; supply a current snapshot")
                    osmium.apply(reader, Indexer(db))
                db.commit()
                manifest["indexed_records"] = db.execute("SELECT COUNT(*) FROM objects").fetchone()[0]
                if not manifest["indexed_records"]: raise ValueError("Empty OSM source; no records indexed")
            elif stage == "selection":
                if db.execute("SELECT COUNT(*) FROM objects").fetchone()[0] != manifest["indexed_records"]:
                    raise ValueError("SQLite index count changed; create a new run")
                select(db, bbox, max_depth, max_members)
            else:
                prefix = "partial_" if db.execute("SELECT COUNT(*) FROM issues").fetchone()[0] else "attempt_"
                folder = output / (prefix + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ"))
                folder.mkdir()
                manifest["attempts"].append(folder.name)
                write_json(mp, manifest)
                export(db, source, folder)
                manifest["output_folder"] = folder.name
            manifest["stages"][stage] = "successful"
            write_json(mp, manifest)
            if stop_after == stage: raise InterruptedError(f"Intentional checkpoint after {stage}")
        if sha(source) != fingerprint["source_sha256"]: raise ValueError("Source changed during processing")
        manifest["quality"] = quality(db)
        # Existing read-only geometric functions use saved real routes; no API call.
        import verify_route_coverage as coverage
        routes = json.loads(ROUTES.read_text(encoding="utf-8"))
        coverage.validate_routes(routes)
        manifest["route_coverage"] = [coverage.measure_route(r, bbox, 100)[0] for r in routes["routes"]]
        if len(routes["routes"]) != 3 or not all(r["analysis_buffer"]["fully_covered"] for r in manifest["route_coverage"]):
            raise ValueError("Saved route buffer coverage failed")
        manifest["status"] = "partial" if manifest["quality"]["unresolved_issues"] else "complete"
        manifest["completed_at"] = utc()
        folder = output / manifest["output_folder"]
        manifest["quality"]["potential_facility_duplicate_pairs"] = potential_duplicates(db, folder)
        with (folder / "issues.jsonl").open("w", encoding="utf-8") as f:
            for stage, kind, ident, message in db.execute("SELECT * FROM issues"):
                f.write(json.dumps(dict(stage=stage, type=kind, id=ident, message=message)) + "\n")
        report = (f"# Offline extraction: {manifest['status']}\n\n"
                  f"Source: `{manifest['source_path']}`; SHA-256 `{fingerprint['source_sha256']}`.\n\n"
                  f"Boundary [south, west, north, east]: {bbox}.\n\n"
                  f"Unique analysis features: {manifest['quality']['unique_features']}; supporting objects: {manifest['quality']['supporting_objects']}.\n\n"
                  "Counts overlap by category. See manifest.json for counts, tag completeness and route/buffer measurements; issues.jsonl lists unresolved geometry.\n\n"
                  + "| Category | Feature count |\n|---|---:|\n" + "".join(f"| {k} | {v} |\n" for k,v in sorted(manifest['quality']['category_memberships'].items())) + "\n"
                  + "```json\n" + json.dumps(manifest['quality'], indent=2) + "\n```\n\n"
                  + "| Saved route | Length inside (%) | 100m buffer inside (%) |\n|---|---:|---:|\n" + "".join(f"| {r['route_id']} | {r['inside_percent']:.6f} | {r['analysis_buffer']['inside_percent']:.6f} |\n" for r in manifest['route_coverage']) + "\n"
                  +
                  "Complete means the requested processing and reference checks passed for this source. It does not establish real-world mapping completeness or provider geographic coverage. Unknown lighting is not unlit; opening hours do not establish current operation.\n\n"
                  "Potential node/polygon facility duplicates are retained for later review, never merged by name. The hints use exact normalized names, shared category and representative points within 30m; unnamed or differently named duplicates can be missed. Public PBF metadata may omit user/changeset information; PyOsmium defaults of zero/empty are not evidence of supplied metadata.\n\n"
                  "© OpenStreetMap contributors; ODbL 1.0. No safety scores.\n")
        (folder / "REPORT.md").write_text(report, encoding="utf-8")
        manifest["artifacts"] = {str(p.relative_to(output)): sha(p) for p in folder.iterdir() if p.is_file()}
        write_json(mp, manifest)
        return manifest
    except BaseException as exc:
        if manifest is not None and manifest.get("status") not in {"complete", "partial"}:
            manifest["status"] = "interrupted" if isinstance(exc, (KeyboardInterrupt, InterruptedError)) else "failed"
            manifest["last_error"] = str(exc)
            write_json(output / "manifest.json", manifest)
        raise
    finally:
        if db is not None: db.close()
        lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--source-url")
    parser.add_argument("--expected-sha256")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--cache-mb", type=int, default=64)
    parser.add_argument("--max-depth", type=int, default=12)
    parser.add_argument("--max-members", type=int, default=100000)
    args = parser.parse_args()
    try:
        result = run(args.input, args.output, args.resume, args.source_url, args.expected_sha256,
                     args.cache_mb, args.max_depth, args.max_members)
        print(json.dumps({k: result[k] for k in ("status", "quality")}, indent=2))
        return 0 if result["status"] == "complete" else 2
    except Exception as exc:
        print(f"Extraction failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
