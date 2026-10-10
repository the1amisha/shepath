# SHEPATH Git preparation audit — 2026-10-10

Only ignore rules, research byte-preservation attributes and this report were changed during this audit. No existing files were deleted, no algorithms/results/contracts were edited, and nothing was staged, committed or pushed.

## Proposed repository contents

Keep backend integration, API documentation/tests; every research source script/test, requirements/lock file, methodology and limitations report; original successful extraction metadata and raw snapshot; the three saved real routes and original coverage evidence; the validated expanded boundary; one representative failed Overpass request plus the tiled failure manifest; verified Geofabrik source/preflight evidence; canonical post-extraction measurements; and the canonical Phase 5A/5B bundles. Historical test summaries/logs remain as evidence, while their synthetic generated datasets are ignored.

The full prospective repository is approximately 12.2 MiB (123 files including this report). The largest intentional retained file is the verified pilot `objects.jsonl`, 5,495,869 bytes. Its supporting GeoJSON is 1,915,529 bytes; the original raw OSM snapshot is 1,437,555 bytes. These are bounded evidence/test inputs, not repeated regional inventories. No prospective file exceeds 10 MiB.

The verified pilot subset is a deliberate exception to general generated-data ignores: retain its manifest and all six hash-verified artifacts, including the 187,941-byte `pilot.osm.pbf`. They permit Phase 5A regeneration, geometry/reference audits and the existing integration tests without the regional download or index. The original raw snapshot is also required by coverage regression tests.

## Exact comparison endpoint dependencies

The current `backend/app/pilot_ranchi.py` reads these ten files, all retained byte-for-byte:

- `data/ranchi_safety/route_comparison_runs/20261010T060453_649409Z/run_manifest.json`
- `data/ranchi_safety/route_comparison_runs/20261010T060453_649409Z/comparison.json`
- `data/ranchi_safety/route_feature_runs/20261009T170001_897709Z/run_manifest.json`
- In that feature directory: `route_features.json`, `feature_evidence.json`, `duplicate_review.json`, `heigit-foot-walking-route-1.json`, `heigit-foot-walking-route-2.json`, `heigit-foot-walking-route-3.json`
- `data/ranchi_safety/route_coverage_runs/20261008T140112_006152Z/routes.json`

The endpoint verifies the comparison trust anchor, embedded feature manifest, every feature artifact hash, saved-route hash and journey/route consistency. It does not need the regional PBF, SQLite index, extraction virtual environment or API key. Missing/corrupt dependencies still produce the existing explicit unavailable response.

`core.autocrlf=true` was detected. The new data-directory `.gitattributes` sets `* -text` to preserve exact bytes across checkouts, including artifact, boundary, source-code and report fingerprints. Editing these historical files can invalidate provenance; regenerate a new versioned experiment instead. Existing bytes were not rewritten.

## Ignored, preserved locally

Ignore the 247,225,365-byte downloaded Eastern Zone PBF and publisher checksum sidecars, approximately 11.7 GB SQLite index, other databases/sidecars, local environments, Python caches, secrets (`.env` and variants), temporary work, repeated extraction/coverage/preflight/verification runs, synthetic test outputs, tiled partial merges and future generated runs. Explicit allowlists keep the selected historical evidence. These files remain on disk; `.gitignore` is not a backup policy. Archive regional inputs separately if exact full-extraction reproduction is required later.

The full regional verification command still requires its separately downloaded original PBF; it is intentionally not a fresh-clone dependency. Reproducing the initial historical Overpass analysis uses the retained raw response, not another network request. OSM attribution/license and Geofabrik provenance remain in the existing reports/manifests.

## Validation and fresh-clone assessment

The complete initial and revised `git add -n -A` outputs were inspected. Read-only inventory and size checks covered both indexed files and all nonignored untracked candidates. The Git index SHA-256 remained `6acce4b571cf87c406136bfdbbe9f8e75b51e8faedc7db8b3c6e086106180472`; staging is empty.

Credential checks found no exact local secret values in prospective files and no exposed obvious credentials. The only generic private-key-marker match was the scanner's own detection string in `preflight_offline_pbf.py`, not a private key. Local `.env`, virtual environments, regional PBF/checksum and index are ignored. This targeted scan is not a complete historical secret audit.

Working repository: 25 backend tests passed (4.721 s); 132 offline research tests passed (21.475 s). A copy containing only prospective Git files, without local secrets/environments/regional source/index, passed all 25 backend tests (4.130 s) and all 132 research tests (20.796 s). An initial copied-data research run exposed three missing-original-snapshot errors; the ignore exception was corrected before the successful rerun. Test execution used existing external local environments, equivalent to installing the documented requirements after cloning; this is a prospective-tree simulation, not an actual commit/clone.

After installing `backend/requirements.txt`, the saved Ranchi comparison API works from the proposed repository files without a provider key. Follow `backend/docs/RANCHI_COMPARISON_API.md` for local startup/testing. Live `/route` still needs separately configured provider credentials. The endpoint remains applicable only to the fixed saved journey and three route IDs.

No network requests or extraction reruns were performed. Offline test messages mentioning request failures/cooldowns are mocked test cases. Approval is still required before staging or committing.
