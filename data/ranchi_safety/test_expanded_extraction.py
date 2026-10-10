"""Offline Phase 4B tests: synthetic records and saved real-route containment."""
import unittest
import io
from pathlib import Path
import tempfile
from unittest.mock import patch
from urllib.error import HTTPError

import extract_expanded_osm as expanded
import extract_osm as original
import verify_route_coverage as coverage


def node(identity, tags, lat=23.36, lon=85.32):
    return {"type": "node", "id": identity, "tags": tags, "lat": lat, "lon": lon}


class ExpandedTests(unittest.TestCase):
    def test_real_routes_buffers_and_margin_contained(self):
        saved = expanded.load_json(expanded.ROUTE_RUN / "routes.json")
        bbox, results, _ = expanded.derive_boundary(saved["routes"], original.BBOX, 50)
        self.assertEqual(bbox, [23.335059, 85.308481, 23.38, 85.34])
        self.assertLessEqual(bbox[0], original.BBOX[0])
        self.assertLessEqual(bbox[1], original.BBOX[1])
        self.assertGreaterEqual(bbox[2], original.BBOX[2])
        self.assertGreaterEqual(bbox[3], original.BBOX[3])
        self.assertEqual(len(results), 3)
        for result in results:
            self.assertTrue(result["centerline_fully_covered"])
            self.assertTrue(result["analysis_buffer"]["fully_covered"])
            self.assertAlmostEqual(result["inside_percent"], 100)
            self.assertAlmostEqual(result["analysis_buffer"]["inside_percent"], 100)

    def test_query_does_not_require_hours(self):
        query = expanded.build_query([23.335059, 85.308481, 23.38, 85.34])
        self.assertNotIn("opening_hours", query)
        for selector in ('nwr["shop"]', 'nwr["office"]', 'nwr["craft"]',
                         'nwr["healthcare"]', 'nwr["kerb"]', 'nwr["barrier"]', 'out meta geom;'):
            self.assertIn(selector, query)

    def test_businesses_without_hours_are_retained(self):
        elements = [node(1, {"shop": "convenience"}), node(2, {"amenity": "cafe", "opening_hours": " "}),
                    node(3, {"office": "company", "opening_hours": "Mo-Fr 09:00-17:00"}),
                    node(4, {"amenity": "pharmacy", "healthcare": "pharmacy"})]
        collection, summary = expanded.assess({"elements": elements}, original.BBOX, {})
        self.assertEqual(len(collection["features"]), 4)
        self.assertEqual(summary["counts_by_category"]["shops_and_businesses"], 4)
        self.assertEqual(summary["counts_by_category"]["businesses_with_opening_hours"], 2)
        hours = summary["business_opening_hours"]
        self.assertEqual((hours["key_present"], hours["nonblank"], hours["missing_or_blank"]), (2, 1, 3))
        self.assertEqual(hours["nonblank_percent"], 25)
        self.assertEqual(summary["counts_by_category"]["pharmacies"], 1)
        self.assertTrue(all(f["properties"]["current_open_status"] == "not_evaluated" for f in collection["features"]))

    def test_lighting_sidewalk_and_invalid_coordinate_counts(self):
        way = {"type": "way", "id": 1, "tags": {"highway": "residential", "lit": "no", "sidewalk:left": "no"},
               "geometry": [{"lat": 23.36, "lon": 85.32}, {"lat": 23.37, "lon": 85.33}]}
        unknown = dict(way, id=2, tags={"highway": "footway"})
        _, summary = expanded.assess({"elements": [way, unknown, node(3, {"amenity": "police"}, lat=91)]}, original.BBOX, {})
        self.assertEqual(summary["road_lighting"]["nonblank_percent"], 50)
        self.assertEqual(summary["road_sidewalk"]["nonblank_percent"], 50)
        self.assertEqual(summary["recorded_lit_values"], {"no": 1})
        self.assertEqual(summary["coordinates"]["invalid"], 1)
        self.assertEqual(summary["coordinates"]["records_without_usable_geometry"], 1)

    def test_partial_and_conflicting_records_rejected(self):
        with self.assertRaises(ValueError):
            expanded.assess({"elements": [], "remark": "runtime timeout"}, original.BBOX, {})
        first = node(1, {"shop": "clothes"})
        with self.assertRaises(ValueError):
            expanded.assess({"elements": [first, dict(first, tags={"shop": "shoes"})]}, original.BBOX, {})
        collection, summary = expanded.assess({"elements": [first, first]}, original.BBOX, {})
        self.assertEqual(len(collection["features"]), 1)
        self.assertEqual(summary["duplicate_osm_records"], ["node/1"])

    def test_potential_duplicates_retained_with_original_metadata(self):
        a = node(1, {"amenity": "clinic", "name": "Clinic A"})
        a["timestamp"] = "2025-01-01T00:00:00Z"
        b = node(2, {"healthcare": "clinic", "name": " clinic   a "}, lon=85.32001)
        collection, summary = expanded.assess({"elements": [a, b]}, original.BBOX, {"attribution": original.ATTRIBUTION})
        self.assertEqual(len(summary["potential_facility_duplicates"]), 1)
        self.assertEqual(len(collection["features"]), 2)
        self.assertEqual(collection["features"][0]["properties"]["original_osm_element"], a)
        self.assertEqual(collection["features"][0]["geometry"]["coordinates"], [85.32, 23.36])
        self.assertEqual(summary["counts_by_category"]["healthcare_facilities"], 2)

    def test_invalid_margin_rejected(self):
        routes = expanded.load_json(expanded.ROUTE_RUN / "routes.json")["routes"]
        for margin in (-1, 0, float("nan"), 501):
            with self.assertRaises(ValueError):
                expanded.derive_boundary(routes, original.BBOX, margin)

    def test_phase4b_cooldown_floor_after_rate_limit(self):
        limited = HTTPError(original.ENDPOINT, 429, "busy", {}, io.BytesIO(b"busy"))
        with tempfile.TemporaryDirectory(dir=expanded.ROOT) as folder:
            with patch.object(original.request, "urlopen", side_effect=[limited, io.BytesIO(b'{"elements": []}')]), patch.object(original.time, "sleep") as sleep:
                original.fetch("query", original.ENDPOINT, Path(folder), attempts=2, retry_floor_seconds=30)
                sleep.assert_called_once_with(30)


if __name__ == "__main__":
    unittest.main()
