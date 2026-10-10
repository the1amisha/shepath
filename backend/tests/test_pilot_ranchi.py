"""In-process API tests. All external/provider calls are mocked or forbidden."""
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from backend.app import main, pilot_ranchi as pilot


class PilotAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.root = Path(self.temp.name)
        self.files = replace(pilot.SnapshotFiles(), root=self.root)
        self.run = self.root / pilot.COMPARISON_RUN
        shutil.copytree(pilot.DATA_ROOT / pilot.COMPARISON_RUN, self.run)
        manifest = json.loads((self.run / "run_manifest.json").read_text(encoding="utf-8"))
        self.feature_relative = manifest["input_run"].replace("\\", "/")
        shutil.copytree(pilot.DATA_ROOT / self.feature_relative, self.root / self.feature_relative)
        saved = self.root / pilot.SAVED_ROUTES
        saved.parent.mkdir(parents=True)
        shutil.copyfile(pilot.DATA_ROOT / pilot.SAVED_ROUTES, saved)
        main.app.dependency_overrides[pilot.get_snapshot_files] = lambda: self.files
        self.network = patch("socket.create_connection", side_effect=AssertionError("Network forbidden in offline API tests"))
        self.network.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        self.network.stop()
        main.app.dependency_overrides.clear()
        self.temp.cleanup()

    def read(self, path):
        return json.loads(path.read_text(encoding="utf-8"))

    def write(self, path, data):
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    def repin_for_semantic_test(self, data):
        """Test-only trust anchor change: production pin is never modified."""
        self.write(self.run / "comparison.json", data)
        digest = hashlib.sha256((self.run / "comparison.json").read_bytes()).hexdigest()
        self.files = replace(self.files, comparison_sha256=digest)
        manifest = self.read(self.run / "run_manifest.json")
        manifest["artifacts"]["comparison.json"] = digest
        self.write(self.run / "run_manifest.json", manifest)

    def get(self, **params):
        return self.client.get("/pilot/ranchi/comparison", params=params)

    def test_comparison_cors_allows_local_frontend_origins(self):
        for origin in (
            "http://localhost:8080",
            "http://localhost:8081",
            "http://127.0.0.1:8080",
            "http://127.0.0.1:8081",
        ):
            with self.subTest(origin=origin):
                response = self.client.get(
                    "/pilot/ranchi/comparison", headers={"Origin": origin}
                )
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.headers.get("access-control-allow-origin"), origin)
                self.assertIn("origin", response.headers.get("vary", "").lower())

    def test_comparison_cors_does_not_allow_unauthorized_origin(self):
        response = self.client.get(
            "/pilot/ranchi/comparison", headers={"Origin": "https://unauthorized.example"}
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_success_and_lossless_comparison_payload(self):
        with patch.object(main, "get_heigit_api_key", side_effect=AssertionError("No API key access")), patch.object(main, "fetch_directions", side_effect=AssertionError("No provider call")):
            response = self.get()
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["comparison"], self.read(self.run / "comparison.json"))
        self.assertEqual(body["status"], "available")
        self.assertEqual(body["journey"]["origin"], "Albert Ekka Chowk, Ranchi")
        self.assertEqual(body["journey"]["destination"], "Doranda, Ranchi")
        self.assertEqual(len(body["journey"]["routeIds"]), 3)
        self.assertFalse(body["applicability"]["appliesToNewRoutes"])
        self.assertFalse(body["applicability"]["personalSafetyRecommendation"])
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_route_ids_in_all_profiles_consistent(self):
        body = self.get().json()
        ids = set(body["journey"]["routeIds"])
        self.assertEqual(ids, {r["route_id"] for r in body["comparison"]["routes"]})
        for profile in body["comparison"]["profiles"].values():
            self.assertEqual(ids, {i for group in profile["preference_fronts"] for i in group})

    def test_matching_assertions_return_full_saved_comparison(self):
        saved = self.read(self.root / pilot.SAVED_ROUTES)
        digest = hashlib.sha256((self.root / pilot.SAVED_ROUTES).read_bytes()).hexdigest()
        response = self.get(origin="  ALBERT  EKKA CHOWK, Ranchi ", destination="doranda, ranchi", travelMode="walk",
                            routeId=saved["routes"][0]["id"], journeyId=pilot.JOURNEY_ID, savedRoutesSha256=digest)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["comparison"]["routes"]), 3)

    def test_wrong_origin_destination_or_direction_not_applicable(self):
        for origin, destination in [("Other origin", "Doranda, Ranchi"), ("Albert Ekka Chowk, Ranchi", "Other destination"),
                                    ("Doranda, Ranchi", "Albert Ekka Chowk, Ranchi")]:
            with self.subTest(origin=origin):
                response = self.get(origin=origin, destination=destination)
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.json()["detail"]["status"], "not_applicable")

    def test_wrong_mode_or_journey_id_not_applicable(self):
        for params in ({"travelMode": "drive"}, {"journeyId": "new-journey"}):
            self.assertEqual(self.get(**params).status_code, 409)

    def test_unknown_route_not_applicable(self):
        response = self.get(routeId="new-route-1")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"]["code"], "route_mismatch")

    def test_reused_route_id_does_not_override_wrong_geometry_fingerprint(self):
        response = self.get(routeId="heigit-foot-walking-route-1", savedRoutesSha256="0" * 64)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"]["code"], "geometry_snapshot_mismatch")

    def test_incomplete_and_unrecognized_assertions_rejected(self):
        for params in ({"origin": "Albert Ekka Chowk, Ranchi"}, {"destination": "Doranda, Ranchi"}, {"coordinates": "different geometry"}):
            self.assertEqual(self.get(**params).status_code, 422)
        self.assertEqual(self.client.get("/pilot/ranchi/comparison?routeId=a&routeId=b").status_code, 422)

    def test_missing_comparison_explicit_unavailable(self):
        (self.run / "comparison.json").unlink()
        response = self.get()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], "artifact_missing")
        self.assertNotIn(str(self.root), response.text)
        self.assertEqual(self.client.get("/health").status_code, 200)

    def test_missing_feature_evidence_unavailable(self):
        (self.root / self.feature_relative / "feature_evidence.json").unlink()
        self.assertEqual(self.get().json()["detail"]["code"], "artifact_missing")

    def test_missing_saved_routes_unavailable(self):
        (self.root / pilot.SAVED_ROUTES).unlink()
        self.assertEqual(self.get().status_code, 503)

    def test_malformed_comparison_unavailable(self):
        (self.run / "comparison.json").write_text("{bad json")
        response = self.get()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], "artifact_invalid")

    def test_malformed_manifest_unavailable(self):
        (self.run / "run_manifest.json").write_text("[]")
        self.assertEqual(self.get().status_code, 503)

    def test_rehashed_artifact_cannot_bypass_production_pin(self):
        data = self.read(self.run / "comparison.json")
        data["routes"][0]["geodesic_distance_metres"] = 1.0
        self.write(self.run / "comparison.json", data)
        manifest = self.read(self.run / "run_manifest.json")
        manifest["artifacts"]["comparison.json"] = hashlib.sha256((self.run / "comparison.json").read_bytes()).hexdigest()
        self.write(self.run / "run_manifest.json", manifest)
        self.assertEqual(self.get().status_code, 503)

    def test_inconsistent_route_id_rejected_even_with_test_pin(self):
        data = self.read(self.run / "comparison.json")
        data["routes"][0]["route_id"] = "wrong-id"
        self.repin_for_semantic_test(data)
        self.assertEqual(self.get().status_code, 503)

    def test_inconsistent_profile_rejected_even_with_test_pin(self):
        data = self.read(self.run / "comparison.json")
        data["profiles"]["distance_first"]["preference_fronts"][0] = ["wrong-id"]
        self.repin_for_semantic_test(data)
        self.assertEqual(self.get().status_code, 503)

    def test_wrong_saved_journey_rejected_even_with_test_pin(self):
        saved = self.read(self.root / pilot.SAVED_ROUTES)
        saved["request"]["origin"] = "Other origin"
        # Direct consistency check isolates journey validation from hash validation.
        with self.assertRaises(ValueError):
            pilot.validate_links(self.read(self.run / "comparison.json"), self.read(self.root / self.feature_relative / "route_features.json"), saved)

    def test_unsupported_schema_rejected(self):
        data = self.read(self.run / "comparison.json")
        data["schema_version"] = "future-unknown"
        self.repin_for_semantic_test(data)
        self.assertEqual(self.get().status_code, 503)

    def test_corruption_after_success_is_not_cached(self):
        self.assertEqual(self.get().status_code, 200)
        (self.run / "comparison.json").write_text("{}"); self.assertEqual(self.get().status_code, 503)

    def test_no_input_artifact_writes_and_nulls_preserved(self):
        before = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in self.root.rglob("*.json")}
        response = self.get().json()
        after = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in self.root.rglob("*.json")}
        self.assertEqual(before, after)
        for r in response["comparison"]["routes"]:
            self.assertIsNone(r["availability"]["opening_hours"]["currently_open"])
            self.assertIsNone(r["availability"]["lighting"]["actual_walked_street_coverage"])
        business = response["comparison"]["routes"][1]["context"]["shops_and_businesses"]
        self.assertEqual((business["raw_count"], business["conditional_count_min"]), (54, 53))

    def test_path_escape_in_manifest_rejected(self):
        manifest = self.read(self.run / "run_manifest.json")
        manifest["input_run"] = "../../outside"
        self.write(self.run / "run_manifest.json", manifest)
        self.assertEqual(self.get().status_code, 503)

    def test_read_only_method_and_openapi_contract(self):
        self.assertEqual(self.client.post("/pilot/ranchi/comparison").status_code, 405)
        schema = self.client.get("/openapi.json").json()
        self.assertIn("/pilot/ranchi/comparison", schema["paths"])
        self.assertEqual(set(schema["components"]["schemas"]["RouteResponse"]["properties"]), {"routes"})
        self.assertEqual(set(schema["components"]["schemas"]["Route"]["properties"]),
                         {"id", "distanceMeters", "durationSeconds", "coordinates", "startPoint", "endPoint"})

    def test_health_response_unchanged(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok", "service": "shepath-backend"})

    def test_route_response_contract_unchanged_with_mocked_provider(self):
        upstream = {"features": [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[85.32, 23.36], [85.33, 23.35]]},
                                 "properties": {"summary": {"distance": 1500, "duration": 1200}}}]}
        with patch.object(main, "get_heigit_api_key", return_value="test-only-placeholder"), \
             patch.object(main, "geocode_location", new=AsyncMock(side_effect=[(23.36, 85.32), (23.35, 85.33)])), \
             patch.object(main, "fetch_directions", new=AsyncMock(return_value=upstream)):
            response = self.client.post("/route", json={"origin": "A", "destination": "B", "travelMode": "walk"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"routes": [{"id": "heigit-foot-walking-route-1", "distanceMeters": 1500.0,
            "durationSeconds": 1200.0, "coordinates": [[23.36, 85.32], [23.35, 85.33]],
            "startPoint": [23.36, 85.32], "endPoint": [23.35, 85.33]}]})

    def test_route_invalid_mode_still_rejected(self):
        self.assertEqual(self.client.post("/route", json={"origin": "A", "destination": "B", "travelMode": "fly"}).status_code, 422)


if __name__ == "__main__": unittest.main(verbosity=2)
