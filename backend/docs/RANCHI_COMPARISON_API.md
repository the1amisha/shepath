# Phase 5C Stage 1 — saved Ranchi comparison API

`GET /pilot/ranchi/comparison` exposes the verified Phase 5B artifact for the **fixed saved walking journey from Albert Ekka Chowk, Ranchi to Doranda, Ranchi**. It reads files only, makes no provider request and runs no extraction, feature computation or comparison algorithm.

`POST /route` and `GET /health` retain their existing handlers and schemas. No frontend or ML integration is included.

## Applicability

The response always contains the three saved routes, measured distances, mapped proximity and normalized context metrics, preference profiles, pairwise explanations, duplicate scenarios, evidence availability, normalization rules and source provenance. The nested `comparison` object preserves the verified Phase 5B JSON values, including nulls and category overlaps.

The journey was retrieved at `2026-10-08T13:59:45.189759+00:00`. The OSM snapshot timestamp is `2026-10-08T20:21:06Z`. These are saved observations, not current routing or live conditions.

The existing `/route` mapper can reuse IDs such as `heigit-foot-walking-route-1` on subsequent requests. **An ID match or a place-name match does not establish that new geometry is covered by the saved comparison.** `applicability.appliesToNewRoutes` is always false. The response includes the saved-route file SHA-256 and individual coordinate-array SHA-256 values for explicit identity checks.

`savedRoutesSha256` identifies the exact saved routes JSON file, not a new API response with similar geometry. Individual geometry hashes use SHA-256 of UTF-8 `json.dumps(coordinates, separators=(",", ":"), allow_nan=False)` with coordinates in saved `[latitude, longitude]` order and no trailing newline. Number formatting and order must match; a hash mismatch must not be bypassed. Cross-language canonicalization should be standardized before using these hashes for frontend attachment to route displays.

## Query parameters

All parameters are optional **applicability assertions**, not routing inputs or result filters. Omitting them means “read this saved pilot snapshot.” A matching `routeId` still returns all three routes because the preference explanations compare them together.

| Parameter | Supported value/behavior |
|---|---|
| `origin` | `Albert Ekka Chowk, Ranchi`; requires `destination` too |
| `destination` | `Doranda, Ranchi`; requires `origin` too |
| `travelMode` | `walk` only |
| `journeyId` | `ranchi-albert-ekka-chowk-doranda-walk-20261008` |
| `routeId` | One of the three saved `heigit-foot-walking-route-1`, `-2`, `-3` IDs |
| `savedRoutesSha256` | `3ed66baf470b718fff3ce768e83eadd6df79dcaf5f8efbd6b401178b207123b1` |

Origin/destination matching ignores case and normalizes whitespace only. It does not geocode, accept approximate aliases or reverse the journey. Other assertions match exactly. Unknown or repeated query parameters are rejected; do not pass coordinates, arbitrary preferences or a new journey to this endpoint. It accepts no request body. Only the already-saved preference profiles are served; this stage does not calculate custom profiles on demand.

## Success response

HTTP 200, `Cache-Control: no-store`. The following is an **abridged projection of the real response**; other required fields, routes, categories and profile details are omitted for readability. The complete schema is exposed in `/docs` and `/openapi.json`.

```json
{
  "status": "available",
  "journey": {
    "id": "ranchi-albert-ekka-chowk-doranda-walk-20261008",
    "origin": "Albert Ekka Chowk, Ranchi",
    "destination": "Doranda, Ranchi",
    "travelMode": "walk",
    "routeIds": [
      "heigit-foot-walking-route-1",
      "heigit-foot-walking-route-2",
      "heigit-foot-walking-route-3"
    ],
    "retrievedAtUtc": "2026-10-08T13:59:45.189759+00:00",
    "savedRoutesSha256": "3ed66baf470b718fff3ce768e83eadd6df79dcaf5f8efbd6b401178b207123b1"
  },
  "applicability": {
    "scope": "fixed_saved_journey_only",
    "appliesToNewRoutes": false,
    "routeIdsAreSnapshotLocal": true,
    "actualWalkedStreetAttribution": "unverified",
    "liveObservations": false,
    "personalSafetyRecommendation": false
  },
  "integrity": {
    "status": "verified",
    "comparisonRun": "route_comparison_runs/20261010T060453_649409Z",
    "comparisonSha256": "b7f6241c246b7fd4bb7322dff21dd32f545e2895a3ccb2c504101f6f9f490236",
    "featureDatasetSha256": "4c81472e9c6223e685af9f5ccc0034afd9aa37d2dca46e862e1c94d130ef0c80"
  },
  "comparison": {
    "schema_version": "SHEPATH.phase5b.v1",
    "routes": [
      {
        "route_id": "heigit-foot-walking-route-1",
        "geodesic_distance_metres": 5336.767111011035,
        "backend_distance_metres": 5348.2,
        "context": {
          "shops_and_businesses": {
            "raw_count": 19,
            "conditional_count_min": 19
          }
        },
        "availability": {
          "opening_hours": {"currently_open": null},
          "verified_on_walked_street": {
            "status": "not_performed",
            "osm_ids": null,
            "tag_coverage": null
          }
        }
      }
    ],
    "profiles": {
      "distance_first": {
        "first_front_candidates": ["heigit-foot-walking-route-2"]
      }
    }
  }
}
```

