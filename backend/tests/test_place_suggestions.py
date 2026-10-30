"""Autocomplete endpoint tests without external requests."""
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from fastapi.testclient import TestClient
from backend.app import main


class SuggestionsTests(unittest.TestCase):
    def test_rejects_short_or_long_text_before_provider_call(self):
        with patch.object(main, "get_heigit_api_key", side_effect=AssertionError("No key access")):
            for text in ("ab", "   ", "x" * 201):
                self.assertEqual(TestClient(main.app).post("/places/suggest", json={"text": text}).status_code, 422)

    def test_normalizes_filters_deduplicates_and_bounds_results(self):
        feature = {"properties": {"label": "School, Ranchi"}, "geometry": {"coordinates": [85.3, 23.3]}}
        invalid = {"properties": {"label": "Bad"}, "geometry": {"coordinates": [999, 23]}}
        response = httpx.Response(200, json={"features": [feature, feature, invalid, None]}, request=httpx.Request("GET", "https://example.test"))
        with patch.object(main, "get_heigit_api_key", return_value="secret-test"), patch.object(main.httpx, "AsyncClient") as factory:
            client = AsyncMock()
            client.get.return_value = response
            factory.return_value.__aenter__.return_value = client
            result = TestClient(main.app).post("/places/suggest", json={"text": " Sch "})
            self.assertEqual(result.json(), {"places": [{"label": "School, Ranchi", "point": [23.3, 85.3]}]})
            self.assertEqual(client.get.call_args.kwargs["params"]["text"], "Sch")
            self.assertEqual(client.get.call_args.kwargs["params"]["boundary.country"], "IND")
            self.assertNotIn("secret-test", result.text)

    def test_provider_failure_is_generic_and_empty_is_not_failure(self):
        for failure in (True, False):
            with patch.object(main, "get_heigit_api_key", return_value="secret-test"), patch.object(main.httpx, "AsyncClient") as factory:
                client = AsyncMock()
                factory.return_value.__aenter__.return_value = client
                if failure:
                    client.get.side_effect = httpx.ConnectError("secret-test")
                else:
                    client.get.return_value = httpx.Response(200, json={"features": []}, request=httpx.Request("GET", "https://example.test"))
                response = TestClient(main.app).post("/places/suggest", json={"text": "Unknown"})
                self.assertEqual(response.status_code, 502 if failure else 200)
                self.assertNotIn("secret-test", response.text)
                if not failure:
                    self.assertEqual(response.json(), {"places": []})
