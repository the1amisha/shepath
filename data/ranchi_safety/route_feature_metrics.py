"""Phase 5A metric geometry and evidence summaries; no I/O or network access."""
from collections import Counter
import math

from shapely.geometry import GeometryCollection, LineString
from shapely.ops import unary_union

import verify_post_extraction as verified

GROUPS = verified.GROUPS


def ratio(numerator, denominator, unit):
    return {'numerator': numerator, 'denominator': denominator, 'unit': unit,
            'percent': 100*numerator/denominator if denominator else None}


def traversed_length(line, area):
    """Count repeated traversal, but never count overlapping proximity buffers twice."""
    coords = list(line.coords)
    return sum(LineString([a,b]).intersection(area).length for a,b in zip(coords,coords[1:]) if a!=b)


def proximity(line, items, radius):
    area = unary_union([g.buffer(radius,quad_segs=64) for f,g in items]) if items else GeometryCollection()
    return ratio(min(line.length,max(0,traversed_length(line,area))),line.length,'metres_of_route')


def category_features(line, items, category, radius):
    members = [(f,g) for f,g in items if category in f['properties']['categories']]
    return {'count': len(members), 'count_unit': 'unique_OSM_objects',
            'data_availability':'mapped_records_present' if members else 'no_matching_mapped_records',
            'real_world_completeness':'unknown',
            'ids': sorted(f['id'] for f,g in members),
            'types':dict(sorted(Counter(f['properties']['type'] for f,g in members).items())),
            'route_proximity':proximity(line,members,radius)}


def lighting_state(tags):
    value = tags.get('lit','').strip().lower()
    if not value or value=='unknown': return 'unknown'
    if value in {'yes','no'}: return value
    return 'other_recorded'


def sidewalk_values(tags):
    return {k:v for k,v in sorted(tags.items()) if k=='sidewalk' or k.startswith('sidewalk:')}


def sidewalk_state(tags):
    values = sidewalk_values(tags)
    return 'available' if any(v.strip() and v.strip().lower()!='unknown' for v in values.values()) else 'unknown'


def road_attribute(line, roads, corridor, radius, attribute):
    states = ('yes','no','other_recorded','unknown') if attribute=='lighting' else ('available','unknown')
    classify = lighting_state if attribute=='lighting' else sidewalk_state
    output = {'scope':'nearby_OSM_road_objects_not_verified_walked_street',
              'road_object_denominator':len(roads),'states':{},
              'actual_walked_street_coverage':None,'street_match_status':'not_performed'}
    lengths = {f['id']:sum(p.length for p in verified.coverage.line_parts(g.intersection(corridor))) for f,g in roads}
    for state in states:
        subset = [(f,g) for f,g in roads if classify(f['properties']['tags'])==state]
        output['states'][state] = {
            'object_availability':ratio(len(subset),len(roads),'OSM_road_objects'),
            'ids':sorted(f['id'] for f,g in subset),
            'clipped_road_length':ratio(sum(lengths[f['id']] for f,g in subset),sum(lengths.values()),'metres_of_nearby_OSM_road_lines'),
            'route_proximity':proximity(line,subset,radius)}
    recorded = [(f,g) for f,g in roads if classify(f['properties']['tags'])!='unknown']
    known = proximity(line,recorded,radius)
    output['route_without_usable_tag_within_buffer'] = ratio(line.length-known['numerator'],line.length,'metres_of_route')
    output['usable_tag_availability'] = ratio(len(recorded),len(roads),'OSM_road_objects')
    output['availability_indicator'] = 'no_nearby_road_records' if not roads else 'absent' if not recorded else 'complete_in_selected_records' if len(recorded)==len(roads) else 'partial_in_selected_records'
    if attribute=='lighting':
        output['raw_value_counts'] = dict(sorted(Counter(f['properties']['tags'].get('lit','<absent>') for f,g in roads).items()))
        output['missing_key_count'] = sum('lit' not in f['properties']['tags'] for f,g in roads)
        output['blank_value_count'] = sum('lit' in f['properties']['tags'] and not f['properties']['tags']['lit'].strip() for f,g in roads)
    else:
        output['raw_key_value_counts'] = dict(sorted(Counter(f'{k}={v}' for f,g in roads for k,v in sidewalk_values(f['properties']['tags']).items()).items()))
        output['interpretation'] = 'Any usable sidewalk-family value is tag availability only; no inferred sidewalk presence, side, continuity or walkability.'
    return output


