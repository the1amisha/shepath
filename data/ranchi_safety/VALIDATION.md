# Validation performed on 8 October 2026

All changes are confined to `data/ranchi_safety/`. Routing endpoints were not
modified. No commit or push was performed.

## Offline verification

Ran with the repository's existing backend Python environment because the
`python` found on PATH had a broken standard-library installation:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p 'test_*.py' -v
```

**12 tests passed**, covering category selection, tag/identifier/coordinate
preservation, missing fields, absent-lighting semantics, unevaluated opening
status, duplicate type/ID detection, invalid/missing/outside coordinates,
relation geometry, empty results, bounded query construction, rejection of
partial/malformed responses, HTTP 429 retries, timeouts/network errors, raw
body preservation, long cooldown handling, and offline CLI success/failure files.
Network tests use mocks, not public API requests.

The live raw response was also reprocessed via `--input` with no network access.
Its quality summary reproduced the live summary exactly apart from source/run
metadata. All 1,451 exported `original_osm_element` records were compared with
the raw response and matched.

## Live extraction

The first sandboxed request failed with connection refusal. That failure is
retained in `outputs/20261008T133541_912814Z/run_status.json`.
An approved network-enabled rerun then **succeeded**:

* Live output: `outputs/20261008T133610_076939Z/`
* Offline reprocessing: `outputs/20261008T133655_697265Z/`
* OSM server base timestamp: `2026-10-08T13:33:00Z`
* Pilot extent: south 23.350, west 85.310, north 23.380, east 85.340.

| Category | OSM object count |
| --- | ---: |
| Roads and pedestrian ways | 1,394 |
| Ways with a `lit` tag | 37 |
| Mapped street lamps | 0 |
| Police stations | 6 |
| Hospitals | 36 |
| Pharmacies | 3 |
| Businesses with `opening_hours` | 12 |

There were **1,451 unique features**, **0 duplicate type/ID records**,
**13,820 coordinate points checked**, **0 globally invalid points**, and
**0 features without usable geometry**. There were 1,225 points outside the box,
consistent with the query returning complete crossing ways/relations; this
does not certify their positional accuracy.

Lighting-tag completeness was **2.65%**: 33 ways recorded `yes`, 4 recorded `no`,
and **1,357 had no `lit` tag and remain unknown**. There were 1,246 road ways
without a name. Missing `opening_hours` counts were 5/6 police records, 35/36
hospital records and 3/3 pharmacy records. Every selected business had the key
by query design; this is not evidence of complete business coverage or current
opening status.

Zero mapped lamps does not mean zero physical lamps. These checks establish
successful extraction and structural quality only, not field accuracy,
city-wide completeness, or suitability for safety decisions.
