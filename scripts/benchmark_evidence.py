"""Offline cold/warm response timing; no provider calls or coordinate logging."""
import asyncio
import json
from pathlib import Path
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.app.route_evidence import EvidenceRequest, EvidenceService


async def main():
    fixture = ROOT / 'data/ranchi_safety/dynamic_validation/heigit-foot-walking-route-1.json'
    route = json.loads(fixture.read_text())['route']
    request = EvidenceRequest(route_id='offline-benchmark', coordinates=route['coordinates'])
    service = EvidenceService()
    try:
        first = None
        for label in ('cold', 'repeat-1', 'repeat-2'):
            start = perf_counter()
            result = await service.analyze(request)
            elapsed = perf_counter() - start
            if first is None:
                first = result
            assert result == first, 'Repeated response differs'
            print(json.dumps({'request': label, 'seconds': elapsed,
                              'status': json.loads(result)['status'], 'response_bytes': len(result)}))
    finally:
        service.close()


if __name__ == '__main__':
    asyncio.run(main())
