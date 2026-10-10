"""Offline pipeline tests; mock network responses never enter the live manifest."""
from collections import Counter
from datetime import timedelta
import io
import json
from pathlib import Path
import tempfile
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

import resumable_osm as pipeline


def node(identity=1, **tags):
    return {"type": "node", "id": identity, "version": 1, "timestamp": "2026-10-08T00:00:00Z",
            "tags": tags or {"amenity": "police"}, "lat": 23.34, "lon": 85.32}


def payload(elements):
    counts = Counter(e["type"] for e in elements)
    sentinel = {"type": "count", "id": 0, "tags": {"nodes": str(counts["node"]), "ways": str(counts["way"]),
                                                       "relations": str(counts["relation"]), "total": str(len(elements))}}
    return json.dumps({"osm3s": {"timestamp_osm_base": "2026-10-08T00:00:00Z"}, "elements": elements + [sentinel]}).encode()


class PipelineTests(unittest.TestCase):
    def make_run(self, folder):
        path = Path(folder) / "run"
        return path, pipeline.create_manifest(path, 2, pipeline.original.ENDPOINT)

    def test_tiling_exact_union_and_nonoverlapping_interiors(self):
        for size in (1, 2, 3, 5):
            grid = pipeline.tiles(pipeline.EXPECTED_BBOX, size)
            pipeline.verify_tiles(pipeline.EXPECTED_BBOX, grid)
            self.assertEqual(len(grid), size * size)
        grid = pipeline.tiles(pipeline.EXPECTED_BBOX, 2)
        self.assertEqual(grid[0]["bbox"][3], grid[1]["bbox"][1])
        with self.assertRaises(ValueError):
            pipeline.verify_tiles(pipeline.EXPECTED_BBOX, grid[:-1])
        with self.assertRaises(ValueError):
            pipeline.verify_tiles(pipeline.EXPECTED_BBOX, grid + [grid[0]])

    def test_initial_manifest_tasks_and_saved_route_buffers(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            self.assertEqual(len(m["tasks"]), 24)
            self.assertTrue(all(t["status"] == "pending" for t in m["tasks"]))
            self.assertTrue(all(r["analysis_buffer"]["fully_covered"] for r in m["route_coverage"]))
            self.assertEqual(pipeline.read_manifest(run), m)
            with self.assertRaises(ValueError):
                pipeline.create_manifest(run, 2, pipeline.original.ENDPOINT)

    def test_manifest_missing_task_or_changed_bbox_rejected(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            m["tasks"].pop()
            pipeline.atomic_json(run / "manifest.json", m)
            with self.assertRaises(ValueError):
                pipeline.read_manifest(run)

    def test_business_query_has_no_hours_filter(self):
        query = pipeline.query_for("businesses", pipeline.EXPECTED_BBOX)
        self.assertNotIn("opening_hours", query)
        self.assertIn('nwr["shop"]', query)
        self.assertTrue(query.endswith("out count;\n"))

    def test_count_sentinel_and_sparse_empty_rules(self):
        _, elements = pipeline.validate_payload(payload([]), "police")
        self.assertEqual(elements, [])
        with self.assertRaises(ValueError):
            pipeline.validate_payload(payload([]), "roads")
        data = json.loads(payload([node()]))
        data["elements"][-1]["tags"]["total"] = "2"
        with self.assertRaises(ValueError):
            pipeline.validate_payload(json.dumps(data).encode(), "police")
        with self.assertRaises(ValueError):
            pipeline.validate_payload(b'{"elements": []}', "police")
        data = json.loads(payload([node()]))
        data["remark"] = "runtime timeout"
        with self.assertRaises(ValueError):
            pipeline.validate_payload(json.dumps(data).encode(), "police")

    def test_success_saved_and_resume_skips_without_network(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            raw = payload([node()])
            with patch.object(pipeline.request, "urlopen", return_value=io.BytesIO(raw)) as network:
                pipeline.run_tasks(run, m, task_id="r00c00-police", attempts=1)
                network.assert_called_once()
            m = pipeline.read_manifest(run)
            task = next(t for t in m["tasks"] if t["id"] == "r00c00-police")
            self.assertEqual(task["status"], "successful")
            self.assertEqual((run / task["success"]["response_file"]).read_bytes(), raw)
            with patch.object(pipeline.request, "urlopen") as network:
                self.assertEqual(pipeline.run_tasks(run, m, task_id=task["id"]), 0)
                network.assert_not_called()
            summary = pipeline.summarize(run, m)
            self.assertFalse(summary["complete"])
            self.assertEqual(summary["unique_records"], 1)
            self.assertIn("partial", summary["output_folder"])

    def test_tampered_success_is_not_silently_retrieved_again(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            with patch.object(pipeline.request, "urlopen", return_value=io.BytesIO(payload([node()]))):
                pipeline.run_tasks(run, m, task_id="r00c00-police", attempts=1)
            task = next(t for t in m["tasks"] if t["status"] == "successful")
            (run / task["success"]["response_file"]).write_bytes(b'{}')
            with patch.object(pipeline.request, "urlopen") as network:
                with self.assertRaises(ValueError):
                    pipeline.run_tasks(run, m, task_id=task["id"])
                network.assert_not_called()
            summary = pipeline.summarize(run, m)
            self.assertFalse(summary["complete"])
            self.assertEqual(summary["unique_records"], 0)

    def test_partial_failure_stops_batch_and_persists(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            failure = HTTPError(m["endpoint"], 503, "busy", {}, io.BytesIO(b"busy"))
            with patch.object(pipeline.request, "urlopen", side_effect=failure) as network:
                pipeline.run_tasks(run, m, limit=24, attempts=1)
                network.assert_called_once()
            saved = pipeline.read_manifest(run)
            self.assertEqual(saved["tasks"][0]["status"], "failed")
            self.assertEqual(sum(t["status"] == "pending" for t in saved["tasks"]), 23)
            self.assertFalse(pipeline.summarize(run, saved)["complete"])

    def test_bounded_retries_respect_retry_after(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            failure = HTTPError(m["endpoint"], 429, "busy", {"Retry-After": "45"}, io.BytesIO(b"busy"))
            with patch.object(pipeline.request, "urlopen", side_effect=[failure, io.BytesIO(payload([node()]))]) as network, \
                 patch.object(pipeline, "wait_until_ready"):
                pipeline.run_tasks(run, m, task_id="r00c00-police", attempts=2)
                self.assertEqual(network.call_count, 2)
            task = next(t for t in m["tasks"] if t["id"] == "r00c00-police")
            self.assertEqual([a["result"] for a in task["attempts"]], ["failed", "successful"])
        self.assertEqual(pipeline.cooldown("45", 0), 45)
        self.assertEqual(pipeline.cooldown(None, 2), 120)
        self.assertEqual(pipeline.cooldown("invalid", 0), 30)

    def test_long_cooldown_survives_restart_without_request(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            m["next_request_at_utc"] = (pipeline.utc() + timedelta(minutes=10)).isoformat()
            pipeline.atomic_json(run / "manifest.json", m)
            with patch.object(pipeline.request, "urlopen") as network:
                with self.assertRaises(RuntimeError):
                    pipeline.run_tasks(run, pipeline.read_manifest(run), attempts=1)
                network.assert_not_called()

    def test_cli_cooldown_stop_still_writes_partial_report(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            m["next_request_at_utc"] = (pipeline.utc() + timedelta(minutes=10)).isoformat()
            pipeline.atomic_json(run / "manifest.json", m)
            with patch.object(sys, "argv", ["resumable_osm.py", "run", "--run", str(run)]), patch.object(pipeline.request, "urlopen") as network:
                self.assertEqual(pipeline.main(), 1)
                network.assert_not_called()
            self.assertIn("PARTIAL / INCOMPLETE", (run / "TILED_EXTRACTION_REPORT.md").read_text(encoding="utf-8"))

    def test_dedup_uses_type_id_and_keeps_whole_latest_record(self):
        prior = node()
        latest = dict(prior, version=2, tags={"amenity": "police", "name": "Updated"})
        same_numeric_way = {"type": "way", "id": 1, "version": 1, "timestamp": prior["timestamp"],
                            "tags": {"highway": "footway"}, "geometry": [{"lat": 23.34, "lon": 85.32}, {"lat": 23.341, "lon": 85.321}]}
        records, sources, variants, _ = pipeline.merge_records([("a", [prior, same_numeric_way]), ("b", [prior]), ("c", [latest])])
        self.assertEqual(len(records), 2)
        self.assertIn(latest, records)
        self.assertEqual(sources[("node", 1)], ["a", "b", "c"])
        self.assertEqual(len(variants), 1)

    def test_complete_merge_only_after_all_tasks_and_same_version_conflicts_block(self):
        with tempfile.TemporaryDirectory(dir=pipeline.ROOT) as folder:
            run, m = self.make_run(folder)
            for task in m["tasks"]:
                if task["category"] == "roads":
                    elements = [{"type": "way", "id": 100, "version": 1, "timestamp": "2026-10-08T00:00:00Z",
                                 "tags": {"highway": "footway"}, "geometry": [{"lat": 23.34, "lon": 85.32}, {"lat": 23.341, "lon": 85.321}]}]
                else:
                    elements = []
                with patch.object(pipeline.request, "urlopen", return_value=io.BytesIO(payload(elements))), patch.object(pipeline, "wait_until_ready"):
                    pipeline.run_tasks(run, m, task_id=task["id"], attempts=1)
            summary = pipeline.summarize(run, m)
            self.assertTrue(summary["complete"])
            self.assertEqual(summary["unique_records"], 1)
            self.assertIn("complete", summary["output_folder"])
            # Simulate a same-version disagreement between two independently valid tasks.
            task = next(t for t in m["tasks"] if t["id"] == "r00c01-roads")
            raw = (run / task["success"]["response_file"]).read_bytes()
            changed = json.loads(raw)
            changed["elements"][0]["tags"]["name"] = "Conflicting same-version tag"
            changed_raw = json.dumps(changed).encode()
            (run / task["success"]["response_file"]).write_bytes(changed_raw)
            task["success"]["response_sha256"] = pipeline.digest(changed_raw)
            blocked = pipeline.summarize(run, m)
            self.assertFalse(blocked["complete"])
            self.assertIn("partial", blocked["output_folder"])
        conflicting = dict(node(), tags={"amenity": "police", "name": "Different"})
        self.assertTrue(pipeline.merge_records([("a", [node()]), ("b", [conflicting])])[2][0]["same_version_disagreement"])


if __name__ == "__main__":
    unittest.main()
