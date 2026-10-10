# Route-coverage validation — 8 October 2026

The existing local backend at `http://127.0.0.1:8000` responded to `/health` as
`shepath-backend`. The experiment submitted the exact requested walking query
to **POST /route** and received three real routes. It made no direct HeiGIT or
Overpass request and did not read or copy credentials.

Original retrieval: `route_coverage_runs/20261008T135942_299748Z/`.
Retrieval timestamp: `2026-10-08T13:59:45.189759+00:00`.
Offline replay: `route_coverage_runs/20261008T140112_006152Z/`.
Both use the original OSM bbox `[23.350, 85.310, 23.380, 85.340]` and 100 m buffer.

| Route ID | API distance (m) | Length inside | Length outside | Buffer area inside | Buffer fully covered |
| --- | ---: | ---: | ---: | ---: | --- |
| heigit-foot-walking-route-1 | 5,348.2 | 54.1863% | 45.8137% | 54.4067% | No |
| heigit-foot-walking-route-2 | 5,257.2 | 56.6007% | 43.3993% | 56.3355% | No |
| heigit-foot-walking-route-3 | 6,607.6 | 63.9492% | 36.0508% | 60.7716% | No |

The pilot extent is inadequate for full-route analysis for all three alternatives.
All require southern corridor coverage; route 3 also needs a western buffer
extension. Actual uncovered polygons and centerline pieces are saved as GeoJSON.
No expanded OSM extraction was performed.

## Tests and audit checks

**16 new offline tests passed**, covering entirely inside and outside lines,
crossing with both endpoints outside, boundary following, point-only touches,
repeated traversal, full/zero/partial buffer coverage, centerlines inside with
buffers outside, the projected boundary case, zero-length rejection, invalid
buffer/schema rejection, saved boundary metadata, loopback-only API use and
an unavailable backend producing an honest failure report without fake routes.

**All 32 tests** in `data/ranchi_safety/` passed, including the 16 existing
extraction/coverage tests. Network-failure tests use mocks; synthetic polylines
are never saved as real-route artifacts.

Additional readback checks succeeded:

* Offline replay reproduced every per-route metric exactly, without a network call.
* `routes.json` preserves all original API route records exactly, including IDs,
  coordinates, distances, durations and endpoints.
* The saved response SHA-256 matches `backend_response.json`.
* Inside/outside length and area percentages each reconcile to 100% within
  floating-point tolerance.
* All three buffers have `fully_covered=false`, independent of display rounding.

The root report now reflects offline replay of the original real retrieval;
the initial live report remains archived with that retrieval. No backend,
frontend, routing or ML code changed. No safety score, commit or push was made.
