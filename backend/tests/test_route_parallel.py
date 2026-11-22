import asyncio
import unittest
from unittest.mock import AsyncMock, patch
from backend.app import main

class ParallelGeocodingTests(unittest.IsolatedAsyncioTestCase):
    async def test_both_lookups_start_before_either_finishes(self):
        started = set()
        ready = asyncio.Event()
        async def geocode(client, key, text, label):
            started.add(label)
            if len(started) == 2:
                ready.set()
            await asyncio.wait_for(ready.wait(), 1)
            return (23.36, 85.32) if label == 'Origin' else (23.35, 85.33)
        with patch.object(main, 'get_heigit_api_key', return_value='test'), patch.object(main, 'geocode_location', side_effect=geocode), patch.object(main, 'fetch_directions', new=AsyncMock(return_value={})), patch.object(main, 'map_directions_response', return_value='ok'):
            result = await main.create_route(main.RouteRequest(origin='A', destination='B', travelMode='walk'))
        self.assertEqual(result, 'ok')
        self.assertEqual(started, {'Origin', 'Destination'})
