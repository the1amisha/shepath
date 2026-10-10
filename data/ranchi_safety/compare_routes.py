"""Offline Phase 5B CLI: compare verified Phase 5A features without safety scores."""
import argparse
from datetime import datetime,timezone
import importlib.metadata
from itertools import product
import json
import math
from pathlib import Path

from shapely.geometry import LineString,shape
from shapely.ops import transform

import build_route_features as features
import route_comparison_engine as engine
import route_feature_metrics as metrics

ROOT=Path(__file__).resolve().parent
DEFAULT=ROOT/'route_feature_runs/20261009T170001_897709Z'
SUPPORT=('shops_and_businesses','healthcare_facilities','police_stations')
CATEGORIES=SUPPORT+('pedestrian_infrastructure','roads_and_pedestrian_ways','hospitals','pharmacies')
CRITERIA={'shops_and_businesses':'business_proximity_percent','healthcare_facilities':'healthcare_proximity_percent',
          'police_stations':'police_proximity_percent','pedestrian_infrastructure':'pedestrian_proximity_percent'}


def load_bundle(folder):
    folder=features.verify.extract.local(folder)
    manifest=features.verify.load(folder/'run_manifest.json')
    features.verify.require(manifest['status']=='complete','Incomplete Phase 5A run')
    paths=features.verify.checked_artifacts(folder,manifest)
    by_name={p.name:p for p in paths}
    for name in ('route_features.json','feature_evidence.json','duplicate_review.json'):
        features.verify.require(name in by_name,'Missing Phase 5A artifact '+name)
    data=features.verify.load(by_name['route_features.json'])
    features.verify.require(data['schema_version']=='SHEPATH.phase5a.v1','Unsupported feature schema')
    features.verify.require(len(data['routes'])==3,'Expected three real routes')
    features.verify.require(data['method']['buffer_metres']==100 and data['method']['metric_crs']=='EPSG:32645','Unsupported geometry method')
    evidence=features.verify.load(by_name['feature_evidence.json'])['features']
    lookup={f['id']:f for f in evidence}
    features.verify.require(len(lookup)==len(evidence),'Duplicate evidence IDs')
    reviews=features.verify.load(by_name['duplicate_review.json'])
    source=features.verify.extract.ROUTES
    features.verify.require(features.verify.extract.sha(source)==data['provenance']['saved_routes_sha256'],'Saved route hash mismatch')
    saved=features.verify.load(source)
    features.verify.coverage.validate_routes(saved)
    features.verify.require({r['route_id'] for r in data['routes']}=={r['id'] for r in saved['routes']},'Route ID mismatch')
    for route in data['routes']:
        features.verify.require(math.isfinite(route['route_length_geodesic_metres']) and route['route_length_geodesic_metres']>0,'Invalid route length')
        for c in CATEGORIES:
            value=route['categories'][c]
            features.verify.require(value['count']==len(set(value['ids']))==len(value['ids']),'Category count/ID mismatch')
            features.verify.require(all(i in lookup and c in lookup[i]['properties']['categories'] for i in value['ids']),'Missing/miscategorized source evidence')
            p=value['route_proximity']
            if p['percent'] is not None:
                features.verify.require(p['denominator']>0 and 0<=p['percent']<=100+1e-6 and abs(p['percent']-100*p['numerator']/p['denominator'])<1e-6,'Invalid proximity denominator')
                features.verify.require(abs(p['denominator']-route['projected_route_length_metres'])<1e-6,'Inconsistent route denominator')
    return data,lookup,reviews,saved,manifest


