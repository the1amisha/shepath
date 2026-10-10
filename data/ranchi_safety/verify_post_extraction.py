"""Verify saved pilot outputs and measure 100 m route corridors. No network calls."""
from collections import Counter
from datetime import datetime, timezone
import json
import math
from pathlib import Path

import osmium
from shapely.geometry import LineString, Point, box, shape
from shapely.ops import transform, unary_union

import offline_pbf_extract as extract
import verify_route_coverage as coverage

ROOT = Path(__file__).resolve().parent
RUN = ROOT / "offline_runs/eastern_261008_ranchi_v1"
GROUPS = ("roads_and_pedestrian_ways", "pedestrian_infrastructure", "ways_with_lit_tag", "street_lamps",
          "police_stations", "healthcare_facilities", "hospitals", "pharmacies", "shops_and_businesses",
          "businesses_with_opening_hours")


def require(condition, message):
    if not condition: raise ValueError(message)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def key(e):
    return f"{e['type']}/{e['id']}"


def unique_records(records):
    result = {}
    for e in records:
        ident = key(e)
        require(ident not in result, f"Duplicate OSM identity: {ident}")
        result[ident] = e
    return result


def checked_artifacts(run, manifest):
    paths = []
    for relative, digest in manifest["artifacts"].items():
        path = (run / relative).resolve()
        require(path.is_relative_to(run.resolve()), "Artifact path escapes extraction run")
        require(path.is_file() and extract.sha(path) == digest, f"Artifact missing or hash mismatch: {relative}")
        paths.append(path)
    return paths


def completeness(present, total):
    return dict(present=present, total=total, missing=total-present,
                missing_percent=100*(total-present)/total if total else None)


def summarize(features):
    counts, types, category_types, lighting = Counter(), Counter(), Counter(), Counter()
    roads = sidewalk = businesses = hours = 0
    for f in features:
        props, cats = f["properties"], f["properties"]["categories"]
        tags = props["tags"]
        counts.update(cats)
        types[props["type"]] += 1
        category_types.update(f"{c}:{props['type']}" for c in cats)
        if "roads_and_pedestrian_ways" in cats:
            roads += 1
            lighting[tags.get("lit", "<absent>")] += 1
            sidewalk += any(k == "sidewalk" or k.startswith("sidewalk:") for k in tags)
        if "shops_and_businesses" in cats:
            businesses += 1
            hours += bool(tags.get("opening_hours", "").strip())
    return dict(unique_features=len(features),types=dict(types),category_types=dict(category_types),
                counts={g: counts[g] for g in GROUPS}, lighting_values=dict(lighting),
                lighting=completeness(roads-lighting['<absent>'],roads),
                sidewalk=completeness(sidewalk,roads),opening_hours=completeness(hours,businesses))


def validate_geometries(features, records, region):
    class Resolver(extract.Resolver):
        def get(self, kind, ident):
            ident = f"{kind}/{ident}"
            require(ident in records, f"Missing reference: {ident}")
            return records[ident]
    ids, exterior = set(), 0
    for ident, obj in records.items():
        if obj["type"] == "node":
            p = obj.get("coordinates")
            require(p is not None and len(p)==2 and all(math.isfinite(v) for v in p)
                    and -180 <= p[0] <= 180 and -90 <= p[1] <= 90, f"Invalid node: {ident}")
        refs = ([f"node/{n}" for n in obj["nodes"]] if obj["type"] == "way" else
                [f"{m['type']}/{m['ref']}" for m in obj["members"]] if obj["type"] == "relation" else [])
        require(all(r in records for r in refs), f"Unresolved references: {ident}")
    for f in features:
        p = f["properties"]
        ident = key(p)
        require(f["type"] == "Feature" and f["id"] == ident and ident not in ids, "Duplicate/inconsistent feature identity")
        ids.add(ident)
        require(ident in records and records[ident]["extraction_role"] == "feature", f"Missing feature object: {ident}")
        original = {k:v for k,v in records[ident].items() if k != "extraction_role"}
        require({k:v for k,v in p.items() if k != "categories"} == original, f"Feature metadata mismatch: {ident}")
        require(sorted(p["categories"]) == sorted(extract.categories(original)), f"Category mismatch: {ident}")
        geom = shape(f["geometry"])
        require(not geom.is_empty and geom.is_valid, f"Invalid feature geometry: {ident}")
        require(geom.intersects(region), f"Feature does not intersect pilot: {ident}")
        rebuilt = Resolver(None).geometry(p["type"],p["id"])
        require(geom.equals_exact(rebuilt, 1e-10), f"Reconstructed geometry mismatch: {ident}")
        exterior += not region.covers(geom)
    require(ids == {i for i,e in records.items() if e["extraction_role"] == "feature"}, "Feature/object membership mismatch")
    require(all(e["extraction_role"] in {"feature","geometry_support"} for e in records.values()), "Unknown object role")
    return exterior


