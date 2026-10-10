# Phase 4B execution and validation — 8 October 2026

Boundary: south **23.335059**, west **85.308481**, north **23.380000**,
east **85.340000**. Derived from all three saved real route geometries, their
complete 100 m corridor union, a 50 m additional margin, and the original pilot
rectangle. The original snapshot and prior experiment outputs were preserved.

## Geometric validation before download

The plan was saved at `expanded_outputs/20261008T142703_316466Z/` before any
network attempt. Checks passed for all three centerlines, complete 100 m buffers,
the buffer-plus-margin union and previously uncovered areas. All three routes
have 100% geometric length/buffer-area coverage in the **proposed** extent.
This does not establish acquired OSM data coverage.

## Actual extraction attempts

* `expanded_outputs/20261008T142910_043027Z/`: one sandboxed attempt; connection
  refused. No response data acquired.
* `expanded_outputs/20261008T143507_387489Z/`: primary
  `https://overpass-api.de/api/interpreter`, approved network access, at most two
  attempts. Both returned OSM3S dispatcher-timeout error pages explicitly saying
  the server was too busy. Error bodies are retained separately.
* `expanded_outputs/20261008T145902_291462Z/`: one request to the documented
  public alternate `https://overpass.private.coffee/api/interpreter`. Returned
  an HTTP 500 Internal Server Error page, retained as `http_error_1.txt`.

Alternate-instance source:
https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances

**No successful expanded snapshot was obtained.** No responses were merged,
no records were invented, and no successful counts or completeness rates are
claimed. This is a failed acquisition, not a zero-feature result. No repeated
successful queries were sent. The Phase 4B script and validated plan remain
ready for a later run when a public instance is available.

The root report was regenerated offline from the latest failed run to add the
original baseline comparison and explicit failure evidence. Existing per-run
outputs were kept unchanged. Future runs save endpoint, query hash and attempt
limit in `request_provenance.json` before contacting the server.

## Offline tests

**8 new Phase 4B tests passed**:

* Saved real-route buffer/margin containment and preservation of the old bbox.
* Query construction contains no opening-hours filter.
* Businesses lacking or containing blank hours are retained; denominators differ
  correctly between key presence and nonblank values.
* Lighting/sidewalk explicit `no` is recorded, unknown fields remain missing, and
  invalid coordinates/null geometry are counted.
* Partial remarks and conflicting duplicate IDs are rejected; exact duplicate
  IDs are reported and counted once.
* Potential facility duplicates are flagged and retained with original metadata.
* Invalid margins are rejected.
* Future Phase 4B retries use a minimum 30 s cooldown on rate limits without
  Retry-After; the original transport's default behavior is preserved for old scripts.

**All 40 offline tests** in this folder passed, including the earlier extraction,
data analysis and route-clipping/buffer tests. No test contacts Overpass.

Checks against an actual expanded response (record counts, coordinates, tagging
rates, candidate duplicates, timestamp provenance) remain **unverified** until
a successful response is saved. Those checks are implemented and covered with
synthetic records. No backend/frontend/ML code, safety scoring, commit or push.
