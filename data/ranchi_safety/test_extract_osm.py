"""Synthetic offline tests; none of these records represent actual Ranchi data."""
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import extract_osm as osm


def node(identity, tags, lat=23.36, lon=85.32):
    return {"type": "node", "id": identity, "lat": lat, "lon": lon, "tags": tags}


def way(identity, tags):
    return {"type": "way", "id": identity, "tags": tags, "nodes": [10, 11],
            "geometry": [{"lat": 23.36, "lon": 85.32}, {"lat": 23.37, "lon": 85.33}]}


class QualityTests(unittest.TestCase):
    def test_categories_preservation_and_unknown_semantics(self):
        elements = [way(1, {"highway": "residential", "lit": "yes"}),
                    way(2, {"highway": "footway"}),
                    way(3, {"highway": "service", "lit": "no"}),
                    node(4, {"highway": "street_lamp"}),
                    node(5, {"amenity": "police"}),
                    node(6, {"healthcare": "hospital"}),
                    node(7, {"amenity": "pharmacy", "shop": "chemist", "opening_hours": "Mo-Fr 09:00-17:00"}),
                    node(8, {"office": "company", "opening_hours": "by appointment"})]
        collection, summary = osm.process({"elements": elements}, {"attribution": osm.ATTRIBUTION})
        self.assertEqual(list(summary["counts_by_category"].values()), [3, 2, 1, 1, 1, 1, 2])
        self.assertEqual(summary["lighting"]["tag_absent_unknown"], 1)
        self.assertEqual(summary["lighting"]["tag_completeness_percent"], 66.67)
        self.assertEqual(summary["lighting"]["recorded_values"], {"yes": 1, "no": 1})
        self.assertEqual(summary["missing_fields_by_category"]["police_stations"]["name"], 1)
        for feature, original in zip(collection["features"], elements):
            self.assertEqual(feature["properties"]["original_osm_element"], original)
            self.assertEqual(feature["properties"]["tags"], original["tags"])
            self.assertEqual(feature["properties"]["current_open_status"], "not_evaluated")
        self.assertEqual(collection["features"][1]["properties"]["lighting_interpretation"], "unknown")
        self.assertEqual(collection["features"][3]["geometry"]["coordinates"], [85.32, 23.36])

    def test_duplicates_use_type_and_id(self):
        item = node(1, {"amenity": "police"})
        collection, summary = osm.process({"elements": [item, item, way(1, {"highway": "footway"})]}, {})
        self.assertEqual(len(collection["features"]), 2)
        self.assertEqual(summary["duplicates"]["ids"], ["node/1"])

    def test_invalid_missing_and_outside_coordinates(self):
        incomplete = way(3, {"highway": "footway"})
        del incomplete["geometry"]
        data = {"elements": [node(1, {"amenity": "police"}, lat=100),
                             node(2, {"amenity": "hospital"}, lat=23.39), incomplete]}
        collection, summary = osm.process(data, {})
        self.assertEqual(summary["coordinates"]["invalid_points"], 1)
        self.assertEqual(summary["coordinates"]["points_outside_pilot_bbox"], 1)
        self.assertEqual(summary["coordinates"]["features_without_coordinate_points"], 1)
        self.assertEqual(summary["coordinates"]["features_without_usable_geometry"], 2)
        self.assertIsNone(collection["features"][0]["geometry"])
        self.assertFalse(osm.valid_point({"lat": True, "lon": 85.32}))
        self.assertFalse(osm.valid_point({"lat": float("nan"), "lon": 85.32}))

    def test_relations_preserve_members_without_inventing_polygon(self):
        member = way(10, {})
        member["ref"] = member.pop("id")
        relation = {"type": "relation", "id": 20, "tags": {"amenity": "hospital"}, "members": [member]}
        collection, _ = osm.process({"elements": [relation]}, {})
        self.assertEqual(collection["features"][0]["geometry"]["type"], "GeometryCollection")
        relation["members"].append({"type": "relation", "ref": 22})
        self.assertIsNone(osm.geometry(relation))

    def test_empty_result_is_zero_not_estimate(self):
        collection, summary = osm.process({"elements": []}, {})
        self.assertEqual(collection["features"], [])
        self.assertIsNone(summary["lighting"]["tag_completeness_percent"])

    def test_reject_partial_or_malformed_response(self):
        for data in ({"elements": [], "remark": "runtime error: timeout"}, {}, [],
                     {"elements": [{"type": "node", "id": "bad"}]}):
            with self.assertRaises(ValueError):
                osm.process(data, {})

    def test_query_is_bounded_and_has_expected_selectors(self):
        query = osm.build_query()
        self.assertIn("23.35,85.31,23.38,85.34", query)
        for selector in ('way["highway"]', 'nwr["highway"="street_lamp"]',
                         'nwr["shop"]["opening_hours"]', 'out meta geom;'):
            self.assertIn(selector, query)