The full response preserves `comparison.normalization`, `dimension_comparisons`, all profile fronts and pairwise explanations, `source_provenance`, each route's context IDs/scenarios, `criteria`, `correlation_audit` and `availability`. Preference fronts are not personal-safety rankings. Nearby mapped records do not establish access, current opening or physical absence when no record exists. Missing lighting/sidewalk values remain unknown; nothing is imputed. Route 2's business count remains 54 raw records with a conditional 53-record duplicate scenario.

## Unavailable and not-applicable responses

| HTTP | `detail.status` | Codes |
|---|---|---|
| 409 | `not_applicable` | `journey_mismatch`, `route_mismatch`, `geometry_snapshot_mismatch` |
| 422 | `invalid_request` | `incomplete_journey`, `unsupported_parameters` |
| 503 | `unavailable` | `artifact_missing`, `artifact_invalid` |

Examples:

```json
{
  "detail": {
    "status": "not_applicable",
    "code": "route_mismatch",
    "message": "The requested route ID is not part of this saved comparison."
  }
}
```

```json
{
  "detail": {
    "status": "unavailable",
    "code": "artifact_invalid",
    "message": "The saved comparison bundle failed integrity or consistency checks."
  }
}
```

Errors expose no local filesystem path, credential or partial comparison. The API does not call `/route` or regenerate missing artifacts as a fallback. A broken pilot artifact does not prevent `/health` or the existing routing API from working. Standard FastAPI validation may also return its normal 422 response for framework-level input errors.

## Artifact deployment and integrity

`backend/app/pilot_ranchi.py` deliberately pins the latest reviewed comparison run and its SHA-256 rather than choosing whichever directory is newest. Serving a future run requires an explicit code/configuration review of the new trust anchor. Matching a manifest that was edited along with its payload cannot bypass the current pin.

Install these existing local artifacts at their repository-relative paths:

1. `data/ranchi_safety/route_comparison_runs/20261010T060453_649409Z/`: `run_manifest.json` and `comparison.json`.
2. `data/ranchi_safety/route_feature_runs/20261009T170001_897709Z/`: the run manifest and **all six files listed in its artifact map**, including canonical features, source evidence, duplicate review and individual route JSON files.
3. `data/ranchi_safety/route_coverage_runs/20261008T140112_006152Z/routes.json`.

Each request verifies the comparison against both its manifest and the pinned digest, the linked Phase 5A manifest/artifact hashes, and the saved-route digest. It checks route identities, saved journey labels/direction/mode, distances, category values, missing-data fields and preference-profile references across the artifacts. It reads each file into bounded memory (8 MiB/file limit), with no success cache that could conceal subsequent corruption. Invalid JSON, unsupported schema or inconsistent IDs fail closed.

This adapter depends only on existing FastAPI/Pydantic and Python standard-library facilities. It does not import PyOsmium, Shapely, extraction scripts or the comparison engine. The regional PBF and 11 GB SQLite index are not needed by the endpoint. Repository-relative lookup works independently of the shell working directory. Files are treated as read-only. Deployments must deliberately package the verified bundle; some generated data is ignored by Git, so a source checkout alone may return 503.

## Local testing

From `D:\shepath`, the offline in-process suite runs without HTTP sockets or an API key:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -p "test_*.py" -v
```

For a later manual local-server check, launch:

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

In another PowerShell window:

```powershell
curl.exe http://127.0.0.1:8000/health
curl.exe http://127.0.0.1:8000/pilot/ranchi/comparison
curl.exe --get http://127.0.0.1:8000/pilot/ranchi/comparison --data-urlencode "origin=Albert Ekka Chowk, Ranchi" --data-urlencode "destination=Doranda, Ranchi" --data-urlencode "travelMode=walk" --data-urlencode "routeId=heigit-foot-walking-route-2"
curl.exe --get http://127.0.0.1:8000/pilot/ranchi/comparison --data-urlencode "origin=Other origin" --data-urlencode "destination=Doranda, Ranchi"
```

The last request should return HTTP 409. `/docs` provides the generated response models and query parameters. Manual network commands above are instructions only; implementation validation used TestClient in-process, with provider calls mocked for `/route` regression coverage.

## Validation and next stages

On 2026-10-10, **25 backend tests passed in 5.883 seconds**, with zero failures or skips. There were no pre-existing backend test modules. New tests cover successful/lossless reads, no writes, preserved nulls and duplicate uncertainty, all route/profile references, applicable and mismatched queries, newly generated geometry fingerprints, missing/corrupt/malformed artifacts, pin enforcement, unsupported schemas, path containment, corruption after a successful read, read-only HTTP method, OpenAPI schemas, `/health`, and a mocked-provider `/route` regression. No backend dependency changes were needed.

Before frontend integration, implement a clearly labeled saved-pilot view, display snapshot age/unknowns and preference explanations, handle 409/422/503 explicitly, and enforce snapshot/geometry identity before displaying comparisons alongside routes. Do not attach results to fresh `/route` responses by ID alone. Coordinate hashing/canonicalization and response-contract versioning need a deliberate shared client/server convention.

Arbitrary journeys require a separately designed per-journey feature pipeline: validated OSM geographic coverage, geometry-specific feature generation, artifact provenance and caching, validated route-to-road matching, uncertainty/duplicate handling, and tests for new extents. None of those computations is performed by this endpoint. Credible personal-safety claims additionally require current, independently validated evidence; mapped proximity alone remains insufficient.