def duplicate_scenarios(ids,reviews,max_scenarios=256):
    """Raw IDs plus retain-one alternatives per flagged connected component; no mutation."""
    ids=set(ids);parent={i:i for i in ids}
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    for review in reviews:
        if review['first'] in ids and review['second'] in ids:
            parent[find(review['first'])]=find(review['second'])
    components={}
    for i in sorted(ids): components.setdefault(find(i),[]).append(i)
    groups=sorted([v for v in components.values() if len(v)>1])
    if not groups: return [sorted(ids)]
    choices=[[tuple(g)]+[(i,) for i in g] for g in groups]
    if math.prod(len(c) for c in choices)>max_scenarios:
        raise ValueError('Duplicate sensitivity exceeds scenario limit; review explicitly instead of truncating')
    unaffected=ids-set(i for g in groups for i in g)
    scenarios={tuple(sorted(unaffected|{i for selected in choice for i in selected})) for choice in product(*choices)}
    return [list(s) for s in sorted(scenarios)]


def prepare_rows(data,lookup,reviews,saved):
    routes_by_id={r['id']:r for r in saved['routes']}
    rows=[]
    for r in sorted(data['routes'],key=lambda r:r['route_id']):
        coords=[(lon,lat) for lat,lon in routes_by_id[r['route_id']]['coordinates']]
        line=transform(features.verify.coverage.TO_METRES.transform,LineString(features.verify.coverage.densify(coords)))
        features.verify.require(abs(line.length-r['projected_route_length_metres'])<1e-6,'Saved route geometry length changed')
        kilometres=r['route_length_geodesic_metres']/1000
        row={'route_id':r['route_id'],'geodesic_distance_metres':r['route_length_geodesic_metres'],
             'backend_distance_metres':r['backend_distance_metres'],'distance_denominator_km':kilometres,
             'criteria':{'distance_metres':engine.interval(r['route_length_geodesic_metres'])},'context':{},
             'availability':{'evidence_indicators':r['evidence_confidence'],'lighting':r['lighting'],
                             'sidewalk':r['sidewalk'],'opening_hours':r['opening_hours'],
                             'verified_on_walked_street':r['verified_on_walked_street']}}
        for c in CATEGORIES:
            item=r['categories'][c]
            scenarios=duplicate_scenarios(item['ids'],reviews)
            raw=item['route_proximity']['percent']
            values=[]
            for scenario in scenarios:
                # Preserve the original measurement when no geometry is removed.
                value=raw if set(scenario)==set(item['ids']) else metrics.proximity(line,[(lookup[i],transform(features.verify.coverage.TO_METRES.transform,shape(lookup[i]['geometry']))) for i in scenario],100)['percent']
                values.append({'retained_ids':scenario,'count':len(scenario),'records_per_km':len(scenario)/kilometres,'proximity_percent':value})
            low=min(v['count'] for v in values)
            coverage_values=[v['proximity_percent'] for v in values if v['proximity_percent'] is not None]
            row['context'][c]={'raw_count':item['count'],'count_unit':'OSM_objects',
                'records_per_km':item['count']/kilometres,'denominator_km':kilometres,
                'conditional_count_min':low,'conditional_records_per_km_min':low/kilometres,
                'ids':item['ids'],'raw_route_proximity':item['route_proximity'],
                'duplicate_scenarios':values,'data_availability':item.get('data_availability','unspecified'),
                'interpretation':'Scenario range covers only flagged ambiguities; not a confidence interval or physical-facility estimate.'}
            if c in CRITERIA:
                row['criteria'][CRITERIA[c]]=engine.interval(raw,min(coverage_values) if coverage_values else None,max(coverage_values) if coverage_values else None)
        sets={c:set(r['categories'][c]['ids']) for c in SUPPORT}
        row['correlation_audit']={'unique_mapped_support_ids':sorted(set.union(*sets.values())),
            'cross_category_shared_ids':{a+' + '+b:sorted(sets[a]&sets[b]) for a,b in ((SUPPORT[0],SUPPORT[1]),(SUPPORT[0],SUPPORT[2]),(SUPPORT[1],SUPPORT[2]))},
            'policy':'Do not add overlapping counts or coverage percentages. Hospital/pharmacy subcategories and raw counts are descriptive only; support preference uses three dimensions as a partial order, never a sum.'}
        rows.append(row)
    return rows


