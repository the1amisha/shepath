"""Create Phase 5A route-context JSON artifacts from verified local inputs only."""
import argparse
from datetime import datetime, timezone
import importlib.metadata
import json
from pathlib import Path

from shapely.geometry import LineString, box, shape
from shapely.ops import transform

import route_feature_metrics as metrics
import verify_post_extraction as verify

ROOT = Path(__file__).resolve().parent
REVIEWS = {
    frozenset(('node/2426783543','node/4245892677')):'Same bakery name/category 28.82 m apart; one has cuisine detail and multilingual names differ. Neither has a unique shared business identifier. Could be separate entrances, premises or duplicate mapping; retain both.',
    frozenset(('node/2910379109','node/2910383874')):'Same bank brand/name 28.92 m apart. One explicitly says branch=administration office; the other has a website. A shared brand is not a unique branch identity. May represent different functions; retain both.',
    frozenset(('node/6235433846','node/9289123731')):'Near-coincident medical-store names (0.42 m), but hospital/general-clinic tags conflict with pharmacy tags and edit dates differ. Likely identity/classification ambiguity needing local or edit-history validation. Do not merge or relabel either record.',
    frozenset(('way/516914807','way/1360582441')):'Same fuel-station name and overlapping polygons of different size, with 2021 versus 2025 edits and different address/operator detail. Plausible duplicate or site/component representation; no verified common entity identifier. Retain both and publish conditional business count.'}


def canonical(data):
    return json.dumps(data,sort_keys=True,ensure_ascii=False,allow_nan=False,indent=2)+'\n'


def read_inputs():
    """Revalidate small exported artifacts without rewriting prior reports or scanning regional index."""
    manifest = verify.load(verify.RUN/'manifest.json')
    verify.require(manifest['status']=='complete' and manifest['quality']['unresolved_issues']==0,'Extraction not usable')
    verify.require(all(manifest['stages'].get(s)=='successful' for s in ('index','selection','export')),'Incomplete extraction stages')
    paths = verify.checked_artifacts(verify.RUN,manifest)
    def artifact(name):
        found=[p for p in paths if p.name==name]
        verify.require(len(found)==1,'Ambiguous/missing artifact '+name)
        return found[0]
    for path,field in ((verify.extract.BOUNDARY,'boundary_sha256'),(verify.extract.ROUTES,'routes_sha256'),(Path(verify.extract.__file__),'script_sha256')):
        verify.require(verify.extract.sha(path)==manifest['fingerprint'][field],'Changed verified input '+path.name)
    verify.require(artifact('issues.jsonl').stat().st_size==0,'Nonempty extraction issue log')
    geojson=verify.load(artifact('features.geojson'))
    verify.require(geojson['type']=='FeatureCollection','Invalid GeoJSON')
    features=geojson['features']
    with artifact('objects.jsonl').open(encoding='utf-8') as f:
        records=verify.unique_records(json.loads(line) for line in f if line.strip())
    bbox=verify.load(verify.extract.BOUNDARY)['bbox_south_west_north_east']
    verify.require(bbox==manifest['bbox_south_west_north_east'],'Boundary mismatch')
    verify.validate_geometries(features,records,box(bbox[1],bbox[0],bbox[3],bbox[2]))
    verify.verify_pilot_pbf(artifact('pilot.osm.pbf'),records)
    summary=verify.summarize(features)
    verify.require(summary['unique_features']==manifest['quality']['unique_features'],'Unexpected feature count')
    verify.require(summary['category_types']==manifest['quality']['category_types'],'Category breakdown changed')
    pairs=[json.loads(x) for x in artifact('potential_duplicates.jsonl').read_text(encoding='utf-8').splitlines() if x.strip()]
    verify.require(len(pairs)==manifest['quality']['potential_facility_duplicate_pairs'],'Duplicate pair count mismatch')
    routes=verify.load(verify.extract.ROUTES)
    verify.coverage.validate_routes(routes)
    verify.require(len(routes['routes'])==3,'Expected three saved routes')
    return manifest,bbox,features,pairs,routes


