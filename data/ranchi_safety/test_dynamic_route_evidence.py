"""Synthetic geometry and real snapshot regression tests; network is forbidden."""
import json
from pathlib import Path
import unittest
from unittest.mock import patch

from shapely.geometry import LineString, Point, mapping

import dynamic_route_evidence as dynamic
import compare_routes

BBOX = [23.335059, 85.308481, 23.38, 85.34]
ROUTE = [[23.355, 85.32], [23.36, 85.32]]


def feature(ident, geometry, categories, tags=None, kind='node'):
    return {'type': 'Feature', 'id': f'{kind}/{ident}', 'geometry': mapping(geometry),
            'properties': {'id': ident, 'type': kind, 'categories': categories,
                           'tags': tags or {}, 'version': 1, 'timestamp': '2026-10-08T00:00:00Z'}}


class SyntheticTests(unittest.TestCase):
    def setUp(self):
        self.network = patch('socket.socket.connect', side_effect=AssertionError('Network forbidden'))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.empty = dynamic.PilotDataset(BBOX, [], [])

    def analyze(self, coords=ROUTE, dataset=None, **kwargs):
        return dynamic.analyze_route('new-route', coords, dataset=dataset or self.empty, **kwargs)

    def test_valid_new_route_and_empty_inventory(self):
        result = self.analyze(distance_metres=1, duration_seconds=0)
        self.assertEqual(result['status'], 'available')
        self.assertTrue(result['coverage']['full_buffer_covered'])
        for c in result['route_context']['categories'].values():
            self.assertEqual(c['count'], 0)
            self.assertEqual(c['real_world_completeness'], 'unknown')
            self.assertGreater(c['route_proximity']['denominator'], 500)
        self.assertIsNone(result['route_context']['opening_hours']['nonblank']['percent'])
        self.assertIsNone(result['route_context']['verified_on_walked_street']['osm_ids'])
        json.dumps(result, allow_nan=False)

    def test_whole_route_outside_partial_crossing_and_excursion(self):
        for coords in ([[0, 0], [1, 1]], [ROUTE[0], [23.39, 85.32]],
                       [[23.33, 85.32], [23.39, 85.32]],
                       [ROUTE[0], [23.39, 85.32], ROUTE[1]]):
            with self.subTest(coords=coords), patch.object(dynamic.metrics, 'engineer_metric_route', side_effect=AssertionError('No partial analysis')):
                result = self.analyze(coords)
                self.assertEqual(result['status'], 'coverage_unavailable')
                self.assertIsNone(result['route_context'])

    def test_full_buffer_outside_on_each_edge_and_corner(self):
        s, w, n, e = BBOX
        routes = [[[s + .0001, 85.32], [s + .0001, 85.325]],
                  [[n - .0001, 85.32], [n - .0001, 85.325]],
                  [[23.35, w + .0001], [23.36, w + .0001]],
                  [[23.35, e - .0001], [23.36, e - .0001]],
                  [[s, w], [s + .002, w + .002]]]
        for coords in routes:
            with self.subTest(coords=coords):
                result = self.analyze(coords)
                self.assertTrue(result['coverage']['centerline_fully_covered'])
                self.assertFalse(result['coverage']['full_buffer_covered'])
                self.assertIsNone(result['route_context'])

    def test_buffer_change_can_reject_same_geometry(self):
        coords = [[23.355, 85.309], [23.36, 85.309]]
        self.assertEqual(self.analyze(coords, buffer_metres=10)['status'], 'available')
        self.assertEqual(self.analyze(coords)['status'], 'coverage_unavailable')

    def test_invalid_coordinates(self):
        for coords in (None, [], [ROUTE[0]], 'bad', [[1]], [[23, 85, 1], ROUTE[1]],
                       [[True, 85], ROUTE[1]], [['23', 85], ROUTE[1]],
                       [[float('nan'), 85], ROUTE[1]], [[23, float('inf')], ROUTE[1]],
                       [[91, 85], ROUTE[1]], [[23, -181], ROUTE[1]], [ROUTE[0], ROUTE[0]],
                       ROUTE * 5001):
            with self.subTest(coords=str(coords)[:80]), self.assertRaises(ValueError):
                self.analyze(coords)

    def test_invalid_metadata_buffer_and_id(self):
        for kwargs in ({'distance_metres': -1}, {'duration_seconds': True}, {'duration_seconds': float('inf')},
                       {'buffer_metres': 0}, {'buffer_metres': -1}, {'buffer_metres': True},
                       {'buffer_metres': float('nan')}, {'buffer_metres': 1001}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.analyze(**kwargs)
        for ident in (None, '', ' ', 1):
            with self.assertRaises(ValueError):
                dynamic.analyze_route(ident, ROUTE, dataset=self.empty)

    def test_geometry_identity_and_evidence_identity(self):
        a = self.analyze()
        b = dynamic.analyze_route('different-label', ROUTE, dataset=self.empty, distance_metres=900)
        self.assertEqual(a['evidence_identity_sha256'], b['evidence_identity_sha256'])
        self.assertEqual(dynamic.geometry_identity([[0, 1], [1, 2]]),
                         dynamic.geometry_identity([[-0.0, 1.0], [1.0, 2.0]]))
        for coords in (ROUTE[::-1], [ROUTE[0], [23.36000000001, 85.32]], [ROUTE[0], *ROUTE]):
            self.assertNotEqual(a['route']['geometry_sha256'], self.analyze(coords)['route']['geometry_sha256'])
        self.assertNotEqual(a['evidence_identity_sha256'], self.analyze(buffer_metres=50)['evidence_identity_sha256'])
        other = dynamic.PilotDataset(BBOX, [feature(1, Point(85.32, 23.357), ['police_stations'])], [])
        self.assertNotEqual(a['evidence_identity_sha256'], self.analyze(dataset=other)['evidence_identity_sha256'])

    def test_repeated_traversal_and_overlapping_facilities(self):
        features = [feature(i, Point(85.32, 23.3575), ['shops_and_businesses']) for i in (1, 2)]
        data = dynamic.PilotDataset(BBOX, features, [{'first': 'node/1', 'second': 'node/2'}])
        single = self.analyze(dataset=data)['route_context']
        repeated = self.analyze([*ROUTE, ROUTE[0]], dataset=data)['route_context']
        a, b = [r['categories']['shops_and_businesses'] for r in (single, repeated)]
        self.assertEqual(a['count'], 2)
        self.assertEqual(b['count'], 2)
        self.assertAlmostEqual(a['route_proximity']['percent'], b['route_proximity']['percent'])
        self.assertAlmostEqual(a['route_proximity']['numerator'] * 2, b['route_proximity']['numerator'])
        one = self.analyze(dataset=dynamic.PilotDataset(BBOX, features[:1], []))['route_context']
        self.assertEqual(a['route_proximity'], one['categories']['shops_and_businesses']['route_proximity'])
        sensitivity = single['duplicate_sensitivity']['shops_and_businesses']
        self.assertEqual(sensitivity['raw_OSM_object_count'], 2)
        self.assertEqual(sensitivity['conditional_count_if_all_flagged_pairs_same_entity'], 1)
        self.assertFalse(sensitivity['records_merged'])

    def test_duplicate_ids_and_missing_category_rejected(self):
        f = feature(1, Point(85.32, 23.357), ['shops_and_businesses'])
        with self.assertRaises(ValueError):
            dynamic.PilotDataset(BBOX, [f, f], [])
        f['properties']['categories'] = None
        with self.assertRaises(ValueError):
            dynamic.PilotDataset(BBOX, [f], [])

    def test_lighting_sidewalk_and_opening_hours_missingness(self):
        road = LineString([(lon, lat) for lat, lon in ROUTE])
        tags = [{}, {'lit': 'no', 'sidewalk': 'no'}, {'lit': 'yes', 'sidewalk:left': 'yes'},
                {'lit': 'unknown'}, {'lit': ' '}, {'lit': 'automatic'}]
        fs = [feature(i, road, ['roads_and_pedestrian_ways'], t, 'way') for i, t in enumerate(tags)]
        fs += [feature(i, Point(85.32, 23.357), ['shops_and_businesses'], t)
               for i, t in enumerate(({}, {'opening_hours': ' '}, {'opening_hours': 'nonsense'}))]
        fs += [feature(10, Point(85.32, 23.357), ['healthcare_facilities'], {'opening_hours': '24/7'})]
        r = self.analyze(dataset=dynamic.PilotDataset(BBOX, fs, []))['route_context']
        self.assertEqual({s: v['object_availability']['numerator'] for s, v in r['lighting']['states'].items()},
                         {'yes': 1, 'no': 1, 'unknown': 3, 'other_recorded': 1})
        self.assertEqual(r['sidewalk']['usable_tag_availability']['numerator'], 2)
        self.assertEqual(r['opening_hours']['nonblank']['numerator'], 1)
        self.assertEqual(r['opening_hours']['missing_key_count'], 1)
        self.assertEqual(r['opening_hours']['blank_value_count'], 1)
        self.assertEqual(len(r['opening_hours']['all_selected_recorded_tags']), 3)
        self.assertIsNone(r['opening_hours']['currently_open'])
        self.assertFalse(r['opening_hours']['syntax_validated'])
        self.assertAlmostEqual(r['nearby_road_geometry']['OSM_object_line_sum_metres'],
                               6 * r['nearby_road_geometry']['unique_clipped_line_length_metres'])

    def test_outputs_do_not_mutate_dataset(self):
        data = dynamic.PilotDataset(BBOX, [feature(1, Point(85.32, 23.357), ['police_stations'])], [])
        a = self.analyze(dataset=data)
        a['route_context']['source_features'][0]['properties']['tags']['lit'] = 'yes'
        a['source_provenance']['versions'].clear()
        self.assertNotEqual(a, self.analyze(dataset=data))


class SavedPilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch('socket.socket.connect', side_effect=AssertionError('Network forbidden')):
            cls.data = dynamic.PilotDataset.load()
            cls.phase5a, _, _, cls.saved, _ = compare_routes.load_bundle(compare_routes.DEFAULT)

    def test_three_saved_routes_exact_metric_parity_and_no_request_io(self):
        before = {r['route_id']: r for r in self.phase5a['routes']}
        for route in self.saved['routes']:
            with self.subTest(route=route['id']), patch('socket.socket.connect', side_effect=AssertionError('Network forbidden')), \
                    patch.object(Path, 'open', side_effect=AssertionError('No per-request file reads')):
                result = dynamic.analyze_route(route['id'], route['coordinates'], route['distanceMeters'],
                    route['durationSeconds'], dataset=self.data)
                self.assertEqual(result['status'], 'available')
                old = before[route['id']]
                for key in ('categories', 'lighting', 'sidewalk', 'duplicate_sensitivity', 'nearby_evidence',
                            'projected_route_length_metres', 'route_length_geodesic_metres'):
                    self.assertEqual(result['route_context'][key], old[key], key)
                for key, value in old['opening_hours'].items():
                    self.assertEqual(result['route_context']['opening_hours'][key], value)
                self.assertEqual(result, dynamic.analyze_route(route['id'], route['coordinates'],
                    route['distanceMeters'], route['durationSeconds'], dataset=self.data))

    def test_loader_never_opens_regional_index_or_saved_routes(self):
        original = Path.open
        opened = []
        def guarded(path, *args, **kwargs):
            opened.append(str(path))
            self.assertNotIn('pbf_sources', path.parts)
            self.assertNotEqual(path.suffix, '.sqlite')
            self.assertNotEqual(path.name, 'routes.json')
            return original(path, *args, **kwargs)
        with patch.object(Path, 'open', guarded), patch('socket.socket.connect', side_effect=AssertionError('Network forbidden')):
            dynamic.PilotDataset.load()
        self.assertTrue(any('objects.jsonl' in p for p in opened))

    def test_manifest_tampering_fails_closed(self):
        with patch.object(dynamic, 'MANIFEST_SHA256', '0' * 64), self.assertRaisesRegex(ValueError, 'manifest'):
            dynamic.PilotDataset.load()


if __name__ == '__main__':
    unittest.main()