def build_result(data,rows,input_manifest,priorities=None):
    profiles={name:engine.compare_routes(rows,order) for name,order in sorted(engine.PROFILES.items())}
    profiles['pareto_tradeoffs']=engine.compare_routes(rows,list(engine.GROUPS),pareto=True)
    if priorities: profiles['custom']=engine.compare_routes(rows,priorities)
    return {'schema_version':'SHEPATH.phase5b.v1','interpretation':'Preference-based comparison of mapped measurements; no personal-safety recommendation.',
        'source_feature_manifest':input_manifest,'source_provenance':data['provenance'],
        'comparison_code_sha256':{p.name:features.verify.extract.sha(p) for p in (Path(__file__),Path(engine.__file__),Path(metrics.__file__))},
        'versions':{p:importlib.metadata.version(p) for p in ('shapely','pyproj')},
        'normalization':{'distance':'Geodesic saved-route metres; smaller preferred. No sample-dependent min/max scaling.',
            'counts':'Unique typed OSM records per geodesic route kilometre, with numerator and denominator retained. Descriptive only: density is sensitive to route/corridor layout and OSM segmentation.',
            'coverage':'Percent of projected traversed route length within 100m of category geometry; higher preferred when selected. Each category union removes overlapping proximity.',
            'correlation':'Do not combine count, density and coverage into a composite. Do not add hospital/pharmacy subtypes to healthcare. Support is a three-dimensional Pareto comparison; a shared pharmacy never earns additive credit.',
            'uncertainty':'No imputation. Missing criterion makes that priority incomparable; zero measured OSM proximity means no matching mapped feature, not physical absence. Lighting, sidewalk and hours availability never affect preferences.',
            'duplicates':'Keep raw records. Recompute coverage/count scenarios keeping all or one geometry per flagged component. Prefer only when worst-case versus best-case scenarios permit dominance. These are conditional scenarios, not probability bounds.',
            'numerical_tolerance':engine.EPSILON,'tolerance_units':'metres for distance; percentage points for proximity; numerical equality only, not user indifference.'},
        'routes':rows,'dimension_comparisons':engine.dimension_comparisons(rows),'profiles':profiles}