class NetworkTests(unittest.TestCase):
    def test_offline_cli_writes_exports_and_failure_status(self):
        with tempfile.TemporaryDirectory(dir=osm.ROOT) as folder:
            root = Path(folder)
            fixture = root / "synthetic.json"
            original = {"elements": [node(1, {"amenity": "police"})]}
            fixture.write_text(json.dumps(original), encoding="utf-8")
            with patch.object(osm, "ROOT", root), patch.object(osm.sys, "argv", ["extract_osm.py", "--input", str(fixture)]), patch.object(osm.request, "urlopen") as network:
                self.assertEqual(osm.main(), 0)
                network.assert_not_called()
            successful = next((root / "outputs").iterdir())
            self.assertEqual(json.loads((successful / "raw_response.json").read_text()), original)
            self.assertEqual(json.loads((successful / "run_status.json").read_text())["status"], "success")
            self.assertEqual(len(json.loads((successful / "features.geojson").read_text(encoding="utf-8"))["features"]), 1)
            fixture.write_text('{"elements": [], "remark": "timeout"}', encoding="utf-8")
            with patch.object(osm, "ROOT", root), patch.object(osm.sys, "argv", ["extract_osm.py", "--input", str(fixture)]):
                self.assertEqual(osm.main(), 1)
            failed = next(p for p in (root / "outputs").iterdir() if p != successful)
            self.assertEqual(json.loads((failed / "run_status.json").read_text())["status"], "failed")
            self.assertFalse((failed / "features.geojson").exists())
            self.assertFalse((failed / "quality_summary.json").exists())

    def test_rate_limit_retries_and_preserves_raw(self):
        raw = b'{"elements": []}'
        limited = HTTPError(osm.ENDPOINT, 429, "rate limited", {"Retry-After": "0"}, io.BytesIO(b"busy"))
        with tempfile.TemporaryDirectory(dir=osm.ROOT) as folder:
            with patch.object(osm.request, "urlopen", side_effect=[limited, io.BytesIO(raw)]), patch.object(osm.time, "sleep"):
                data, body = osm.fetch("query", osm.ENDPOINT, Path(folder))
            self.assertEqual(data, {"elements": []})
            self.assertEqual(body, raw)
            self.assertEqual((Path(folder) / "response_attempt_2.json").read_bytes(), raw)
            self.assertTrue((Path(folder) / "http_error_1.txt").exists())

    def test_network_errors_and_timeouts_stop_after_bounded_retries(self):
        for failure in (URLError("offline"), TimeoutError("timeout"),
                        HTTPError(osm.ENDPOINT, 504, "timeout", {}, io.BytesIO(b"timeout"))):
            with tempfile.TemporaryDirectory(dir=osm.ROOT) as folder:
                with patch.object(osm.request, "urlopen", side_effect=failure) as mocked, patch.object(osm.time, "sleep"):
                    with self.assertRaises(RuntimeError):
                        osm.fetch("query", osm.ENDPOINT, Path(folder), attempts=2)
                    self.assertEqual(mocked.call_count, 2)

    def test_partial_json_is_saved_but_not_processed(self):
        raw = json.dumps({"elements": [], "remark": "runtime timeout"}).encode()
        with tempfile.TemporaryDirectory(dir=osm.ROOT) as folder:
            with patch.object(osm.request, "urlopen", return_value=io.BytesIO(raw)):
                with self.assertRaises(RuntimeError):
                    osm.fetch("query", osm.ENDPOINT, Path(folder), attempts=1)
            self.assertEqual((Path(folder) / "response_attempt_1.json").read_bytes(), raw)

    def test_long_cooldown_does_not_retry_early(self):
        limited = HTTPError(osm.ENDPOINT, 429, "busy", {"Retry-After": "120"}, io.BytesIO(b"busy"))
        with tempfile.TemporaryDirectory(dir=osm.ROOT) as folder:
            with patch.object(osm.request, "urlopen", side_effect=limited) as mocked:
                with self.assertRaisesRegex(RuntimeError, "cooldown"):
                    osm.fetch("query", osm.ENDPOINT, Path(folder))
                self.assertEqual(mocked.call_count, 1)


if __name__ == "__main__":
    unittest.main()
