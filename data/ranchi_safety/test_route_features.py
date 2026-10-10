"""Phase 5A correctness and deterministic reproduction tests; all data is local."""
import unittest
from unittest.mock import patch

from shapely.geometry import LineString, Point, Polygon

import build_route_features as build
import route_feature_metrics as features
from test_post_extraction import feature


class RouteFeatureTests(unittest.TestCase):
    def setUp(self):
        self.route=LineString([(0,0),(1000,0)])

    def item(self,ident=1,kind='node',geometry=None,**tags):
        g=geometry if geometry is not None else Point(500,0)
        return feature(ident,kind,g,**tags),g

    def run_route(self,items,pairs=None,line=None):
        return features.engineer_metric_route(line if line is not None else self.route,items,pairs or [])

    def test_business_hours_not_required_and_current_status_unknown(self):
        r=self.run_route([self.item(shop='bakery')])
        self.assertEqual(r['categories']['shops_and_businesses']['count'],1)
        self.assertEqual(r['opening_hours']['nonblank']['numerator'],0)
        self.assertEqual(r['opening_hours']['nonblank']['denominator'],1)
        self.assertIsNone(r['opening_hours']['currently_open'])

    def test_opening_hours_missing_blank_recorded_distinct(self):
        r=self.run_route([self.item(1,shop='bakery'),self.item(2,shop='bakery',opening_hours=' '),self.item(3,shop='bakery',opening_hours='not-a-valid-schedule')])
        self.assertEqual(r['opening_hours']['missing_key_count'],1)
        self.assertEqual(r['opening_hours']['blank_value_count'],1)
        self.assertEqual(r['opening_hours']['nonblank']['numerator'],1)
        self.assertFalse(r['opening_hours']['syntax_validated'])

    def test_lighting_states_preserve_unknown_and_other(self):
        items=[]
        for i,tags in enumerate(({}, {'lit':'no'},{'lit':'yes'},{'lit':'automatic'},{'lit':' '},{'lit':'unknown'})):
            items.append(self.item(i,'way',self.route,highway='footway',**tags))
        r=self.run_route(items)
        self.assertEqual({s:v['object_availability']['numerator'] for s,v in r['lighting']['states'].items()},
                         {'yes':1,'no':1,'other_recorded':1,'unknown':3})
        self.assertEqual(r['lighting']['missing_key_count'],1)
        self.assertEqual(r['lighting']['blank_value_count'],1)
        self.assertEqual(r['lighting']['raw_value_counts']['automatic'],1)

    def test_lighting_proximity_overlap_not_false_partition(self):
        r=self.run_route([self.item(1,'way',self.route,highway='footway',lit='yes'),self.item(2,'way',self.route,highway='residential')])
        self.assertAlmostEqual(r['lighting']['states']['yes']['route_proximity']['percent'],100)
        self.assertAlmostEqual(r['lighting']['states']['unknown']['route_proximity']['percent'],100)
        self.assertAlmostEqual(r['lighting']['route_without_usable_tag_within_buffer']['percent'],0)
        self.assertIsNone(r['lighting']['actual_walked_street_coverage'])

    def test_sidewalk_no_is_available_not_missing(self):
        r=self.run_route([self.item(1,'way',self.route,highway='footway',sidewalk='no'),self.item(2,'way',self.route,highway='footway')])
        self.assertEqual(r['sidewalk']['states']['available']['object_availability']['numerator'],1)
        self.assertEqual(r['sidewalk']['states']['unknown']['object_availability']['numerator'],1)
        self.assertEqual(r['sidewalk']['raw_key_value_counts'],{'sidewalk=no':1})

    def test_sidewalk_directional_and_blank_unknown(self):
        self.assertEqual(features.sidewalk_state({'sidewalk:left':'yes'}),'available')
        self.assertEqual(features.sidewalk_state({'sidewalk:right':'unknown','sidewalk':''}),'unknown')
        self.assertEqual(features.sidewalk_state({'sidewalk:left:surface':'paved'}),'available')

    def test_zero_denominator_is_null_not_zero_confidence(self):
        r=self.run_route([])
        self.assertIsNone(r['lighting']['usable_tag_availability']['percent'])
        self.assertIsNone(r['opening_hours']['nonblank']['percent'])
        self.assertEqual(r['categories']['police_stations']['route_proximity']['percent'],0)
        self.assertEqual(r['lighting']['route_without_usable_tag_within_buffer']['percent'],100)

    def test_boundary_touch_and_outside_exclusion(self):
        r=self.run_route([self.item(1,geometry=Point(500,100),shop='bakery'),self.item(2,geometry=Point(500,100.1),shop='bakery')])
        self.assertEqual(r['categories']['shops_and_businesses']['ids'],['node/1'])
        self.assertEqual(r['categories']['shops_and_businesses']['route_proximity']['numerator'],0)

    def test_crossing_without_inside_vertices_and_denominator(self):
        g=LineString([(500,-300),(500,300)])
        r=self.run_route([self.item(1,'way',g,highway='footway',lit='yes')])
        m=r['lighting']['states']['yes']['clipped_road_length']
        self.assertAlmostEqual(m['numerator'],200)
        self.assertAlmostEqual(m['denominator'],200)
        self.assertEqual(r['lighting']['states']['yes']['route_proximity']['denominator'],1000)

    def test_polygon_hole_and_polygon_area_not_road_centerline(self):
        p=Polygon([(-1000,-1000),(2000,-1000),(2000,1000),(-1000,1000)],
                  holes=[[(-200,-200),(1200,-200),(1200,200),(-200,200)]])
        r=self.run_route([self.item(1,'way',p,amenity='hospital')])
        self.assertEqual(r['categories']['healthcare_facilities']['count'],0)
        solid=Polygon([(-10,-10),(1010,-10),(1010,10),(-10,10)])
        r=self.run_route([self.item(2,'way',solid,highway='pedestrian',area='yes')])
        self.assertEqual(r['categories']['pedestrian_infrastructure']['count'],1)
        self.assertEqual(r['lighting']['states']['unknown']['clipped_road_length']['denominator'],0)

    def test_overlapping_buffers_and_repeated_traversal(self):
        line=LineString([(0,0),(1000,0),(0,0)])
        r=self.run_route([self.item(1,geometry=Point(450,0),shop='bakery'),self.item(2,geometry=Point(550,0),shop='bakery')],line=line)
        self.assertAlmostEqual(r['categories']['shops_and_businesses']['route_proximity']['numerator'],600)
        self.assertAlmostEqual(r['categories']['shops_and_businesses']['route_proximity']['percent'],30)

    def test_duplicate_scenario_retains_records_and_transitive_components(self):
        pairs=[{'first':'node/1','second':'node/2'},{'first':'node/2','second':'node/3'}]
        r=self.run_route([self.item(i,shop='bakery') for i in (1,2,3)],pairs)
        s=r['duplicate_sensitivity']['shops_and_businesses']
        self.assertEqual(s['raw_OSM_object_count'],3)
        self.assertEqual(s['conditional_count_if_all_flagged_pairs_same_entity'],1)
        self.assertFalse(s['records_merged'])
        self.assertEqual(len(r['nearby_evidence']),3)

    def test_duplicate_one_outside_does_not_reduce_selected_count(self):
        r=self.run_route([self.item(1,shop='bakery')],[{'first':'node/1','second':'node/2'}])
        self.assertEqual(r['duplicate_sensitivity']['shops_and_businesses']['conditional_count_if_all_flagged_pairs_same_entity'],1)

    def test_typed_identity_and_category_overlap(self):
        r=self.run_route([self.item(1,amenity='pharmacy'),self.item(1,'way',self.route,highway='footway')])
        self.assertEqual(r['nearby_unique_object_count'],2)
        self.assertEqual(r['categories']['shops_and_businesses']['count'],1)
        self.assertEqual(r['categories']['healthcare_facilities']['count'],1)
        with self.assertRaisesRegex(ValueError,'Duplicate'):
            self.run_route([self.item(1,shop='bakery'),self.item(1,shop='bakery')])

    def test_input_order_reproducibility(self):
        items=[self.item(9,geometry=Point(600,0),shop='bakery'),self.item(1,geometry=Point(450,0),amenity='police')]
        self.assertEqual(build.canonical(self.run_route(items)),build.canonical(self.run_route(items[::-1])))

    def test_routes_independent(self):
        items=[self.item(1,shop='bakery')]
        near=self.run_route(items)
        distant=self.run_route(items,line=LineString([(0,1000),(1000,1000)]))
        self.assertEqual(near['categories']['shops_and_businesses']['count'],1)
        self.assertEqual(distant['categories']['shops_and_businesses']['count'],0)

    def test_no_fake_street_match(self):
        r=self.run_route([self.item(1,'way',self.route,highway='footway',lit='yes')])
        self.assertEqual(r['categories']['roads_and_pedestrian_ways']['route_proximity']['percent'],100)
        self.assertIsNone(r['verified_on_walked_street']['osm_ids'])
        self.assertIsNone(r['nearby_evidence'][0]['on_walked_street_verified'])
        self.assertEqual(r['evidence_confidence']['pedestrian_activity'],'not_observed')

    def test_zero_route_and_bad_radius_rejected(self):
        with self.assertRaises(ValueError): self.run_route([],line=LineString([(0,0),(0,0)]))
        with self.assertRaises(ValueError): features.engineer_metric_route(self.route,[],[],float('nan'))

    def test_actual_three_routes_reproduce_and_duplicate_review(self):
        # Local integration test; all source artifacts are read-only, no extractor run.
        with patch('socket.create_connection',side_effect=AssertionError('Network forbidden')):
            inputs=build.read_inputs()
            a=build.build_dataset(*inputs)
            b=build.build_dataset(*inputs)
            self.assertEqual(build.canonical(a),build.canonical(b))
            self.assertEqual(len(a['routes']),3)
            self.assertEqual([r['categories']['shops_and_businesses']['count'] for r in a['routes']],[19,54,23])
            self.assertEqual([r['duplicate_sensitivity']['shops_and_businesses']['conditional_count_if_all_flagged_pairs_same_entity'] for r in a['routes']],[19,53,23])
            reviews=build.inspect_duplicates(inputs[2],inputs[3])
            self.assertEqual(len(reviews),4)
            self.assertTrue(all(not r['records_merged'] for r in reviews))
            self.assertTrue(all(r['route_length_geodesic_metres']>5000 for r in a['routes']))


if __name__=='__main__': unittest.main(verbosity=2)
