"""Offline checks of coverage semantics and the delivered CSV against the snapshot."""
from collections import Counter
import csv
import hashlib
import json
import unittest

import analyze_coverage as analysis


class CoverageTests(unittest.TestCase):
    def test_zero_denominator_and_blank_values(self):
        self.assertIsNone(analysis.percentage(0, 0))
        self.assertEqual(analysis.fmt_pct(0, 0), "N/A")
        self.assertFalse(analysis.present({"tags": {"opening_hours": "  "}}, "opening_hours"))
        self.assertTrue(analysis.present({"tags": {"lit": "no"}}, "lit"))
        self.assertTrue(analysis.present({"tags": {"sidewalk:left": "no"}}, "sidewalk_any"))

    def test_pharmacy_overlap_is_not_two_businesses(self):
        element = {"type": "node", "id": 1,
                   "tags": {"amenity": "pharmacy", "healthcare": "pharmacy",
                            "shop": "chemist", "opening_hours": "24/7"}}
        groups = analysis.group_elements([element])
        self.assertEqual(len(groups["pharmacies"]), 1)
        self.assertEqual(len(groups["shops_and_businesses"]), 1)
        self.assertEqual(len(groups["businesses_with_opening_hours"]), 1)

    def test_delivered_csv_counts_and_percentages(self):
        raw = (analysis.RUN / "raw_response.json").read_bytes()
        elements = json.loads(raw)["elements"]
        groups = analysis.group_elements(elements)
        expected = [1394, 37, 0, 6, 36, 3, 15, 12]
        self.assertEqual([len(group) for group in groups.values()], expected)
        union = {(e["type"], e["id"]) for group in groups.values() for e in group}
        self.assertEqual(len(union), 1451)
        with (analysis.ROOT / "data_coverage_summary.csv").open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)
        self.assertEqual({row["category"] for row in rows}, set(groups))
        self.assertEqual(len({(row["category"], row["attribute"]) for row in rows}), len(rows))
        for row in rows:
            self.assertNotIn(None, row)
            group = groups[row["category"]]
            count = len(group)
            self.assertEqual(int(row["denominator"]), count)
            self.assertEqual(int(row["unique_features"]), count)
            types = Counter(e["type"] for e in group)
            self.assertEqual([int(row[k]) for k in ("nodes", "ways", "relations")],
                             [types[k] for k in ("node", "way", "relation")])
            self.assertEqual(row["raw_sha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(int(row["present_count"]) + int(row["missing_or_blank_count"]), count)
            if count:
                self.assertEqual(float(row["missing_percent"]),
                                 round(100 * int(row["missing_or_blank_count"]) / count, 2))
            else:
                self.assertEqual(row["missing_percent"], "")
        road_lit = next(row for row in rows if row["category"] == "roads_and_pedestrian_ways" and row["attribute"] == "lit")
        self.assertEqual(road_lit["missing_or_blank_count"], "1357")
        self.assertEqual(road_lit["missing_percent"], "97.35")

    def test_report_preserves_route_and_sampling_limits(self):
        report = (analysis.ROOT / "DATA_COVERAGE_REPORT.md").read_text(encoding="utf-8")
        self.assertIn("route coverage could not be verified", report)
        self.assertIn("**Selection bias:**", report)
        self.assertIn("**no record is classified as currently open**", report)
        self.assertIn("**unknown**", report)


if __name__ == "__main__":
    unittest.main()
