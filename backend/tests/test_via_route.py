"""Via routing contract tests; no external requests."""
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from fastapi.testclient import TestClient
from backend.app import main


class ViaRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_coordinate_order_and_alternatives(self):
        for via in (None, (23.365, 85.325)):
            response = httpx.Response(200, json={"features": []}, request=httpx.Request("POST", "https://example.test"))
            client = AsyncMock()
            client.post.return_value = response
            await main.fetch_directions(client, "test", "foot-walking", (23.36, 85.32), (23.35, 85.33), via_point=via)
            body = client.post.call_args.kwargs["json"]
            expected = [[85.32, 23.36], [85.33, 23.35]]
            if via:
                expected.insert(1, [85.325, 23.365])
            self.assertEqual(body["coordinates"], expected)
            self.assertEqual("alternative_routes" in body, via is None)

    def test_route_endpoint_geocodes_and_passes_via(self):
        upstream = {"features": [{"geometry": {"coordinates": [[85.32, 23.36], [85.325, 23.365], [85.33, 23.35]]}, "properties": {"summary": {"distance": 2000, "duration": 1600}}}]}
        for value in (" Hospital, Ranchi ", " ", None):
            with patch.object(main, "get_heigit_api_key", return_value="test"), patch.object(main, "geocode_location", new=AsyncMock(side_effect=[(23.36, 85.32), (23.35, 85.33), (23.365, 85.325)])) as geo, patch.object(main, "fetch_directions", new=AsyncMock(return_value=upstream)) as directions:
                result = TestClient(main.app).post("/route", json={"origin": "A", "destination": "B", "via": value, "travelMode": "walk"})
                self.assertEqual(result.status_code, 200)
                self.assertEqual(geo.await_count, 3 if value and value.strip() else 2)
                if value and value.strip():
                    self.assertEqual(geo.call_args.args[2:], ("Hospital, Ranchi", "Via location"))
                    self.assertEqual(directions.call_args.kwargs, {"via_point": (23.365, 85.325), "request_alternatives": False})
                else:
                    self.assertEqual(directions.call_args.kwargs, {})

    def test_failed_via_never_falls_back_to_direct_route(self):
        with patch.object(main, "get_heigit_api_key", return_value="test"), patch.object(main, "geocode_location", new=AsyncMock(side_effect=[(23.36, 85.32), (23.35, 85.33), main.HTTPException(404, "Via location could not be geocoded.")])), patch.object(main, "fetch_directions", new=AsyncMock()) as directions:
            response = TestClient(main.app).post("/route", json={"origin": "A", "destination": "B", "via": "Unknown", "travelMode": "walk"})
            self.assertEqual(response.status_code, 404)
            directions.assert_not_awaited()

    def test_oversized_via_rejected(self):
        response = TestClient(main.app).post("/route", json={"origin": "A", "destination": "B", "via": "a" * 301, "travelMode": "walk"})
        self.assertEqual(response.status_code, 422)


class SelectedPointTests(unittest.TestCase):
    def test_selected_points_bypass_geocoding(self):
        upstream = {"features": [{"geometry": {"coordinates": [[85.32, 23.36], [85.33, 23.35]]}, "properties": {"summary": {"distance": 1500, "duration": 1200}}}]}
        for selected in (True, False):
            with patch.object(main, "get_heigit_api_key", return_value="test"), patch.object(main, "geocode_location", new=AsyncMock(return_value=(23.35, 85.33))) as geo, patch.object(main, "fetch_directions", new=AsyncMock(return_value=upstream)) as directions:
                body = {"origin": "Selected start", "destination": "Destination", "originPoint": [23.36, 85.32], "travelMode": "walk"}
                if selected:
                    body["destinationPoint"] = [23.35, 85.33]
                result = TestClient(main.app).post("/route", json=body)
                self.assertEqual(result.status_code, 200)
                self.assertEqual(geo.await_count, 0 if selected else 1)
                self.assertEqual(directions.call_args.args[3:5], ((23.36, 85.32), (23.35, 85.33)))

    def test_invalid_points_rejected_before_provider_access(self):
        for point in ([91, 85], [23, 181], [23], [True, 85], ["23", 85], "23,85"):
            with patch.object(main, "get_heigit_api_key", side_effect=AssertionError("Provider must not be accessed")):
                response = TestClient(main.app).post("/route", json={"origin": "A", "destination": "B", "originPoint": point, "travelMode": "walk"})
                self.assertEqual(response.status_code, 422)