def verify_pilot_pbf(path, records):
    seen = set()
    class Check(osmium.SimpleHandler):
        def check(self, o, kind):
            e = extract.record(o,kind)
            ident = key(e)
            require(ident not in seen and ident in records, f"Unexpected/duplicate PBF object: {ident}")
            require(e == {k:v for k,v in records[ident].items() if k != 'extraction_role'}, f"PBF metadata mismatch: {ident}")
            seen.add(ident)
        def node(self,o): self.check(o,"node")
        def way(self,o): self.check(o,"way")
        def relation(self,o): self.check(o,"relation")
    extract.stream(path,Check())
    require(seen == set(records), "PBF/JSONL identities disagree")


def analyze_corridor(line, projected, radius=100):
    """All geometries are in metre-based UTM 45N. Counts use full-shape intersection."""
    corridor = line.buffer(radius,quad_segs=64)
    selected = [(f,g) for f,g in projected if g.intersects(corridor)]
    stats = summarize([f for f,g in selected])
    stats["ids"] = [f["id"] for f,g in selected]
    stats["road_length_in_buffer_metres"] = 0.0
    stats["lit_tagged_road_length_in_buffer_metres"] = 0.0
    stats["sidewalk_tagged_road_length_in_buffer_metres"] = 0.0
    for f,g in selected:
        if "roads_and_pedestrian_ways" in f["properties"]["categories"]:
            # Area-tagged pedestrian polygons aren't road centerlines and have no line length here.
            length = sum(part.length for part in coverage.line_parts(g.intersection(corridor)))
            stats["road_length_in_buffer_metres"] += length
            if 'lit' in f['properties']['tags']: stats["lit_tagged_road_length_in_buffer_metres"] += length
            if any(k=='sidewalk' or k.startswith('sidewalk:') for k in f['properties']['tags']):
                stats["sidewalk_tagged_road_length_in_buffer_metres"] += length
    proximity = {}
    segments = [LineString([a,b]) for a,b in zip(line.coords,list(line.coords)[1:]) if a != b]
    for group in ("roads_and_pedestrian_ways","ways_with_lit_tag","shops_and_businesses","healthcare_facilities","police_stations"):
        nearby = [g.buffer(radius,quad_segs=64) for f,g in selected if group in f['properties']['categories']]
        # Preserve repeated traversal distance if a route doubles back over the same segment.
        area = unary_union(nearby) if nearby else None
        distance = sum(segment.intersection(area).length for segment in segments) if nearby else 0.0
        proximity[group] = dict(length_metres=distance, route_length_percent=100*distance/line.length if line.length else None)
    stats["route_length_within_100m_of_category"] = proximity
    return stats


