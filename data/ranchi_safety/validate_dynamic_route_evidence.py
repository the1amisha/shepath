"""Reproduce offline Stage 1 validation; writes only dynamic_validation/ under this directory."""
from datetime import datetime, timezone
import io
import json
from pathlib import Path
import time
import tracemalloc
import unittest
from unittest.mock import patch

import compare_routes
import dynamic_route_evidence as dynamic


def main():
    out = dynamic.ROOT / 'dynamic_validation'
    out.mkdir(exist_ok=True)
    suite = unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(name) for name in (
        'test_dynamic_route_evidence', 'test_route_features', 'test_route_comparison',
        'test_route_coverage', 'test_post_extraction'))
    log = io.StringIO()
    with patch('socket.socket.connect', side_effect=AssertionError('Network forbidden')):
        result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
        # Match the byte-hashed artifacts on every OS; Git stores LF and checks out CRLF.
        (out / 'tests.log').write_text(log.getvalue(), encoding='utf-8', newline='\r\n')
        if not result.wasSuccessful():
            print(log.getvalue())
            raise SystemExit(1)
        tracemalloc.start()
        start = time.perf_counter()
        data = dynamic.PilotDataset.load()
        load_seconds = time.perf_counter() - start
        resident, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        old, _, _, saved, manifest = compare_routes.load_bundle(compare_routes.DEFAULT)
        old_by_id = {r['route_id']: r for r in old['routes']}
        rows = []
        keys = ('categories', 'lighting', 'sidewalk', 'duplicate_sensitivity', 'nearby_evidence',
                'projected_route_length_metres', 'route_length_geodesic_metres')
        for route in saved['routes']:
            start = time.perf_counter()
            new = dynamic.analyze_route(route['id'], route['coordinates'], route['distanceMeters'],
                                        route['durationSeconds'], dataset=data)
            elapsed = time.perf_counter() - start
            previous = old_by_id[route['id']]
            differences = [k for k in keys if new['route_context'][k] != previous[k]]
            differences += ['opening_hours.' + k for k, v in previous['opening_hours'].items()
                            if new['route_context']['opening_hours'][k] != v]
            (out / (route['id'] + '.json')).write_text(json.dumps(new, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8', newline='\r\n')
            rows.append({'route_id': route['id'], 'status': new['status'], 'geometry_sha256': new['route']['geometry_sha256'],
                'analysis_seconds': elapsed, 'phase5a_differences': differences,
                'counts': {c: v['count'] for c, v in new['route_context']['categories'].items()},
                'nearby_road_geometry': new['route_context']['nearby_road_geometry']})
        summary = {'validated_at_utc': datetime.now(timezone.utc).isoformat(),
            'tests': {'run': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped)},
            'phase5a_artifact_sha256': manifest['artifacts']['route_features.json'],
            'source_manifest_sha256': dynamic.MANIFEST_SHA256,
            'code_sha256': data._provenance['code_sha256'],
            'memory': {'method': 'tracemalloc Python-managed allocations only; excludes native GEOS/PROJ heaps and interpreter/import baseline',
                       'loader_retained_bytes': resident, 'loader_peak_bytes': peak, 'load_seconds_with_tracemalloc': load_seconds,
                       'small_export_bytes': data._provenance['loaded_export_bytes']},
            'routes': rows,
            'artifacts': {p.name: dynamic.verify.extract.sha(p) for p in sorted(out.glob('*')) if p.name != 'summary.json'}}
        (out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\r\n')
        print(json.dumps(summary, indent=2))
        if any(r['phase5a_differences'] or r['status'] != 'available' for r in rows):
            raise SystemExit('Dynamic evidence differs from Phase 5A; inspect summary')


if __name__ == '__main__':
    main()
