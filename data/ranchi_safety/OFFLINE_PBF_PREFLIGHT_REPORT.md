# First regional offline extraction: preparation checks

Checked 2026-10-09. **The file and extractor checks pass. Free additional RAM before launching the full extraction.** No full regional extraction was started, and its intended output directory remains absent.

## Local source verification

Source: `D:\shepath\data\ranchi_safety\pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf`.

| Check | Actual result |
|---|---|
| File exists | Yes |
| Size | 247,225,365 bytes; matches expected |
| Recomputed MD5 | `13f2313594d4ebca894a0447c1121854` |
| User-supplied publisher MD5 | Matches recomputed MD5 |
| Local downloaded `.md5` sidecar | Matches recomputed MD5 |
| Recomputed SHA-256 | `2d712eaa733a6e0df8a290350d7e9bae90e9e5299e1f54c398741e417786a2a4` |
| PBF container framing | Valid block headers/lengths; no detected truncation |
| Full semantic parsing/reference resolution | Not performed on the regional file at this stage |

The publisher checksum comparison uses the supplied verified value and local downloaded checksum; no new network request was made. MD5 confirms consistency with that checksum. The SHA-256 is recorded to pin the exact input for extraction.

Evidence: [checks.json](preflight_runs/20261009T135106_669993Z/checks.json). Reproduce the local read-only checks with:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\preflight_offline_pbf.py
```

## Resource check

- Free disk: **222,742,138,880 bytes**, approximately **207.44 GiB**. This exceeds the initial 10–20 GB working-space budget.
- Total physical RAM: approximately **7.65 GiB**.
- Available physical RAM at the check: **568,016,896 bytes**, approximately **0.53 GiB**. This is below the recommended roughly 2 GB available RAM.

Close memory-heavy applications and rerun the preflight check before starting. The extractor's 64 MiB SQLite cache is not its total process memory. Native PBF buffers, geometry objects and Python also consume memory. Regional peak RAM, index size and runtime remain unmeasured; disk availability alone does not establish readiness to run comfortably.

## Git exclusions and secrets

Updated only `data/ranchi_safety/.gitignore`. Rules exclude PBFs and downloaded checksum sidecars, local environments, Python caches, `.env` variants within this folder, SQLite/database files and journals, partial/temporary/lock files, temporary test work, and large generated feature/record payloads. Existing files remain on disk.

`git check-ignore -v` confirmed exclusions for the real PBF/checksum, processing environment, representative database/temporary/output paths, and `backend/.env` (already covered by `backend/.gitignore`). Source scripts, tests, README/report Markdown and run manifests remain eligible for version control. No broad ignore of all JSON or of entire extraction-run directories was added.

The current Git index contains **14 files**. **No files are staged**, no `.env` paths are indexed, and no known local backend secret values or matching credential literals were found in indexed content. Secret values were never printed or saved to the report. This check covers the current index, including staged blobs, using exact local-value comparisons and limited patterns; it is not a historical or universal secret audit. Existing tracked files have no working-tree changes.

## Tests and bounded smoke-test limitation

Reran all existing offline test suites using the isolated environment:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\run_offline_pbf_tests.py
```

**82 tests passed in 14.7202512 seconds; 0 failures, 0 errors, 0 skipped.** This includes the 29 extractor tests and 53 existing pipeline tests. See [summary.json](offline_validation_runs/20261009T135107_929986Z/summary.json) and [tests.log](offline_validation_runs/20261009T135107_929986Z/tests.log). The runner's example is explicitly synthetic. Its `regional_pbf_downloaded=false` field means the test runner did not download regional data, not that the separately downloaded local source is absent.

The extractor CLI was inspected with `--help`. It accepts input/output, source URL, expected SHA-256, resume, cache size, maximum depth and maximum per-feature members. **It has no record-limited or time-limited regional smoke mode.** The member/depth limits apply to geometry resolution, not total source scanning. Its internal `stop_after="index"` still indexes the full source. Consequently no real extraction smoke test was launched. Hashing and the container-framing check above are file-integrity checks, not an extraction smoke test.

The intended full-run directory `data/ranchi_safety/offline_runs/eastern_261008_ranchi_v1` does not exist, so this command will create a fresh run rather than overwrite a prior result. The extractor source hash still matches the preceding tested implementation: `2f69b9717493e16025af789343981bd9020c26dc00cf8c5d15ac25873732cfc7`.

## Launch command

After freeing sufficient RAM, run this exact command from `D:\shepath` when ready to begin the full extraction:

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\offline_pbf_extract.py --input data\ranchi_safety\pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf --output data\ranchi_safety\offline_runs\eastern_261008_ranchi_v1 --source-url https://download.geofabrik.de/asia/india/eastern-zone-261008.osm.pbf --expected-sha256 2d712eaa733a6e0df8a290350d7e9bae90e9e5299e1f54c398741e417786a2a4 --cache-mb 64
```

The source URL is provenance only; the extractor reads the local PBF and makes no network calls. Add `--resume` to the same command only when resuming its existing run. An interrupted index is rebuilt; completed stages can be reused. A hard-killed process can leave a lock requiring verification that it stopped before manual lock removal.

Remaining data risks: unresolved/missing references, unsupported nested multipolygons or unusual roles, and geometry limits may produce a partial result. Such failures remain explicit. Complete geographic extent and successful processing cannot establish complete real-world OSM mapping, lighting or opening-hours information.

No backend, frontend, routing, ML, API-key or existing validated-data files were modified. No commit or push was performed.
