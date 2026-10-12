"""Offline HTTP, resource-bound and Stage 1 parity tests."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app import main, route_evidence as api

PAYLOAD = {'route_id': 'new-route', 'coordinates': [[23.355, 85.32], [23.36, 85.32]]}


def fake_result(**kwargs):
    return {'schema_version': 'SHEPATH.dynamic_route_evidence.v1', 'status': 'available',
            'route': {'id': kwargs['route_id']}, 'analysis': {'buffer_metres': kwargs['buffer_metres']},
            'coverage': {}, 'route_context': {}, 'evidence_completeness': {},
            'uncertainty_flags': [], 'source_provenance': {}, 'evidence_identity_sha256': 'fixture'}


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.engine = SimpleNamespace(PilotDataset=SimpleNamespace(load=Mock(return_value=object())),
                                      analyze_route=Mock(side_effect=fake_result))
        self.service = api.EvidenceService(loader=lambda: self.engine)
        main.app.dependency_overrides[api.get_service] = lambda: self.service
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        self.service.close()
        main.app.dependency_overrides.clear()

    def test_valid_fixed_buffer_cache_and_worker_thread(self):
        threads = []
        def run(**kwargs):
            threads.append(threading.current_thread().name)
            return fake_result(**kwargs)
        self.engine.analyze_route.side_effect = run
        for _ in range(2):
            response = self.client.post(api.PATH, json=PAYLOAD)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['analysis']['buffer_metres'], 100)
            self.assertEqual(response.headers['cache-control'], 'no-store')
        self.engine.PilotDataset.load.assert_called_once()
        self.assertTrue(all(t.startswith('ranchi-evidence') for t in threads))

    def test_invalid_inputs_are_422_without_loading(self):
        for change in ({'coordinates': None}, {'coordinates': []}, {'coordinates': [[0, 0]]},
                       {'coordinates': [[91, 85], [23, 85]]}, {'coordinates': [[23, 181], [23, 85]]},
                       {'coordinates': [[True, 85], [23, 85]]}, {'coordinates': [['23', 85], [23, 85]]},
                       {'coordinates': [[23, 85, 1], [23, 85]]}, {'coordinates': [[23, 85]] * 2},
                       {'coordinates': [[23, 85], [24, 85]] * 5001},
                       {'route_id': ''}, {'route_id': ' '}, {'route_id': 2},
                       {'distance_metres': -1}, {'duration_seconds': True}, {'distance_metres': '4'},
                       {'buffer_metres': 50}):
            with self.subTest(change=str(change)[:100]):
                self.assertEqual(self.client.post(api.PATH, json={**PAYLOAD, **change}).status_code, 422)
        for raw in ('{', '{}', 'null', '{"coordinates": [NaN]}', '{"distance_metres": 1e999}'):
            self.assertEqual(self.client.post(api.PATH, content=raw, headers={'Content-Type': 'application/json'}).status_code, 422)
        self.engine.PilotDataset.load.assert_not_called()

    def test_missing_corrupt_or_dependencies_unavailable_sticky_503(self):
        for exception in (FileNotFoundError('private/path'), ValueError('hash mismatch'), ImportError('missing osmium')):
            with self.subTest(exception=exception):
                service = api.EvidenceService(loader=Mock(side_effect=exception))
                main.app.dependency_overrides[api.get_service] = lambda: service
                for _ in range(2):
                    response = self.client.post(api.PATH, json=PAYLOAD)
                    self.assertEqual(response.status_code, 503)
                    self.assertEqual(response.json()['detail']['code'], 'dataset_unavailable')
                    self.assertNotIn('private/path', response.text)
                service.loader.assert_called_once()
                service.close()

    def test_engine_validation_and_internal_failures(self):
        for exc, status in ((ValueError('Route exceeds 50000 densified vertices'), 422), (RuntimeError('broken'), 503)):
            self.engine.analyze_route.side_effect = exc
            self.assertEqual(self.client.post(api.PATH, json=PAYLOAD).status_code, status)

    def test_body_limit_encoding_and_cors(self):
        self.assertEqual(self.client.post(api.PATH, content=b'x' * (api.MAX_BODY_BYTES + 1)).status_code, 413)
        self.assertEqual(self.client.post(api.PATH, content=b'{}', headers={'Content-Encoding': 'gzip'}).status_code, 415)
        response = self.client.post(api.PATH, json=PAYLOAD, headers={'Origin': 'http://localhost:8080'})
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:8080')

    def test_cors_preflight_allows_frontend_and_rejects_unconfigured_origin(self):
        for origin in ('http://127.0.0.1:8080', 'http://localhost:8080'):
            response = self.client.options(api.PATH, headers={'Origin': origin,
                'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['access-control-allow-origin'], origin)
        response = self.client.options(api.PATH, headers={'Origin': 'https://unconfigured.example',
            'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('access-control-allow-origin', response.headers)
        self.engine.PilotDataset.load.assert_not_called()

    def test_timeout_retains_slot_busy_health_and_recovery(self):
        started, release = threading.Event(), threading.Event()
        def slow(**kwargs):
            started.set()
            release.wait(5)
            return fake_result(**kwargs)
        self.engine.analyze_route.side_effect = slow
        self.service.timeout = .05
        try:
            response = self.client.post(api.PATH, json=PAYLOAD)
            self.assertTrue(started.is_set())
            self.assertEqual(response.status_code, 504)
            for _ in range(5):
                response = self.client.post(api.PATH, json=PAYLOAD)
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.json()['detail']['code'], 'analysis_busy')
                self.assertEqual(response.headers['retry-after'], '5')
            self.assertEqual(self.engine.analyze_route.call_count, 1)
            self.assertEqual(self.client.get('/health').status_code, 200)
        finally:
            release.set()
            self.service.executor.shutdown(wait=True)

    def test_concurrent_requests_admit_only_one(self):
        entered, release = threading.Event(), threading.Event()
        def slow(**kwargs):
            entered.set()
            release.wait(5)
            return fake_result(**kwargs)
        self.engine.analyze_route.side_effect = slow
        with ThreadPoolExecutor(max_workers=2) as clients:
            first = clients.submit(self.client.post, api.PATH, json=PAYLOAD)
            try:
                self.assertTrue(entered.wait(2))
                response = self.client.post(api.PATH, json=PAYLOAD)
                self.assertEqual(response.status_code, 503)
                self.assertEqual(self.client.get('/health').status_code, 200)
            finally:
                release.set()
            self.assertEqual(first.result().status_code, 200)
        self.assertEqual(self.engine.analyze_route.call_count, 1)


class ASGIBodyTests(unittest.IsolatedAsyncioTestCase):
    async def test_chunked_limit_without_content_length(self):
        sent = []
        chunks = iter([{'type': 'http.request', 'body': b'x' * 600000, 'more_body': True}] * 2)
        async def receive():
            return next(chunks)
        async def send(message):
            sent.append(message)
        async def forbidden(*args):
            self.fail('Oversized request reached endpoint')
        await api.EvidenceBodyLimit(forbidden)({'type': 'http', 'method': 'POST', 'path': api.PATH, 'headers': []}, receive, send)
        self.assertEqual(sent[0]['status'], 413)

    async def test_body_timeout(self):
        sent = []
        async def receive():
            await asyncio.sleep(1)
        async def send(message):
            sent.append(message)
        with patch.object(api, 'BODY_TIMEOUT_SECONDS', .01):
            await api.EvidenceBodyLimit(None)({'type': 'http', 'method': 'POST', 'path': api.PATH, 'headers': []}, receive, send)
        self.assertEqual(sent[0]['status'], 408)

    async def test_cancellation_keeps_slot_until_completion(self):
        entered, release = threading.Event(), threading.Event()
        def slow(**kwargs):
            entered.set()
            release.wait(5)
            return fake_result(**kwargs)
        engine = SimpleNamespace(PilotDataset=SimpleNamespace(load=lambda: object()), analyze_route=slow)
        service = api.EvidenceService(loader=lambda: engine)
        request = api.EvidenceRequest(**PAYLOAD)
        task = asyncio.create_task(service.analyze(request))
        try:
            while not entered.is_set():
                await asyncio.sleep(.001)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            with self.assertRaises(HTTPException) as caught:
                await service.analyze(request)
            self.assertEqual(caught.exception.status_code, 503)
        finally:
            release.set()
            await asyncio.to_thread(service.executor.shutdown, wait=True)
        self.assertFalse(service.gate.locked())


class RealPilotTests(unittest.TestCase):
    def test_three_saved_routes_lossless_stage1_and_new_geometry(self):
        engine = api.load_engine()
        saved = json.loads((api.DATA_ROOT / 'route_coverage_runs/20261008T140112_006152Z/routes.json').read_text())
        observations = []
        with TestClient(main.app) as client, patch('socket.socket.connect', side_effect=AssertionError('Network forbidden')):
            service = main.app.state.route_evidence_service
            with patch.object(engine.PilotDataset, 'load', wraps=engine.PilotDataset.load) as load:
                for route in saved['routes']:
                    request = {'route_id': route['id'], 'coordinates': route['coordinates'],
                               'distance_metres': route['distanceMeters'], 'duration_seconds': route['durationSeconds']}
                    started = time.perf_counter()
                    response = client.post(api.PATH, json=request)
                    elapsed = time.perf_counter() - started
                    self.assertEqual(response.status_code, 200, response.text)
                    artifact = json.loads((api.DATA_ROOT / 'dynamic_validation' / (route['id'] + '.json')).read_text(encoding='utf-8'))
                    # Historical bytes stay pinned. Only the edited verifier's code
                    # provenance and the resulting evidence identity may differ.
                    artifact['source_provenance']['code_sha256']['verify_post_extraction.py'] = (
                        engine.verify.extract.sha(Path(engine.verify.__file__)))
                    artifact['evidence_identity_sha256'] = engine.digest({
                        'geometry_sha256': artifact['route']['geometry_sha256'],
                        'analysis': artifact['analysis'], 'schema_version': artifact['schema_version'],
                        'source': artifact['source_provenance']})
                    self.assertEqual(response.json(), artifact)
                    observations.append({'route_id': route['id'], 'http_seconds': elapsed,
                                         'historical_parity_except_verifier_provenance': True,
                                         'evidence_identity_sha256': response.json()['evidence_identity_sha256']})
                self.assertEqual(load.call_count, 1)
                outside = client.post(api.PATH, json={**PAYLOAD, 'coordinates': [[0, 0], [1, 1]]})
                self.assertEqual(outside.status_code, 200)
                self.assertEqual(outside.json()['status'], 'coverage_unavailable')
                self.assertIsNone(outside.json()['route_context'])
                a = client.post(api.PATH, json=PAYLOAD).json()
                b = client.post(api.PATH, json={**PAYLOAD, 'coordinates': PAYLOAD['coordinates'][::-1]}).json()
                self.assertNotEqual(a['route']['geometry_sha256'], b['route']['geometry_sha256'])
                renamed = client.post(api.PATH, json={**PAYLOAD, 'route_id': 'another-label'}).json()
                self.assertEqual(a['evidence_identity_sha256'], renamed['evidence_identity_sha256'])
                complex_route = [[23.34, 85.32], [23.375, 85.32]] * 200
                self.assertEqual(client.post(api.PATH, json={**PAYLOAD, 'coordinates': complex_route}).status_code, 422)
        print('Stage 2 HTTP parity:', json.dumps(observations))

    def test_actual_pinned_manifest_failure_returns_503(self):
        engine = api.load_engine()
        with patch.object(engine, 'MANIFEST_SHA256', '0' * 64), TestClient(main.app) as client:
            response = client.post(api.PATH, json=PAYLOAD)
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()['detail']['code'], 'dataset_unavailable')


if __name__ == '__main__':
    unittest.main()