def run():
    manifest = load(RUN/'manifest.json')
    require(manifest['status']=='complete', 'Extraction is not complete; stop analysis')
    require(all(manifest['stages'].get(k)=='successful' for k in ('index','selection','export')), 'Incomplete stages')
    require(manifest['quality']['unresolved_issues']==0,'Unresolved extraction issues')
    paths = checked_artifacts(RUN,manifest)
    def artifact(name):
        found = [p for p in paths if p.name==name]
        require(len(found)==1,f'Missing or ambiguous artifact: {name}')
        return found[0]
    for path, field in ((extract.BOUNDARY,'boundary_sha256'),(extract.ROUTES,'routes_sha256'),(Path(extract.__file__),'script_sha256')):
        require(extract.sha(path)==manifest['fingerprint'][field],f'Changed source input: {path.name}')
    require(artifact('issues.jsonl').stat().st_size==0,'Nonempty issue log')
    source = extract.local(ROOT/manifest['source_path'])
    require(source.stat().st_size==manifest['fingerprint']['source_bytes'] and extract.sha(source)==manifest['fingerprint']['source_sha256'],'Regional source identity mismatch')
    bbox = load(extract.BOUNDARY)['bbox_south_west_north_east']
    require(bbox==manifest['bbox_south_west_north_east'],'Boundary mismatch')
    region = box(bbox[1],bbox[0],bbox[3],bbox[2])
    data = load(artifact('features.geojson'))
    require(data['type']=='FeatureCollection','Invalid GeoJSON collection')
    features = data['features']
    with artifact('objects.jsonl').open(encoding='utf-8') as f:
        records = unique_records(json.loads(line) for line in f if line.strip())
    exterior = validate_geometries(features,records,region)
    verify_pilot_pbf(artifact('pilot.osm.pbf'),records)
    total = summarize(features)
    quality = manifest['quality']
    require(total['unique_features']==quality['unique_features'],'Feature count mismatch')
    require(total['types']==quality['feature_types'] and total['category_types']==quality['category_types'],'Category/type count mismatch')
    require(all(total['counts'][k]==quality['category_memberships'].get(k,0) for k in GROUPS),'Category count mismatch')
    require(total['lighting_values']==quality['lighting_values'],'Lighting values mismatch')
    for ours, original in (('lighting','lighting'),('sidewalk','sidewalk_tag_presence'),('opening_hours','opening_hours_nonblank')):
        require(total[ours]['present']==quality[original]['present'] and total[ours]['missing']==quality[original]['missing'],f'Completeness mismatch: {ours}')
    support = len(records)-len(features)
    require(support==quality['supporting_objects'],'Supporting count mismatch')
    duplicates = [json.loads(line) for line in artifact('potential_duplicates.jsonl').read_text().splitlines() if line.strip()]
    require(len(duplicates)==quality['potential_facility_duplicate_pairs'],'Duplicate hint count mismatch')
    by_id = {f['id']:f for f in features}
    for pair in duplicates:
        require(pair['first'] in by_id and pair['second'] in by_id,'Duplicate hint references nonexistent feature')
        a,b = (by_id[pair[k]] for k in ('first','second'))
        names = [' '.join(f['properties']['tags'].get('name','').casefold().split()) for f in (a,b)]
        require(names[0] and names[0]==names[1],'Duplicate hint names mismatch')
        ap,bp = (shape(f['geometry']).representative_point() for f in (a,b))
        distance = coverage.GEOD.inv(ap.x,ap.y,bp.x,bp.y)[2]
        require(distance<=30 and abs(distance-pair['distance_metres'])<0.01,'Duplicate hint distance mismatch')
        pair['names'] = [f['properties']['tags'].get('name') for f in (a,b)]
    routes = load(extract.ROUTES)
    coverage.validate_routes(routes)
    require(len(routes['routes'])==3,'Expected three saved walking routes')
    projected = [(f,transform(coverage.TO_METRES.transform,shape(f['geometry']))) for f in features]
    results = []
    for route in routes['routes']:
        geographic,_ = coverage.measure_route(route,bbox,100)
        require(geographic['centerline_fully_covered'] and geographic['analysis_buffer']['fully_covered'],'Route/buffer not fully covered; stop')
        line = transform(coverage.TO_METRES.transform,LineString(coverage.densify([(lon,lat) for lat,lon in route['coordinates']])))
        stats = analyze_corridor(line,projected)
        stats['route_id'] = route['id']
        stats['backend_distance_metres'] = route['distanceMeters']
        stats['geographic_coverage'] = geographic
        stats['duplicate_hints'] = [p for p in duplicates if p['first'] in stats['ids'] or p['second'] in stats['ids']]
        results.append(stats)
    result = dict(checked_at_utc=datetime.now(timezone.utc).isoformat(),status='passed',
        manifest_sha256=extract.sha(RUN/'manifest.json'),source_sha256=manifest['fingerprint']['source_sha256'],
        analysis_script_sha256=extract.sha(Path(__file__)),routes_sha256=extract.sha(extract.ROUTES),
        boundary=bbox,snapshot_timestamp=manifest['pbf_header']['osmosis_replication_timestamp'],
        artifact_hashes_checked=len(paths),pbf_records_verified=len(records),supporting_objects=support,
        features_extending_outside_boundary=exterior,summary=total,duplicates=duplicates,routes=results)
    folder = ROOT/'post_verification_runs'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S_%fZ')
    folder.mkdir(parents=True)
    extract.write_json(folder/'results.json',result)
    write_report(result,folder)
    print(json.dumps({k:v for k,v in result.items() if k not in {'routes','duplicates'}},indent=2))
    print('Evidence:',folder)
    return result


