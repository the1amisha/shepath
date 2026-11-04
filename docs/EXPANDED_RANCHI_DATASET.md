# Hatia–Mahilong evidence dataset

Dynamic route evidence can opt into the expanded local extraction. The default remains
`original`; the saved Ranchi comparison remains a historical comparison. No extraction
files are downloaded automatically, and missing expanded files do not fall back to the
original dataset. Restart the backend after changing the setting: a worker loads once.

The candidate bounding box is south 23.23, west 85.25, north 23.43, east 85.50.
Every route and its full 100 m analysis buffer must still fit inside this boundary.
A place name or endpoint inside the box alone does not establish route coverage.

## Required local files

Preserve the original extraction. Keep these expanded files under `data/ranchi_safety/`:

- `hatia_mahilong_boundary.json` (the original extraction input, unchanged).
- `offline_runs/eastern_261008_hatia_mahilong_v1/manifest.json`.
- The `attempt_20261030T122135_899988Z` folder inside that run, including all six
  artifacts listed in the manifest. Preserve their bytes and relative paths.

Pinned manifest SHA-256:
`62d15935cb85221b1cd20f5cd6a6e9c1f21d739b54b9ba1a70bd3aa569c50295`.
Source PBF SHA-256:
`2d712eaa733a6e0df8a290350d7e9bae90e9e5299e1f54c398741e417786a2a4`.
Snapshot: `2026-10-08T20:21:06Z`, OpenStreetMap contributors, ODbL 1.0.

The user's local post-extraction verification reported `passed` on 30 October 2026:
6 artifact hashes, 264,546 PBF records, 23,719 features and 240,827 supporting objects.
This checks extraction integrity and the original three routes; it does not validate
new routed journeys in Hatia or Mahilong. Lighting and sidewalk tags are largely
missing. Missing tags do not establish missing street features or unsafe conditions.

## Activate and check on Windows CMD

Stop the backend with Ctrl+C. In its terminal, from `D:\shepath`:

```bat
set SHEPATH_EVIDENCE_DATASET=hatia-mahilong
backend\.venv-demo\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8011 --workers 1 --limit-concurrency 32 --lifespan on
```

Use the existing working backend interpreter and geographic dependencies. This setting
belongs in the backend terminal, not the frontend terminal. It lasts for that terminal;
set it again in a new terminal. Do not change the generated manifest or boundary JSON.

Refresh the app and request new routes (do not use Saved Ranchi Pilot Comparison):

1. A short public-landmark journey in Hatia.
2. A short journey to the correct Sarala Birla University campus entrance at Ara/Mahilong.
3. A route between Hatia and the college, subject to the routing provider's walking limits.

Inspect the returned map geometry and the evidence verification panel. Confirm the
manifest hash above and full-buffer coverage. Confirm out-of-boundary routes still show
evidence unavailable. Keep unknown data visible; an available response is not a safety
assessment. New-route correctness and load/analysis performance require local testing
with the expanded exports; they are not established by synthetic unit tests.

To return to the original dataset, stop the backend, run
`set SHEPATH_EVIDENCE_DATASET=original`, and restart it. Both datasets remain intact.