def write_report(result,out):
    rows=result['routes']
    lines=['# Phase 5B — Evidence-aware route comparison','',
        '**The dataset supports preference-based comparisons of measured distance and mapped context. It cannot support a credible personal-safety recommendation.** Results below describe fit to explicit preferences, not a safety score, operating status or facility accessibility.','',
        '## Method and normalization','',
        'Distance is measured geodesically from the saved route polylines. Context counts are normalized to OSM records per geodesic route kilometre; raw counts remain visible. Preference comparisons use route-length proximity percentages rather than raw counts, so a longer route does not gain preference merely from a larger corridor. Coverage percentages retain their projected-route-length denominators from Phase 5A. Longer or differently shaped routes still sample different areas; normalization does not remove mapping-density bias.','',
        'Ordered preferences compare the first group with unequal measurements. A group must show robust dominance across duplicate scenarios: no worse on every selected dimension and strictly better on at least one. Exact equality proceeds to the next priority. Missing values or a support trade-off stop the comparison as incomparable; later preferences do not manufacture a tie-break. A separate Pareto profile shows trade-offs across all dimensions. Routes within a preference front are ID-sorted only for reproducibility, not ranked against one another. No features are summed into a score.','',
        'Mapped support contains business, healthcare and police proximity as separate dimensions. Counts/density and hospital/pharmacy subtype coverage are descriptive, preventing correlated measures from receiving additive credit. Shared OSM IDs are audited. With only three routes, no statistical correlation estimate or learned weighting is justified.','',
        '## Transparent measurement comparison','',
        '| Dimension | Route 1 | Route 2 | Route 3 | Measured preference leader |','|---|---:|---:|---:|---|']
    def row(name,vals,leaders='Descriptive only'):
        lines.append('| '+name+' | '+' | '.join(str(v) for v in vals)+' | '+leaders+' |')
    def leader(d): return ', '.join(i.rsplit('-',1)[-1] for i in result['dimension_comparisons'][d]['robust_leaders']) or 'No universal leader'
    row('Geodesic walking polyline distance (m), lower preferred',[round(r['geodesic_distance_metres'],1) for r in rows],leader('distance_metres'))
    for c in CATEGORIES:
        row(c+' — raw records',[r['context'][c]['raw_count'] for r in rows])
        row(c+' — records/km',[round(r['context'][c]['records_per_km'],3) for r in rows])
        row(c+' — route proximity (%)',[round(r['context'][c]['raw_route_proximity']['percent'],3) if r['context'][c]['raw_route_proximity']['percent'] is not None else 'Unknown' for r in rows],leader(CRITERIA[c]) if c in CRITERIA else 'Descriptive only')
    lines+=['','## User-selectable preference results','']
    for name,p in result['profiles'].items():
        fronts=' → '.join('{' + ', '.join(i.rsplit('-',1)[-1] for i in front) + '}' for front in p['preference_fronts'])
        lines += [f"- **{name}** ({', '.join(p['priorities'])}): preference fronts {fronts}."]
    distance={r['route_id'].rsplit('-',1)[-1]:r['geodesic_distance_metres'] for r in rows}
    lines += ['',f"Route 2 is {distance['1']-distance['2']:.1f} m shorter than Route 1 and leads the measured business, healthcare and police proximity dimensions. Route 3 leads pedestrian-infrastructure proximity but is {distance['3']-distance['2']:.1f} m longer than Route 2. Route 1 has greater pedestrian-infrastructure proximity than Route 2 with a smaller distance increase than Route 3. All three remain nondominated when distance, support and infrastructure are considered together. These statements apply to this snapshot and these preferences only.",'',
        'Every pairwise result includes the deciding priority, measurement/scenario values and an explanation in `comparison.json`. Custom priority order can change the result. A single first-front candidate is a preference match to mapped measurements, never a verified safest route.','',
        '## Duplicate and correlated-feature uncertainty','']
    for r in rows:
        c=r['context']['shops_and_businesses'];d=r['criteria']['business_proximity_percent']
        lines.append(f"- {r['route_id']}: raw businesses {c['raw_count']}; conditional count {c['conditional_count_min']}–{c['raw_count']}; density {c['conditional_records_per_km_min']:.3f}–{c['records_per_km']:.3f}/km; business proximity {d['scenario_low']:.4f}–{d['scenario_high']:.4f}%.")
    lines += ['', 'The four Phase 5A ambiguous pairs remain unmerged. Only the overlapping fuel-station pair changes these route comparisons: Route 2 has 54 records or 53 if the two records represent one entity. The coverage scenarios retain both geometries or either original geometry, rather than invent a replacement footprint. Current preference leaders are robust to these scenarios; undetected duplicates and incorrect geometries remain possible. The bakery pair, bank administration-office pair and conflicting hospital/pharmacy pair remain documented in the input duplicate review.','',
        'Category coverage is not additive: a pharmacy can appear in both business and healthcare evidence, and nearby areas can overlap even without shared IDs. The JSON provides shared-ID lists. No inference about independent opportunities, service capacity or statistical independence is made.','',
        '## Data availability — excluded from preference ordering','',
        '| Evidence | Route 1 | Route 2 | Route 3 |','|---|---|---|---|']
    for label,field in [('Usable lighting tags / nearby roads','lighting'),('Usable sidewalk-family tags / nearby roads','sidewalk')]:
        lines.append('| '+label+' | '+' | '.join(f"{r['availability'][field]['usable_tag_availability']['numerator']}/{r['availability'][field]['usable_tag_availability']['denominator']}" for r in rows)+' |')
    lines += ['| Nonblank opening hours / businesses | '+' | '.join(f"{r['availability']['opening_hours']['nonblank']['numerator']}/{r['availability']['opening_hours']['nonblank']['denominator']}" for r in rows)+' |', '',
        'Unknown lighting/sidewalk data is never converted to a negative value or used to order routes. Explicit lit=no remains a recorded tag, not a safety label. Opening-hours strings do not establish current opening, and null missing observations are never substituted with zero. Zero police proximity means no police geometry in that corridor in this snapshot, not verified physical absence. Source integrity and complete geographic buffers do not establish real-world mapping completeness.','',
        '## Evidence still needed','',
        '- Validated route-to-road matching and pedestrian access/topology before assigning street lighting, sidewalk continuity or crossing conditions to the walked street.',
        '- Current field validation of lighting condition, time-of-day pedestrian activity, facility entrances/accessibility and business operation; resolve ambiguous facility identities.',
        '- Representative, ethically collected and independently validated evidence about relevant real-world outcomes, exposure and temporal conditions before any personal-safety claim. Three routes and mapped proximity alone cannot establish such relationships.',
        '- Evaluation with intended users, uncertainty communication and appropriate expert review before operational safety-related recommendations. No model or training labels are produced here.','',
        '## Reproduce offline','',f"Structured output: `{out.relative_to(ROOT).as_posix()}/comparison.json`. Input snapshot: `{DEFAULT.relative_to(ROOT).as_posix()}`.",'',
        '```powershell',
        '.\\data\\ranchi_safety\\.pbf_venv\\Scripts\\python.exe data\\ranchi_safety\\compare_routes.py',
        '.\\data\\ranchi_safety\\.pbf_venv\\Scripts\\python.exe data\\ranchi_safety\\compare_routes.py --priorities pedestrian_infrastructure shorter_distance mapped_support',
        '.\\data\\ranchi_safety\\.pbf_venv\\Scripts\\python.exe -m unittest discover -s data/ranchi_safety -p test_route_comparison.py -v','```','',
        'Default runs include all three priority profiles and the all-dimensions Pareto profile. `--priorities` adds a custom profile; any distinct subset/order is allowed. `--input-run` selects a verified Phase 5A bundle and `--output` selects a new folder inside data/ranchi_safety. Existing outputs are never overwritten. Canonical results have no clock timestamp; the run manifest records time and hashes separately. Input hashes, tool versions and code hashes make results reproducible. © OpenStreetMap contributors; ODbL 1.0; provider Geofabrik.']
    (ROOT/'ROUTE_COMPARISON_REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-run',type=Path,default=DEFAULT)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--priorities',nargs='+',choices=list(engine.GROUPS))
    args=parser.parse_args()
    if args.priorities and len(args.priorities)!=len(set(args.priorities)): parser.error('Priorities must be distinct')
    data,evidence,reviews,saved,manifest=load_bundle(args.input_run)
    rows=prepare_rows(data,evidence,reviews,saved)
    result=build_result(data,rows,manifest,args.priorities)
    out=features.verify.extract.local(args.output or ROOT/'route_comparison_runs'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S_%fZ'))
    out.mkdir(parents=True,exist_ok=False)
    (out/'comparison.json').write_text(features.canonical(result),encoding='utf-8',newline='\n')
    (out/'run_manifest.json').write_text(features.canonical({'created_at_utc':datetime.now(timezone.utc).isoformat(),'status':'complete',
        'input_run':str(features.verify.extract.local(args.input_run).relative_to(ROOT)),
        'artifacts':{'comparison.json':features.verify.extract.sha(out/'comparison.json')}}),encoding='utf-8',newline='\n')
    write_report(result,out)
    print('Created:',out)
    for name,p in result['profiles'].items(): print(name,p['preference_fronts'])


if __name__=='__main__': main()
