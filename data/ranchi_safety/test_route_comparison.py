"""Offline Phase 5B preference, normalization, uncertainty and integrity tests."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import compare_routes as compare
import route_comparison_engine as engine


def row(ident,distance=1000,business=20,healthcare=10,police=0,pedestrian=30):
    return {'route_id':ident,'criteria':{k:engine.interval(v) for k,v in zip(engine.DIRECTIONS,(distance,business,healthcare,police,pedestrian))}}


class ComparisonTests(unittest.TestCase):
    def test_shorter_distance_preference(self):
        a,b=row('a',900,business=0),row('b',1000,business=100)
        result=engine.compare_routes([a,b],['shorter_distance','mapped_support'])
        self.assertEqual(result['preference_fronts'],[['a'],['b']])
        self.assertEqual(len(result['pairwise'][0]['trace']),1)

    def test_support_priority_can_change_preferred_route(self):
        a,b=row('a',900,business=0),row('b',1000,business=100)
        self.assertEqual(engine.compare_routes([a,b],['mapped_support','shorter_distance'])['first_front_candidates'],['b'])

    def test_support_tradeoff_not_broken_by_secondary_distance(self):
        a,b=row('a',900,business=80,healthcare=5),row('b',1000,business=20,healthcare=10)
        result=engine.compare_routes([a,b],['mapped_support','shorter_distance'])
        self.assertEqual(result['first_front_candidates'],['a','b'])
        self.assertEqual(result['pairwise'][0]['status'],'tradeoff_or_scenario_overlap')

    def test_equal_first_priority_uses_next(self):
        a,b=row('a',1000,business=10),row('b',1000,business=20)
        result=engine.compare_routes([a,b],['shorter_distance','mapped_support'])
        self.assertEqual(result['first_front_candidates'],['b'])
        self.assertEqual(len(result['pairwise'][0]['trace']),2)

    def test_tie_never_resolved_by_id(self):
        result=engine.compare_routes([row('z'),row('a')],list(engine.GROUPS))
        self.assertEqual(result['preference_fronts'],[['a','z']])
        self.assertEqual(result['pairwise'][0]['status'],'equal')

    def test_missing_support_observation_is_not_zero(self):
        result=engine.compare_routes([row('a',business=None),row('b',business=0)],['mapped_support','shorter_distance'])
        self.assertEqual(result['first_front_candidates'],['a','b'])
        self.assertEqual(result['pairwise'][0]['status'],'missing')

    def test_unknown_ancillary_attributes_do_not_change_preference(self):
        routes=[row('a',900),row('b',1000)]
        base=engine.compare_routes(routes,list(engine.GROUPS))
        routes[0]['availability']={'lighting':None,'sidewalk':None,'opening_hours':None}
        routes[1]['availability']={'lighting':100,'sidewalk':100,'opening_hours':100}
        self.assertEqual(base,engine.compare_routes(routes,list(engine.GROUPS)))

    def test_duplicate_interval_robust_dominance(self):
        a,b=row('a',business=50),row('b',business=20)
        a['criteria']['business_proximity_percent']=engine.interval(50,48,50)
        self.assertEqual(engine.compare_routes([a,b],['mapped_support'])['first_front_candidates'],['a'])

    def test_overlapping_intervals_do_not_force_preference(self):
        a,b=row('a',business=50),row('b',business=49)
        a['criteria']['business_proximity_percent']=engine.interval(50,48,50)
        self.assertEqual(engine.compare_routes([a,b],['mapped_support'])['first_front_candidates'],['a','b'])

    def test_pareto_keeps_distance_context_tradeoff(self):
        a,b=row('a',900,business=0),row('b',1000,business=100)
        self.assertEqual(engine.compare_routes([a,b],list(engine.GROUPS),pareto=True)['first_front_candidates'],['a','b'])

    def test_raw_counts_and_subcategories_cannot_double_weight(self):
        routes=[row('a'),row('b')]
        result=engine.compare_routes(routes,['mapped_support'])
        routes[0]['context']={'count':100000,'hospitals':10000,'pharmacies':10000}
        self.assertEqual(result,engine.compare_routes(routes,['mapped_support']))

    def test_duplicate_scenarios_connected_component_no_data_merge(self):
        ids=['n/1','n/2','n/3']
        pairs=[{'first':'n/1','second':'n/2'},{'first':'n/2','second':'n/3'}]
        scenarios=compare.duplicate_scenarios(ids,pairs)
        self.assertEqual(scenarios,[['n/1'],['n/1','n/2','n/3'],['n/2'],['n/3']])
        self.assertEqual(ids,['n/1','n/2','n/3'])

    def test_duplicate_outside_selection_unchanged(self):
        self.assertEqual(compare.duplicate_scenarios(['n/1'],[{'first':'n/1','second':'n/2'}]),[['n/1']])

    def test_scenario_limit_stops_without_truncation(self):
        with self.assertRaisesRegex(ValueError,'scenario limit'):
            compare.duplicate_scenarios(['a','b'],[{'first':'a','second':'b'}],max_scenarios=2)

    def test_input_order_deterministic(self):
        rows=[row('c',1100),row('b',1000),row('a',900)]
        self.assertEqual(engine.compare_routes(rows,list(engine.GROUPS)),engine.compare_routes(rows[::-1],list(engine.GROUPS)))

    def test_invalid_priorities_and_intervals_rejected(self):
        for priorities in ([],['bad'],['shorter_distance','shorter_distance']):
            with self.assertRaises(ValueError): engine.compare_routes([row('a')],priorities)
        for value in (float('nan'),float('inf'),True):
            with self.assertRaises(ValueError): engine.interval(value)
        with self.assertRaises(ValueError): engine.interval(10,11,12)

    def test_duplicate_route_ids_rejected(self):
        with self.assertRaises(ValueError): engine.compare_routes([row('a'),row('a')],['shorter_distance'])

    def test_numeric_tolerance_explicit(self):
        result=engine.compare_routes([row('a',1000),row('b',1000+1e-8)],['shorter_distance'])
        self.assertEqual(result['pairwise'][0]['status'],'equal')

    def test_artifact_tamper_rejected(self):
        with tempfile.TemporaryDirectory(dir=compare.ROOT) as directory:
            folder=Path(directory)
            (folder/'route_features.json').write_text('{}')
            (folder/'run_manifest.json').write_text(json.dumps({'status':'complete','artifacts':{'route_features.json':'0'*64}}))
            with self.assertRaisesRegex(ValueError,'hash mismatch'): compare.load_bundle(folder)

    def test_actual_input_profiles_normalization_and_reproducibility(self):
        with patch('socket.create_connection',side_effect=AssertionError('Network forbidden')):
            data,evidence,reviews,saved,manifest=compare.load_bundle(compare.DEFAULT)
            rows=compare.prepare_rows(data,evidence,reviews,saved)
            result=compare.build_result(data,rows,manifest,['pedestrian_infrastructure','shorter_distance'])
            repeated=compare.build_result(data,compare.prepare_rows(data,evidence,reviews,saved),manifest,['pedestrian_infrastructure','shorter_distance'])
        self.assertEqual(compare.features.canonical(result),compare.features.canonical(repeated))
        self.assertEqual(result['profiles']['distance_first']['first_front_candidates'],['heigit-foot-walking-route-2'])
        self.assertEqual(result['profiles']['support_first']['first_front_candidates'],['heigit-foot-walking-route-2'])
        self.assertEqual(result['profiles']['pedestrian_first']['first_front_candidates'],['heigit-foot-walking-route-3'])
        self.assertEqual(len(result['profiles']['pareto_tradeoffs']['first_front_candidates']),3)
        second=rows[1]['context']['shops_and_businesses']
        self.assertEqual(second['conditional_count_min'],53)
        self.assertAlmostEqual(second['records_per_km'],54/(rows[1]['geodesic_distance_metres']/1000))
        self.assertEqual(len(second['duplicate_scenarios']),3)
        self.assertLessEqual(rows[1]['criteria']['business_proximity_percent']['scenario_low'],rows[1]['criteria']['business_proximity_percent']['value'])
        self.assertTrue(rows[1]['correlation_audit']['cross_category_shared_ids']['shops_and_businesses + healthcare_facilities'])


if __name__=='__main__': unittest.main(verbosity=2)
