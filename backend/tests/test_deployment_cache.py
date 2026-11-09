import json
import os
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from backend.app.route_evidence import EvidenceRequest, EvidenceService
from backend.app.settings import cors_origins
from test_route_evidence import PAYLOAD, fake_result


class DeploymentTests(unittest.TestCase):
    def test_origins(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertIn('http://localhost:8080', cors_origins())
        with patch.dict(os.environ, {'SHEPATH_CORS_ORIGINS': 'https://shepath.example, https://shepath.example'}):
            self.assertEqual(cors_origins(), ['https://shepath.example'])
        for value in ('', '*', 'https://site.example/path', 'https://user:pass@site.example',
                      'https://site.example?x=1', 'file://site.example', 'https://site.example:bad'):
            with self.subTest(value=value), patch.dict(os.environ, {'SHEPATH_CORS_ORIGINS': value}):
                with self.assertRaises(ValueError):
                    cors_origins()


class ResponseCacheTests(unittest.TestCase):
    def setUp(self):
        self.engine = SimpleNamespace(PilotDataset=SimpleNamespace(load=Mock(return_value=object())),
                                      analyze_route=Mock(side_effect=fake_result))
        self.service = EvidenceService(loader=lambda: self.engine)
        self.addCleanup(self.service.close)

    def run_payload(self, **changes):
        return self.service._run(EvidenceRequest(**{**PAYLOAD, **changes}))

    def test_identity(self):
        first = self.run_payload()
        self.assertEqual(first, self.run_payload())
        self.engine.analyze_route.assert_called_once()
        for change in ({'route_id': 'different'}, {'distance_metres': 10}, {'duration_seconds': 5},
                       {'coordinates': [[23.355, 85.32], [23.361, 85.32]]}):
            self.run_payload(**change)
        self.assertEqual(self.engine.analyze_route.call_count, 5)
        self.assertEqual(json.loads(self.run_payload())['route']['id'], PAYLOAD['route_id'])

    def test_expiry_and_entry_eviction(self):
        self.service.cache_entries = 1
        with patch('backend.app.route_evidence.monotonic', return_value=0):
            self.run_payload()
        with patch('backend.app.route_evidence.monotonic', return_value=301):
            self.run_payload()
            self.run_payload(route_id='second')
            self.run_payload()
        self.assertEqual(self.engine.analyze_route.call_count, 4)
        self.assertEqual(len(self.service.cache), 1)

    def test_oversize_and_errors_not_cached(self):
        self.service.cache_bytes = 1
        self.run_payload()
        self.run_payload()
        self.assertEqual(self.engine.analyze_route.call_count, 2)
        self.assertEqual(self.service.cache_size, 0)
        self.service.cache_bytes = 10000
        self.engine.analyze_route.side_effect = ValueError('bad geometry')
        with self.assertRaises(HTTPException):
            self.run_payload()
        self.assertFalse(self.service.cache)

    def test_byte_budget_and_service_isolation(self):
        self.service.cache_bytes = len(self.run_payload()) + 10
        self.run_payload(route_id='second')
        self.assertLessEqual(self.service.cache_size, self.service.cache_bytes)
        self.assertEqual(len(self.service.cache), 1)
        other = EvidenceService(loader=lambda: self.engine)
        try:
            other._run(EvidenceRequest(**PAYLOAD))
        finally:
            other.close()
        self.assertEqual(self.engine.analyze_route.call_count, 3)
