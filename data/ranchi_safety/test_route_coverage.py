"""Synthetic geometry tests; no fabricated coordinates are saved as real routes."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import URLError

import verify_route_coverage as experiment
from shapely.geometry import LineString, box


class GeometryTests(unittest.TestCase):
    def fraction(self, coords):
        total, covered, _ = experiment.clipped_lengths(coords, box(85.31, 23.35, 85.34, 23.38))
        return covered / total

    def test_entirely_inside(self):
        self.assertAlmostEqual(self.fraction([(85.32, 23.36), (85.33, 23.37)]), 1)

    def test_entirely_outside(self):
        self.assertEqual(self.fraction([(85.32, 23.33), (85.33, 23.34)]), 0)

    def test_crossing_with_both_endpoints_outside(self):
        # A horizontal line through the box: half lies inside despite zero inside vertices.
        self.assertAlmostEqual(self.fraction([(85.295, 23.365), (85.355, 23.365)]), 0.5, places=6)

    def test_boundary_following_is_inside(self):
        self.assertAlmostEqual(self.fraction([(85.315, 23.35), (85.335, 23.35)]), 1)

    def test_boundary_touch_only_is_zero(self):
        self.assertEqual(self.fraction([(85.30, 23.34), (85.31, 23.35)]), 0)

    def test_repeated_traversal_preserves_length(self):
        coords = [(85.32, 23.36), (85.33, 23.36), (85.32, 23.36)]
        total, covered, _ = experiment.clipped_lengths(coords, box(85.31, 23.35, 85.34, 23.38))
        expected = 2 * experiment.GEOD.inv(85.32, 23.36, 85.33, 23.36)[2]
        self.assertAlmostEqual(total, expected)
        self.assertAlmostEqual(covered, expected)

    def test_metric_buffer_inside_and_outside(self):
        boundary = box(0, 0, 1000, 1000)
        inside, _, _ = experiment.buffer_coverage(LineString([(200, 500), (800, 500)]), boundary, 100)
        self.assertTrue(inside["fully_covered"])
        self.assertAlmostEqual(inside["inside_percent"], 100)
        outside, _, _ = experiment.buffer_coverage(LineString([(200, -500), (800, -500)]), boundary, 100)
        self.assertFalse(outside["fully_covered"])
        self.assertEqual(outside["inside_percent"], 0)

    def test_boundary_following_buffer_is_half_covered(self):
        result, _, _ = experiment.buffer_coverage(LineString([(200, 0), (800, 0)]), box(0, 0, 1000, 1000), 100)
        self.assertFalse(result["fully_covered"])
        self.assertAlmostEqual(result["inside_percent"], 50, places=8)

    def test_crossing_buffer_partial_area(self):
        result, corridor, missing = experiment.buffer_coverage(LineString([(-200, 500), (1200, 500)]), box(0, 0, 1000, 1000), 100)
        self.assertFalse(result["fully_covered"])
        # Interior corridor rectangle has exactly 1000m * 200m area; caps are outside.
        self.assertAlmostEqual(result["inside_area_m2"], 200000)
        self.assertAlmostEqual(result["inside_area_m2"] + missing.area, corridor.area)

    def test_route_inside_but_buffer_not_inside(self):
        route = {"id": "synthetic", "distanceMeters": 1000, "durationSeconds": 800,
                 "coordinates": [[23.3501, 85.315], [23.3501, 85.335]]}
        result, _ = experiment.measure_route(route, [23.35, 85.31, 23.38, 85.34], 100)
        self.assertTrue(result["centerline_fully_covered"])
        self.assertFalse(result["analysis_buffer"]["fully_covered"])
        self.assertGreater(result["analysis_buffer"]["inside_percent"], 50)
        self.assertLess(result["analysis_buffer"]["inside_percent"], 70)

    def test_real_projection_boundary_case(self):
        route = {"id": "synthetic", "distanceMeters": 1000, "durationSeconds": 800,
                 "coordinates": [[23.35, 85.315], [23.35, 85.335]]}
        result, _ = experiment.measure_route(route, [23.35, 85.31, 23.38, 85.34], 100)
        self.assertAlmostEqual(result["inside_percent"], 100)
        self.assertAlmostEqual(result["analysis_buffer"]["inside_percent"], 50, delta=0.01)

    def test_degenerate_and_invalid_buffer_rejected(self):
        with self.assertRaises(ValueError):
            self.fraction([(85.32, 23.36), (85.32, 23.36)])
        for radius in (0, -1, float("nan")):
            with self.assertRaises(ValueError):
                experiment.buffer_coverage(LineString([(0, 0), (1, 1)]), box(0, 0, 10, 10), radius)


class InputTests(unittest.TestCase):
    def test_existing_snapshot_boundary(self):
        bbox, snapshot = experiment.read_snapshot(experiment.DEFAULT_SNAPSHOT)
        self.assertEqual(bbox, [23.35, 85.31, 23.38, 85.34])
        self.assertEqual(snapshot["source"]["osm_base_timestamp"], "2026-10-08T13:33:00Z")

    def test_schema_preserves_latitude_longitude_order(self):
        route = {"id": "test", "distanceMeters": 20, "durationSeconds": 30,
                 "coordinates": [[23.36, 85.32], [23.37, 85.33]],
                 "startPoint": [23.36, 85.32], "endPoint": [23.37, 85.33]}
        experiment.validate_routes({"routes": [route]})
        for response in ({"routes": []}, {"routes": [route, route]},
                         {"routes": [dict(route, durationSeconds=float("nan"))]},
                         {"routes": [dict(route, endPoint=[23.35, 85.32])]}):
            with self.assertRaises(ValueError):
                experiment.validate_routes(response)

    def test_no_direct_upstream_endpoint_allowed(self):
        with tempfile.TemporaryDirectory(dir=experiment.ROOT) as folder:
            with self.assertRaises(ValueError):
                experiment.fetch_routes("https://api.heigit.org", Path(folder))

    def test_unavailable_backend_creates_honest_failure_report(self):
        with tempfile.TemporaryDirectory(dir=experiment.ROOT) as folder:
            root = Path(folder)
            # Real snapshot remains read-only; outputs go to a temporary subfolder.
            bbox, snapshot = experiment.read_snapshot(experiment.DEFAULT_SNAPSHOT)
            with patch.object(experiment, "ROOT", root), patch.object(experiment, "read_snapshot", return_value=(bbox, snapshot)), \
                 patch.object(experiment, "fetch_routes", side_effect=URLError("backend unavailable")), \
                 patch.object(experiment.sys, "argv", ["verify_route_coverage.py"]):
                self.assertEqual(experiment.main(), 1)
            report = (root / "ROUTE_COVERAGE_REPORT.md").read_text(encoding="utf-8")
            self.assertIn("backend unavailable", report)
            self.assertIn("not verified", report)
            run = next((root / "route_coverage_runs").iterdir())
            status = json.loads((run / "run_status.json").read_text())
            self.assertFalse(status["coverage_verified"])
            self.assertFalse((run / "routes.json").exists())
            self.assertFalse((run / "coverage_results.json").exists())


if __name__ == "__main__":
    unittest.main()
