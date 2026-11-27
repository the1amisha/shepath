"""Check the planner-facing routing API without network calls or credentials."""
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.app import main


class PlannerContractTests(unittest.TestCase):
    def test_walking_and_driving_preserve_alternatives(self):
        start = [23.36, 85.32]
        end = [23.35, 85.33]
        paths = [[start, middle, end] for middle in ([23.355, 85.323], [23.358, 85.327])]
        features = [
            {
                "geometry": {"type": "LineString", "coordinates": [[lon, lat] for lat, lon in path]},
                "properties": {"summary": {"distance": 1500 + i, "duration": 600 + i}},
            }
            for i, path in enumerate(paths)
        ]
        for mode, profile in (("walk", "foot-walking"), ("drive", "driving-car")):
            provider = AsyncMock(return_value={"features": features})
            with (
                self.subTest(mode=mode),
                patch.object(main.httpx, "AsyncClient"),
                patch.object(main, "get_heigit_api_key", return_value="test"),
                patch.object(main, "fetch_directions", provider),
            ):
                response = TestClient(main.app).post("/route", json={
                    "origin": "Start", "destination": "End", "originPoint": start,
                    "destinationPoint": end, "travelMode": mode,
                })
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(provider.await_args.args[2], profile)
                routes = response.json()["routes"]
                self.assertEqual([r["coordinates"] for r in routes], paths)
                self.assertEqual(len({r["id"] for r in routes}), len(paths))
                for i, route in enumerate(routes):
                    self.assertEqual((route["startPoint"], route["endPoint"]), (start, end))
                    self.assertEqual((route["distanceMeters"], route["durationSeconds"]), (1500 + i, 600 + i))
