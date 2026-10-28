import unittest
from facility_hours import facility_hours, SCHEMA_VERSION

def feature(identifier, categories, tags):
    return {'id': identifier, 'properties': {'categories': categories, 'tags': tags}}

class FacilityHoursTests(unittest.TestCase):
    def test_missing_blank_overlap_and_nonfacilities(self):
        features = [feature('node/3', ['healthcare_facilities'], {}),
                    feature('node/2', ['shops_and_businesses'], {'opening_hours': ''}),
                    feature('node/1', ['shops_and_businesses', 'healthcare_facilities'], {'opening_hours': '24/7', 'name': 'Clinic'}),
                    feature('node/4', ['roads_and_pedestrian_ways'], {'opening_hours': '24/7'})]
        result = facility_hours(features)
        self.assertEqual(result['schema_version'], SCHEMA_VERSION)
        self.assertEqual([r['osm_id'] for r in result['records']], ['node/1', 'node/2', 'node/3'])
        self.assertEqual([r['opening_hours'] for r in result['records']], ['24/7', '', None])
        self.assertTrue(result['records'][0]['business'])
        self.assertTrue(result['records'][0]['healthcare'])
        self.assertEqual(facility_hours([])['records'], [])

    def test_engine_selection_and_identity(self):
        import dynamic_route_evidence as engine
        from copy import deepcopy
        items = []
        for identifier, lat in [(1, 23.357), (2, 23.375)]:
            item = feature(f'node/{identifier}', ['shops_and_businesses'], {'opening_hours': '24/7'})
            item.update(type='Feature', geometry={'type': 'Point', 'coordinates': [85.32, lat]})
            item['properties'].update(type='node', id=identifier)
            items.append(item)
        data = engine.PilotDataset([23.335059, 85.308481, 23.38, 85.34], items, [])
        coords = [[23.355, 85.32], [23.36, 85.32]]
        result = engine.analyze_route('route', coords, dataset=data)
        self.assertEqual(len(result['route_context']['facility_hours']['records']), 1)
        self.assertEqual(result['route_context']['facility_hours']['records'][0]['osm_id'], 'node/1')
        self.assertIn('facility_hours.py', result['source_provenance']['code_sha256'])
        self.assertEqual(result['analysis']['facility_hours_version'], SCHEMA_VERSION)
        other = deepcopy(items)
        other[0]['properties']['tags']['opening_hours'] = 'off'
        changed = engine.analyze_route('route', coords, dataset=engine.PilotDataset(data.bbox, other, []))
        self.assertNotEqual(result['evidence_identity_sha256'], changed['evidence_identity_sha256'])
        self.assertIsNone(engine.analyze_route('outside', [[0, 0], [1, 1]], dataset=data)['route_context'])

if __name__ == '__main__': unittest.main()
