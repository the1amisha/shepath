"""Metric fixtures for segmentation, overlap and repeated traversal."""
import unittest

from shapely.geometry import LineString, Point

from segment_evidence import summarize_segments


def item(geometry, categories, tags=None):
    return ({'properties': {'categories': categories, 'tags': tags or {}}}, geometry)


class SegmentTests(unittest.TestCase):
    def test_partition_and_empty_inventory(self):
        for length in (10, 150, 201, 500, 601):
            r = summarize_segments(LineString([(0, 0), (length, 0)]), [], 100)
            self.assertAlmostEqual(sum(s['length_metres'] for s in r['segments']), length)
            self.assertEqual(r['longest_facility_gap']['length_metres'], length)
            self.assertEqual(r['lighting_unknown_percent'], 100)
            self.assertTrue(all(s['facility_coverage'] == 'none' for s in r['segments']))
            if length >= 100:
                self.assertTrue(all(100 <= s['length_metres'] <= 200 for s in r['segments']))

    def test_gap_exact_not_rounded_to_segments_and_overlap_not_double_counted(self):
        facilities = [item(Point(250, 0), ['shops_and_businesses']),
                      item(Point(250, 0), ['healthcare_facilities'])]
        r = summarize_segments(LineString([(0, 0), (1000, 0)]), facilities, 100)
        self.assertAlmostEqual(r['longest_facility_gap']['start_metres'], 350)
        self.assertAlmostEqual(r['longest_facility_gap']['length_metres'], 650)
        covered = sum(s['length_metres'] * s['facility_coverage_percent'] / 100 for s in r['segments'])
        self.assertAlmostEqual(covered, 200)

    def test_retraced_geometry_keeps_ordered_distance(self):
        f = [item(Point(250, 0), ['shops_and_businesses'])]
        r = summarize_segments(LineString([(0, 0), (500, 0), (0, 0)]), f, 100)
        self.assertAlmostEqual(r['route_length_metres'], 1000)
        self.assertAlmostEqual(r['longest_facility_gap']['length_metres'], 300)
        self.assertAlmostEqual(sum(s['length_metres'] * s['facility_coverage_percent'] / 100
                                   for s in r['segments']), 400)

    def test_negative_tags_are_known_evidence_and_missing_tags_are_unknown(self):
        line = LineString([(0, 0), (500, 0)])
        known = item(line, ['roads_and_pedestrian_ways'], {'lit': 'no', 'sidewalk': 'no'})
        unknown = item(line, ['roads_and_pedestrian_ways'], {'lit': 'unknown'})
        r = summarize_segments(line, [known, unknown], 100)
        self.assertAlmostEqual(r['lighting_unknown_percent'], 0)
        self.assertAlmostEqual(r['sidewalk_unknown_percent'], 0)
        self.assertEqual(summarize_segments(line, [unknown], 100)['lighting_unknown_percent'], 100)

    def test_analysis_response_includes_segments_and_implementation_provenance(self):
        import dynamic_route_evidence as engine
        data = engine.PilotDataset([23.335059, 85.308481, 23.38, 85.34], [], [])
        result = engine.analyze_route('route', [[23.355, 85.32], [23.36, 85.32]], dataset=data)
        self.assertEqual(len(result['route_context']['segment_evidence']['segments']), 4)
        self.assertIn('segment_evidence.py', result['source_provenance']['code_sha256'])
        unsupported = engine.analyze_route('outside', [[0, 0], [1, 1]], dataset=data)
        self.assertIsNone(unsupported['route_context'])

    def test_segment_limit_rejects_excessive_route_length(self):
        with self.assertRaisesRegex(ValueError, 'segment-analysis limit'):
            summarize_segments(LineString([(0, 0), (400000, 0)]), [], 100)

    def test_touching_closed_buffer_splits_gap_at_contact(self):
        r = summarize_segments(LineString([(0, 0), (1000, 0)]),
                               [item(Point(500, 100), ['shops_and_businesses'])], 100)
        self.assertAlmostEqual(r['longest_facility_gap']['length_metres'], 500)

    def test_all_covered_has_zero_gap_and_nonfacility_does_not_count(self):
        line = LineString([(0, 0), (150, 0)])
        f = item(line, ['healthcare_facilities'])
        self.assertEqual(summarize_segments(line, [f], 100)['longest_facility_gap']['length_metres'], 0)
        police = item(line, ['police_stations'])
        self.assertEqual(summarize_segments(line, [police], 100)['longest_facility_gap']['length_metres'], 150)


if __name__ == '__main__':
    unittest.main()