def duplicate_sensitivity(category_ids, pairs):
    """Conditional equivalence scenario, never a merged dataset or empirical confidence interval."""
    ids = set(category_ids)
    parent = {i:i for i in ids}
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]]
            i=parent[i]
        return i
    relevant = []
    for p in pairs:
        members = sorted(ids.intersection((p['first'],p['second'])))
        if members:
            relevant.append({'pair':[p['first'],p['second']],'selected_members':members})
        if len(members)==2: parent[find(members[0])] = find(members[1])
    return {'raw_OSM_object_count':len(ids),'conditional_count_if_all_flagged_pairs_same_entity':len({find(i) for i in ids}),
            'affected_pairs':relevant,'records_merged':False,
            'interpretation':'Sensitivity scenario for flagged pairs only; not bounds on true physical facilities.'}


def engineer_metric_route(line, projected, pairs, radius=100):
    if not math.isfinite(radius) or radius<=0: raise ValueError('Buffer must be positive and finite')
    if line.is_empty or not line.is_valid or line.length<=0: raise ValueError('Usable nonzero route geometry required')
    ids = [f['id'] for f,g in projected]
    if len(ids)!=len(set(ids)): raise ValueError('Duplicate typed feature IDs')
    if any(g.is_empty or not g.is_valid for f,g in projected): raise ValueError('Invalid feature geometry')
    corridor = line.buffer(radius,quad_segs=64)
    nearby = sorted(((f,g) for f,g in projected if g.intersects(corridor)),key=lambda x:x[0]['id'])
    categories = {c:category_features(line,nearby,c,radius) for c in GROUPS}
    roads = [(f,g) for f,g in nearby if 'roads_and_pedestrian_ways' in f['properties']['categories']]
    businesses = [(f,g) for f,g in nearby if 'shops_and_businesses' in f['properties']['categories']]
    present = [(f,g) for f,g in businesses if f['properties']['tags'].get('opening_hours','').strip()]
    hours = {'nonblank':ratio(len(present),len(businesses),'business_OSM_objects'),
             'recorded_ids':sorted(f['id'] for f,g in present),
             'missing_key_count':sum('opening_hours' not in f['properties']['tags'] for f,g in businesses),
             'blank_value_count':sum('opening_hours' in f['properties']['tags'] and not f['properties']['tags']['opening_hours'].strip() for f,g in businesses),
             'missing_or_blank_ids':sorted(f['id'] for f,g in businesses if not f['properties']['tags'].get('opening_hours','').strip()),
             'syntax_validated':False,'currently_open':None,'operating_status_evidence':'unavailable'}
    evidence = [{'osm_id':f['id'],'categories':f['properties']['categories'],
                 'minimum_geometric_distance_metres':line.distance(g),
                 'relation_to_route':'within_configured_buffer_geometry_proximity','on_walked_street_verified':None}
                for f,g in nearby]
    return {'buffer_metres':radius,'projected_route_length_metres':line.length,
            'nearby_unique_object_count':len(nearby),'nearby_evidence':evidence,
            'categories':categories,'lighting':road_attribute(line,roads,corridor,radius,'lighting'),
            'sidewalk':road_attribute(line,roads,corridor,radius,'sidewalk'),
            'opening_hours':hours,
            'duplicate_sensitivity':{c:duplicate_sensitivity(categories[c]['ids'],pairs) for c in ('shops_and_businesses','healthcare_facilities','police_stations')},
            'verified_on_walked_street':{'status':'not_performed','osm_ids':None,'tag_coverage':None},
            'evidence_confidence':{
                'scope':'Evidence completeness, never personal safety or calibrated probability',
                'proximity_method':'geometric_intersection_of_verified_records',
                'actual_street_attribution':'unverified',
                'OSM_real_world_completeness':'unknown',
                'facility_identity':'mapped_records_not_field_verified',
                'facility_accessibility':'unverified',
                'pedestrian_activity':'not_observed',
                'business_operating_status':'not_observed'},
            'overlap_rule':'Category memberships and proximity percentages overlap. Do not sum them. Unknown-tag road proximity may overlap yes/no-tag road proximity.'}