def inspect_duplicates(features,pairs):
    lookup={f['id']:f for f in features}
    reviews=[]
    for p in sorted(pairs,key=lambda p:(p['first'],p['second'])):
        a,b=lookup[p['first']],lookup[p['second']]
        ga,gb=[transform(verify.coverage.TO_METRES.transform,shape(f['geometry'])) for f in (a,b)]
        union=ga.union(gb).area
        matching={k:v for k,v in a['properties']['tags'].items() if b['properties']['tags'].get(k)==v}
        different={k:[a['properties']['tags'].get(k),b['properties']['tags'].get(k)] for k in sorted(set(a['properties']['tags'])|set(b['properties']['tags'])) if a['properties']['tags'].get(k)!=b['properties']['tags'].get(k)}
        reviews.append({'first':p['first'],'second':p['second'],
            'decision':'retain_separate_ambiguous','records_merged':False,
            'review':REVIEWS.get(frozenset((p['first'],p['second'])),'Unreviewed identity; retain separate.'),
            'representative_point_distance_metres':p['distance_metres'],
            'minimum_geometry_distance_metres':ga.distance(gb),
            'intersection_area_m2':ga.intersection(gb).area,
            'polygon_intersection_over_union':ga.intersection(gb).area/union if union else None,
            'matching_tags':matching,'differing_tags':different,
            'original_records':[a['properties'],b['properties']]})
    return reviews


def build_dataset(manifest,bbox,features,pairs,saved):
    projected=[(f,transform(verify.coverage.TO_METRES.transform,shape(f['geometry']))) for f in sorted(features,key=lambda f:f['id'])]
    routes=[]
    for route in sorted(saved['routes'],key=lambda r:r['id']):
        geographic,_=verify.coverage.measure_route(route,bbox,100)
        verify.require(geographic['analysis_buffer']['fully_covered'] and geographic['centerline_fully_covered'],'Incomplete route extent')
        coords=[(lon,lat) for lat,lon in route['coordinates']]
        line=transform(verify.coverage.TO_METRES.transform,LineString(verify.coverage.densify(coords)))
        row=metrics.engineer_metric_route(line,projected,pairs,100)
        row.update(route_id=route['id'],route_length_geodesic_metres=geographic['polyline_length_metres'],
                   backend_distance_metres=route['distanceMeters'],backend_duration_seconds=route['durationSeconds'],
                   geographic_coverage=geographic)
        row['evidence_confidence'].update(source_artifact_integrity='hash_and_geometry_verified',geographic_extent='complete_100m_buffer',
            lighting_availability=row['lighting']['availability_indicator'],sidewalk_availability=row['sidewalk']['availability_indicator'],
            business_hours_availability='no_business_records' if not row['opening_hours']['nonblank']['denominator'] else 'absent' if not row['opening_hours']['nonblank']['numerator'] else 'complete_in_selected_records' if row['opening_hours']['nonblank']['percent']==100 else 'partial_in_selected_records')
        routes.append(row)
    module_paths=[Path(__file__),Path(metrics.__file__),Path(verify.__file__),Path(verify.extract.__file__),Path(verify.coverage.__file__)]
    return {'schema_version':'SHEPATH.phase5a.v1','scope':'offline_route_safety_context_evidence_no_safety_score',
        'provenance':{'extraction_manifest_sha256':verify.extract.sha(verify.RUN/'manifest.json'),
            'source_pbf_sha256':manifest['fingerprint']['source_sha256'],'OSM_snapshot_timestamp':manifest['pbf_header']['osmosis_replication_timestamp'],
            'extraction_source_url':manifest['source_url'],'artifact_hashes':manifest['artifacts'],
            'saved_routes_sha256':verify.extract.sha(verify.extract.ROUTES),'route_retrieved_at_utc':saved['retrieved_at_utc'],
            'boundary_sha256':verify.extract.sha(verify.extract.BOUNDARY),
            'code_sha256':{p.name:verify.extract.sha(p) for p in module_paths},
            'versions':{p:importlib.metadata.version(p) for p in ('osmium','shapely','pyproj')},
            'attribution':'© OpenStreetMap contributors','license':'ODbL 1.0'},
        'method':{'buffer_metres':100,'metric_crs':'EPSG:32645','input_OSM_coordinate_order':'longitude,latitude',
            'input_route_coordinate_order':'latitude,longitude','buffer_quadrant_segments':64,
            'route_densification_max_metres':verify.coverage.STEP_METRES,
            'proximity_percentage_denominator':'projected_route_length_metres, not backend distance',
            'actual_length_definition':'geodesic length of saved route polyline; not a surveyed pedestrian travel distance',
            'boundary':bbox,'selection':'full_geometry_intersects_closed_route_buffer; boundary touches included',
            'union':'category buffers unioned; each traversed route segment measured independently',
            'unknown':'null means not measured/unverified; zero only means zero matching records/geometric proximity'},
        'routes':routes}