def write_report(result,folder):
    total, routes = result['summary'],result['routes']
    lines = ['# Post-extraction verification and 100-metre route feature analysis','',
        f"Checked {result['checked_at_utc']}. **All implemented integrity and geographic checks passed.** Ready for an explainable route-feature prototype, subject to sparse tags and duplicate review. No safety scores or safety conclusions are supported by these results.", '',
        f"Source OSM snapshot: {result['snapshot_timestamp']}. Pilot bbox [south, west, north, east]: {result['boundary']}.", '',
        '## Verification', '',
        f"Verified {result['artifact_hashes_checked']} artifact hashes, the regional source hash, saved boundary/route hashes and extractor version hash. Parsed the small exported PBF and compared all {result['pbf_records_verified']:,} typed objects, tags, metadata and references with JSONL. Rebuilt every feature geometry from references and compared it to GeoJSON. Category counts and lighting/sidewalk/opening-hours completeness match the manifest. Issues log is empty; typed IDs are unique and references are closed.", '',
        f"There are {total['unique_features']:,} analysis features and {result['supporting_objects']:,} geometry-support objects. {result['features_extending_outside_boundary']} feature geometries extend beyond the box but intersect it, as expected from complete crossing-way preservation. All three real saved route centerlines and their full 100 m buffers remain inside the pilot (100% to displayed precision). The regional SQLite index was not rescanned and extraction was not rerun.", '',
        '## Pilot inventory','', '| Category | Nodes | Ways | Relations | Total |','|---|---:|---:|---:|---:|']
    for c in GROUPS:
        lines.append(f"| {c} | {total['category_types'].get(c+':node',0)} | {total['category_types'].get(c+':way',0)} | {total['category_types'].get(c+':relation',0)} | {total['counts'][c]} |")
    lines += ['',f"Road lighting: {total['lighting']['present']}/{total['lighting']['total']} recorded ({total['lighting']['missing_percent']:.2f}% absent); values {total['lighting_values']}. Sidewalk keys: {total['sidewalk']['present']}/{total['sidewalk']['total']} ({total['sidewalk']['missing_percent']:.2f}% absent). Nonblank business opening hours: {total['opening_hours']['present']}/{total['opening_hours']['total']} ({total['opening_hours']['missing_percent']:.2f}% absent).",'',
        '## Features intersecting each route buffer','',
        'Route IDs are heigit-foot-walking-route-1, -2 and -3. Counts below use complete geometry intersection with a 100 m corridor in EPSG:32645 (UTM 45N). Coordinates from the saved routes are converted from latitude/longitude to longitude/latitude, densified, then projected. Features touching the corridor boundary count. Each typed OSM ID counts once per route; category and route memberships overlap. Counts across categories or routes must not be summed into a unique inventory. Geometry-support objects are excluded.', '',
        '| Metric | Route 1 | Route 2 | Route 3 |','|---|---:|---:|---:|']
    def row(label,values): lines.append('| '+label+' | '+' | '.join(str(v) for v in values)+' |')
    row('Backend walking distance (m)',[r['backend_distance_metres'] for r in routes])
    row('Unique corridor features',[r['unique_features'] for r in routes])
    for c in GROUPS: row(c,[r['counts'][c] for r in routes])
    for label,k in [('Lighting tags absent (%)','lighting'),('Sidewalk tags absent (%)','sidewalk'),('Business hours absent/blank (%)','opening_hours')]:
        row(label,[f"{r[k]['missing_percent']:.2f}" if r[k]['missing_percent'] is not None else 'N/A' for r in routes])
    row('Recorded road lit=yes',[r['lighting_values'].get('yes',0) for r in routes])
    row('Recorded road lit=no',[r['lighting_values'].get('no',0) for r in routes])
    row('Road line length inside corridor (m)',[round(r['road_length_in_buffer_metres'],1) for r in routes])
    row('Of that, line length with any lit tag (m)',[round(r['lit_tagged_road_length_in_buffer_metres'],1) for r in routes])
    row('Of that, line length with sidewalk keys (m)',[round(r['sidewalk_tagged_road_length_in_buffer_metres'],1) for r in routes])
    lines += ['', 'Road-length figures sum clipped OSM way segments, not the walked route length. Nearby parallel/cross streets are included; overlapping geometries can contribute separately. Polygonal pedestrian areas have no centerline length in these figures.', '',
        '## Route length within 100 m of mapped features','',
        'This second measure intersects the actual route polyline with the union of 100 m buffers around each category’s feature geometries. Overlap is counted once. It describes mapped proximity along the route, not which OSM street the user walks, actual lighting of that street, access to a facility entrance, operating status, service capacity or real-world completeness.', '',
        '| Category proximity | Route 1 (%) | Route 2 (%) | Route 3 (%) |','|---|---:|---:|---:|']
    for c in routes[0]['route_length_within_100m_of_category']:
        row(c,[f"{r['route_length_within_100m_of_category'][c]['route_length_percent']:.2f}" for r in routes])
    lines += ['', '## Potential duplicates', '',
        'No duplicate typed OSM IDs were found. Four existing same-name/category proximity hints were rechecked; no objects were merged. These hints use representative points within 30 m and can miss unnamed or differently named node/polygon duplicates. Similar names near each other can also represent distinct facilities.', '',
        '| Pair | Recorded name | Separation (m) | Route buffers containing either record |', '|---|---|---:|---|']
    for p in result['duplicates']:
        membership=', '.join(str(i+1) for i,r in enumerate(routes) if p['first'] in r['ids'] or p['second'] in r['ids']) or 'None'
        lines.append(f"| {p['first']} / {p['second']} | {p['names'][0].replace('|','/')} | {p['distance_metres']:.2f} | {membership} |")
    lines += ['', '## Limits and next step', '',
        '- Missing lit/sidewalk tags mean unknown mapping information. Explicit lit=no is a recorded tag, not a safety assessment. Zero lamps means no mapped lamp records in this extraction scope; it does not mean no physical lamps exist.',
        '- Opening hours are sparse. A business record does not prove it is currently open. Facilities may have moved or changed since the snapshot; public OSM metadata has known omissions.',
        '- Highway ways include differing access and road classes. Corridor membership is not walking accessibility or a street match. Add validated route-to-road matching, explicit denominators and unknown flags before attributing street properties to a walked segment.',
        '- Geographic containment and valid output geometry establish a usable local dataset, not exhaustive OSM selection correctness or real-world feature completeness. This verifies exported data; it does not independently reselect all 44 million regional objects.',
        '- Ready for route-level feature engineering based on explainable mapped proximity/counts, road geometry and explicit tag-availability measures. Review duplicate hints first for facility-count comparisons. Lighting and opening hours are too sparse for complete route-wide claims. Do not infer safety from presence, absence or missingness.', '',
        '## Reproduce and evidence', '',
        'Run from D:\\shepath:', '', '```powershell',
        '.\\data\\ranchi_safety\\.pbf_venv\\Scripts\\python.exe data\\ranchi_safety\\verify_post_extraction.py',
        '.\\data\\ranchi_safety\\.pbf_venv\\Scripts\\python.exe -m unittest discover -s data/ranchi_safety -p test_post_extraction.py -v','```','',
        f"Detailed measurements and exact per-route feature IDs: [{folder.name}/results.json]({folder.relative_to(ROOT).as_posix()}/results.json). All source extraction artifacts remain unchanged. No additional routing/Overpass requests were made. © OpenStreetMap contributors, ODbL 1.0; source provider Geofabrik."]
    (ROOT/'POST_EXTRACTION_VERIFICATION_REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


if __name__=='__main__':
    try: run()
    except (ValueError, OSError, KeyError) as exc:
        print(f'Verification stopped; no route results published: {exc}')
        raise SystemExit(1)
