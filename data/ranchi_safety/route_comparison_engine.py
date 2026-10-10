"""Pure deterministic preference comparisons; no aggregate scores or safety inference."""
from itertools import combinations
import math

GROUPS = {
    'shorter_distance': ('distance_metres',),
    'mapped_support': ('business_proximity_percent','healthcare_proximity_percent','police_proximity_percent'),
    'pedestrian_infrastructure': ('pedestrian_proximity_percent',),
}
DIRECTIONS = {k:('lower' if k=='distance_metres' else 'higher') for group in GROUPS.values() for k in group}
PROFILES = {
    'distance_first': ['shorter_distance','mapped_support','pedestrian_infrastructure'],
    'support_first': ['mapped_support','shorter_distance','pedestrian_infrastructure'],
    'pedestrian_first': ['pedestrian_infrastructure','shorter_distance','mapped_support'],
}
EPSILON=1e-6


def interval(value,low=None,high=None):
    if value is None: return {'value':None,'scenario_low':None,'scenario_high':None,'availability':'not_observed'}
    low=value if low is None else low
    high=value if high is None else high
    if any(isinstance(x,bool) or not isinstance(x,(int,float)) or not math.isfinite(x) for x in (value,low,high)) or not low<=value<=high:
        raise ValueError('Invalid measurement/scenario interval')
    return {'value':value,'scenario_low':low,'scenario_high':high,'availability':'measured_in_OSM_snapshot'}


def group_relation(a,b,dimensions):
    """Robust preference across all declared duplicate scenarios; null is incomparable."""
    missing=[d for d in dimensions if a[d]['value'] is None or b[d]['value'] is None]
    if missing: return 'missing',{'missing_dimensions':missing}
    av,bv=[],[]
    equal=True
    for d in dimensions:
        aa,bb=a[d],b[d]
        sign=-1 if DIRECTIONS[d]=='lower' else 1
        al,ah=sorted((sign*aa['scenario_low'],sign*aa['scenario_high']))
        bl,bh=sorted((sign*bb['scenario_low'],sign*bb['scenario_high']))
        av.append((al,ah));bv.append((bl,bh))
        equal &= abs(ah-al)<=EPSILON and abs(bh-bl)<=EPSILON and abs(al-bl)<=EPSILON
    if equal: return 'equal',{}
    a_wins=all(x[0]>=y[1]-EPSILON for x,y in zip(av,bv)) and any(x[0]>y[1]+EPSILON for x,y in zip(av,bv))
    b_wins=all(y[0]>=x[1]-EPSILON for x,y in zip(av,bv)) and any(y[0]>x[1]+EPSILON for x,y in zip(av,bv))
    if a_wins: return 'first',{}
    if b_wins: return 'second',{}
    return 'tradeoff_or_scenario_overlap',{}


def compare_pair(a,b,priorities,pareto=False):
    groups=[('all_selected_dimensions',tuple(d for p in priorities for d in GROUPS[p]))] if pareto else [(p,GROUPS[p]) for p in priorities]
    trace=[]
    for name,dimensions in groups:
        relation,extra=group_relation(a['criteria'],b['criteria'],dimensions)
        trace.append({'priority':name,'dimensions':list(dimensions),'relation':relation,**extra,
                      'measurements':{d:{a['route_id']:a['criteria'][d],b['route_id']:b['criteria'][d]} for d in dimensions}})
        if relation!='equal':
            preferred=a['route_id'] if relation=='first' else b['route_id'] if relation=='second' else None
            text=(f"{preferred} fits {name} better across the declared duplicate scenarios; later priorities were not used."
                  if preferred else f"No strict preference between {a['route_id']} and {b['route_id']} at {name}: " +
                  ('a required observation is missing; no zero was substituted.' if relation=='missing' else 'measurable trade-offs or overlapping duplicate scenarios remain; later priorities do not break this incomparability.'))
            return {'first':a['route_id'],'second':b['route_id'],'preferred':preferred,'status':relation,'trace':trace,'explanation':text}
    return {'first':a['route_id'],'second':b['route_id'],'preferred':None,'status':'equal','trace':trace,
            'explanation':'Equal on all selected measured priorities at the documented numerical tolerance; route IDs do not break ties.'}


def compare_routes(routes,priorities,pareto=False):
    if not priorities or len(priorities)!=len(set(priorities)) or any(p not in GROUPS for p in priorities):
        raise ValueError('Select distinct known priorities')
    ordered=sorted(routes,key=lambda r:r['route_id'])
    if len({r['route_id'] for r in ordered})!=len(ordered): raise ValueError('Duplicate route IDs')
    if not ordered: raise ValueError('No routes')
    for r in ordered:
        for d in DIRECTIONS:
            x=r['criteria'][d]
            interval(x['value'],x['scenario_low'],x['scenario_high'])
    pairs=[compare_pair(a,b,priorities,pareto) for a,b in combinations(ordered,2)]
    remaining={r['route_id'] for r in ordered}
    fronts=[]
    while remaining:
        beaten=set()
        for p in pairs:
            if p['preferred'] and p['first'] in remaining and p['second'] in remaining:
                beaten.add(p['second'] if p['preferred']==p['first'] else p['first'])
        front=sorted(remaining-beaten)
        if not front: raise ValueError('Inconsistent comparison cycle')
        fronts.append(front);remaining.difference_update(front)
    return {'priorities':priorities,'method':'robust_Pareto' if pareto else 'ordered_priorities_with_robust_partial_orders',
            'preference_fronts':fronts,'first_front_candidates':fronts[0],'pairwise':pairs,
            'within_front_order':'Route ID sorting is for stable presentation only; incomparable routes are not ties or ranked.',
            'interpretation':'Preference fit to selected mapped measurements; not accessibility, operating status or personal safety.'}


def dimension_comparisons(routes):
    output={}
    for dimension,direction in DIRECTIONS.items():
        pairs=[]
        for a,b in combinations(sorted(routes,key=lambda r:r['route_id']),2):
            relation,extra=group_relation(a['criteria'],b['criteria'],(dimension,))
            pairs.append({'first':a['route_id'],'second':b['route_id'],'relation':relation,**extra})
        leaders=[]
        for a in routes:
            if a['criteria'][dimension]['value'] is None: continue
            if all(group_relation(a['criteria'],b['criteria'],(dimension,))[0] in ('first','equal') for b in routes if b is not a):
                leaders.append(a['route_id'])
        output[dimension]={'direction':direction,'robust_leaders':sorted(leaders),'pairwise':pairs,
                           'no_leader_reason':None if leaders else 'Missing measurements or scenario overlap prevents a universal leader.'}
    return output