def write_report(data,reviews,out):
    rs=data['routes']
    lines=['# Phase 5A — Route-level safety-context features','',
        '**Ready for an evidence-aware comparison of mapped context. Actual street attributes remain unverified.** This dataset contains no personal-safety scores, safety labels, operating-status guesses or pedestrian-activity estimates.','',
        '## Method and outputs','',
        'The three previously saved HeiGIT walking routes are processed independently. The verified pilot PBF/JSONL/GeoJSON artifacts are rechecked locally; no regional extraction or network request occurs. All route centerlines and complete 100 m buffers fit the existing pilot boundary. Full OSM geometry intersections include crossing features and buffer-edge touches. Each typed OSM ID counts once per route, while categories and routes can overlap.','',
        f"Output folder: `{out.relative_to(ROOT).as_posix()}`. `route_features.json` is the canonical dataset; individual route JSON files contain the same per-route records. `feature_evidence.json` preserves original feature IDs, tags, versions, edit timestamps and geometries for audit. `duplicate_review.json` records the four decisions and geometry/tag comparisons. `run_manifest.json` hashes all outputs. No input artifacts are overwritten.",'',
        'Measured geodesic polyline length is distinguished from the backend distance and UTM projected length. Proximity percentages use projected traversed route length: the route is intersected with the union of 100 m buffers around matching features. Overlap counts once, repeated travel along a segment counts each traversal. Corridor roads can be parallel or crossing roads, not the actual walked street.','',
        '## Route comparison','', '| Metric | Route 1 | Route 2 | Route 3 |','|---|---:|---:|---:|']
    def row(name,values): lines.append('| '+name+' | '+' | '.join(str(x) for x in values)+' |')
    row('Geodesic route polyline length (m)',[round(r['route_length_geodesic_metres'],1) for r in rs])
    row('Backend distance (m)',[r['backend_distance_metres'] for r in rs])
    for c in ('roads_and_pedestrian_ways','pedestrian_infrastructure','shops_and_businesses','healthcare_facilities','hospitals','pharmacies','police_stations','street_lamps'):
        row(c+' — nearby records',[r['categories'][c]['count'] for r in rs])
        row(c+' — route proximity (%)',[round(r['categories'][c]['route_proximity']['percent'],2) for r in rs])
    for state in ('yes','no','other_recorded','unknown'):
        row('Nearby road lit='+state+' count',[r['lighting']['states'][state]['object_availability']['numerator'] for r in rs])
        row('Route near lit='+state+' roads (%)',[round(r['lighting']['states'][state]['route_proximity']['percent'],2) for r in rs])
    row('Usable sidewalk-family tags / nearby roads',[f"{r['sidewalk']['usable_tag_availability']['numerator']}/{r['sidewalk']['usable_tag_availability']['denominator']}" for r in rs])
    row('Unknown sidewalk-family tags / nearby roads',[r['sidewalk']['states']['unknown']['object_availability']['numerator'] for r in rs])
    row('Nonblank opening hours / nearby businesses',[f"{r['opening_hours']['nonblank']['numerator']}/{r['opening_hours']['nonblank']['denominator']}" for r in rs])
    row('Business count if flagged pairs each represent one entity',[r['duplicate_sensitivity']['shops_and_businesses']['conditional_count_if_all_flagged_pairs_same_entity'] for r in rs])
    lines += ['', 'The lit=yes/no/other/unknown object counts partition nearby roads, but their route-proximity percentages do not partition the route: a point can be near differently tagged roads. Unknown lighting includes absent/blank and literal unknown tags. Other recorded values are preserved without treating them as yes or no. Sidewalk-family availability includes directional/detail keys and does not prove sidewalk existence or continuity. Exact denominators, units, raw values and IDs are in JSON.', '',
        '## Duplicate inspection and count sensitivity','']
    for review in reviews:
        lines += [f"- **{review['first']} + {review['second']}**: {review['review']} Geometry minimum distance {review['minimum_geometry_distance_metres']:.2f} m; overlap area {review['intersection_area_m2']:.2f} m². No merge."]
    lines += ['', 'Only the fuel-station pair affects these buffers. Route 2 retains 54 business OSM records; 53 is a conditional same-entity scenario, not an asserted physical-business count or a statistical confidence interval. Other pairs have no selected members along these three corridors. Geometry unions prevent additive proximity double-counting, but uncertain facility extents still affect proximity. Unflagged semantic duplicates may remain.', '',
        '## Evidence confidence and availability','',
        'Confidence indicators are categorical descriptions of evidence, never probabilities of personal safety: source integrity is verified, corridor extent is complete, record-based geometry is reproducible, real-world OSM completeness is unknown, and actual street attribution is unverified. Lighting/sidewalk/hour availability is reported as absent, partial or complete only relative to selected records. Each flag has the corresponding count denominator; zero matching landmarks means zero extracted records, not verified physical absence.', '',
        '`verified_on_walked_street.osm_ids` and actual street tag coverage are null with status `not_performed`. No automatic nearest-road match is presented as verified. Business current-open status and pedestrian activity remain unavailable. Recorded opening-hours strings are retained, but syntax, holidays and current operation are not evaluated.', '',
        '## What the prototype can support','',
        '- Compare measured route length, mapped nearby business/healthcare/police/pedestrian context, proximity coverage and explicit missingness, with OSM IDs available for inspection.',
        '- Display raw facility counts alongside duplicate sensitivity and unknown-data indicators. Do not use unknown tags as a negative score or rank routes by personal safety.',
        '- Before attaching lighting/sidewalk tags to the walked street, validate route-to-road matching using geometry, topology and pedestrian access. Street-level attributes are currently unverified for all three routes.',
        '- Obtain field or other validated evidence for lighting condition/continuity, pedestrian activity, facility access and current business operation. Lighting, sidewalk and hours tags are too sparse for comprehensive street-level comparisons.',
        '- This is a single OSM snapshot and three overlapping example routes, not a representative training dataset. Resolve important facility identity/classification ambiguities before counting physical establishments.', '',
        '## Reproduce','', 'From `D:\\shepath`:', '', '```powershell',
        '.\\data\\ranchi_safety\\.pbf_venv\\Scripts\\python.exe data\\ranchi_safety\\build_route_features.py',
        '.\\data\\ranchi_safety\\.pbf_venv\\Scripts\\python.exe -m unittest discover -s data/ranchi_safety -p test_route_features.py -v','```','',
        'Each run creates a new timestamped folder. Canonical feature JSON excludes wall-clock run timestamps; the run manifest stores creation time separately. Identical input hashes, code, parameters and package versions yield identical feature bytes. The JSON has explicit metric denominators and evidence status fields; counts across categories must not be summed. © OpenStreetMap contributors, ODbL 1.0; downloaded source provider Geofabrik.']
    (ROOT/'ROUTE_FEATURE_ENGINEERING_REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,help='New folder inside data/ranchi_safety; default timestamped')
    args=parser.parse_args()
    inputs=read_inputs()
    data=build_dataset(*inputs)
    reviews=inspect_duplicates(inputs[2],inputs[3])
    out=verify.extract.local(args.output or ROOT/'route_feature_runs'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S_%fZ'))
    out.mkdir(parents=True,exist_ok=False)
    payloads={'route_features.json':data,'duplicate_review.json':reviews}
    for route in data['routes']: payloads[route['route_id']+'.json']=route
    selected={e['osm_id'] for r in data['routes'] for e in r['nearby_evidence']}
    payloads['feature_evidence.json']={'type':'FeatureCollection','features':sorted([f for f in inputs[2] if f['id'] in selected],key=lambda f:f['id'])}
    for name,payload in payloads.items(): (out/name).write_text(canonical(payload),encoding='utf-8',newline='\n')
    manifest={'created_at_utc':datetime.now(timezone.utc).isoformat(),'status':'complete','schema_version':data['schema_version'],
              'artifacts':{name:verify.extract.sha(out/name) for name in sorted(payloads)}}
    (out/'run_manifest.json').write_text(canonical(manifest),encoding='utf-8',newline='\n')
    write_report(data,reviews,out)
    print('Created:',out)
    for r in data['routes']:
        print(r['route_id'],{c:r['categories'][c]['count'] for c in ('roads_and_pedestrian_ways','shops_and_businesses','healthcare_facilities','police_stations')})


if __name__=='__main__': main()
