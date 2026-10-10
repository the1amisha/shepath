# Phase 4B: offline Ranchi OSM extraction plan

Prepared 2026-10-09. Status: **source investigation complete; regional PBF download and extraction not started**. The existing Overpass pipelines, snapshots, manifests, reports and tests are preserved. No regional PBF was downloaded, no packages installed, and no route, backend, frontend or ML code changed.

## Recommended source and verified availability

Use **Geofabrik's Eastern Zone, India** extract. Its published boundary polygon geometrically contains the entire validated Ranchi pilot rectangle. This is a verified containment check, rather than an assumption based on the region's name. Geofabrik lists no smaller subregions on its Eastern Zone page; a Jharkhand-specific Geofabrik URL has not been verified. [Eastern Zone download page](https://download.geofabrik.de/asia/india/eastern-zone.html)

Metadata-only HTTP checks at **2026-10-09 12:52:50 UTC** returned:

| Source | Verified URL / redirect target | HTTP | Compressed bytes | Approximate size |
|---|---|---:|---:|---:|
| Recommended dated snapshot | https://download.geofabrik.de/asia/india/eastern-zone-261008.osm.pbf | 200 | 247,225,365 | 247 MB / 235.77 MiB |
| Eastern Zone latest alias | https://download.geofabrik.de/asia/india/eastern-zone-latest.osm.pbf → dated URL above | 200 | 247,225,365 | Same file |
| Older dated availability check | https://download.geofabrik.de/asia/india/eastern-zone-261006.osm.pbf | 200 | 247,199,715 | 247 MB |
| India-wide fallback | https://download.geofabrik.de/asia/india-latest.osm.pbf → https://download.geofabrik.de/asia/india-261008.osm.pbf | 200 | 1,709,675,201 | 1.710 GB / 1.592 GiB |

The recommended file advertises byte-range support and has Last-Modified `Thu, 08 Oct 2026 22:56:38 GMT`, ETag `"ebc5c15-65d5c24f1485f"`. These are HTTP metadata, **not an independently verified OSM database timestamp**. The provider's HTML page was older than the live HEAD response. Read the downloaded PBF header to establish its actual base timestamp before comparing snapshots. A successful HEAD verifies advertised availability and size, not integrity or readability of the full payload.

Evidence: [source_verification.json](pbf_source_checks/20261009T125250_765773Z/source_verification.json), [eastern-zone.poly](pbf_source_checks/20261009T125250_765773Z/eastern-zone.poly). Only the 19,514-byte polygon was downloaded. Its SHA-256 is `715684e1b2587d57b4e17154f3565066cf98cb5ea438cacae6bf2343e28c74d1`. The earlier restricted-network failure is retained separately in `pbf_source_checks/20261009T125232_041597Z/`.

## Fixed analysis boundary and coordinate conventions

Reuse `expanded_outputs/20261008T142703_316466Z/boundary_plan.json`, whose SHA-256 is `2355a8d987680815a074c53c0f0763e7eabdb33a4ed8280e7bd0b8c9fd5dda41`:

```text
south = 23.335059
west  = 85.308481
north = 23.380000
east  = 85.340000
```

The downloaded provider polygon passes Shapely `covers(box(west, south, east, north))`, including holes. Existing geometric validation in that boundary plan contains all three saved real walking routes and their complete 100-metre buffers; their recorded length and buffer coverage round to 100%. This is evidence about geographic extent, **not OSM feature completeness**. Recompute those checks from the saved routes as part of the eventual PBF run; do not call the routing service again.

Metadata bounding boxes use `[south, west, north, east]`. GeoJSON and geometric operations use `[longitude, latitude]`; saved backend routes use `[latitude, longitude]` and must be explicitly converted. Osmium CLI bbox order is `west,south,east,north`: `85.308481,23.335059,85.340000,23.380000`. Retain full geometries beyond the boundary where required to resolve selected features; keep the analysis rectangle unchanged.

## Windows feasibility and resources

Native Windows Python is feasible. The available project interpreter is Python **3.11.9 AMD64**. PyPI offers **osmium 4.3.1**, including `osmium-4.3.1-cp311-cp311-win_amd64.whl` (approximately 1.8 MB). The pip package is named `osmium`, although the Python bindings are commonly called PyOsmium. [Verified release and Windows wheel](https://pypi.org/project/osmium/), [official installation documentation](https://docs.osmcode.org/pyosmium/latest/)

Use a new environment within this directory; do not install into the backend environment. Installing the Python bindings does **not** provide the separate `osmium.exe` command-line program. No native CLI installation has been verified here; WSL is unnecessary for the recommended Python approach.

Measured during investigation: approximately **208 GiB free on D:**, **7.65 GiB physical RAM**, and **0.91 GiB RAM available**. Disk capacity is sufficient for an initial regional experiment. Close other applications before processing. Low available RAM makes an unbounded regional node cache unsuitable.

Planning estimates, not measurements of processing this PBF:

| Component | Reserve |
|---|---:|
| Regional PBF | 236 MiB; up to twice this if staging a replacement |
| Isolated Python environment | 100–300 MB |
| Disk-backed node/reference index | Initially budget 1–3 GB; measure and allow growth |
| Intermediate PBF, writer temporary files and validation outputs | Initially budget 0.5–2 GB |
| Pilot JSON/GeoJSON, reports and logs | Initially budget 10–100 MB; not a guaranteed upper bound |

Keep **5–10 GB free** for the experiment and monitor actual use; stop before exhausting disk. The compressed file size does not determine index size or peak memory. Target bounded SQLite batches/caches, avoid whole-region GeoDataFrames, and avoid dense indexes addressed by globally large OSM IDs. Runtime and peak RAM remain unbenchmarked. PyOsmium exposes available index types dynamically; do not assume a particular sparse disk index exists on Windows. [Index documentation](https://docs.osmcode.org/pyosmium/latest/reference/Indexes/)

## Proposed offline extraction design

This section specifies future implementation; **an offline PBF extraction script has not been implemented or run**.

1. **Download and provenance stage.** Following explicit approval of the size, download a fixed dated URL to a `.part` file in a new timestamped `pbf_sources/` folder. Stream to disk. Resume only if URL, ETag, Last-Modified and expected length still match; require a correct `206`/Content-Range for an append. A `200` response to a range request must never be appended. Do not resume a changing `latest` alias. Record URL, provider polygon/hash, HTTP metadata, retrieval time, expected/actual bytes and local SHA-256. A provider checksum may be used only after verifying its URL and its association with this exact dated file; no checksum URL was successfully verified in this investigation. Validate the complete PBF before promoting `.part` to the source filename.
2. **Coordinate index stage.** Stream regional nodes into a bounded, disk-backed SQLite table keyed by node ID, storing coordinates. Record relevant nodes within the closed rectangle. Keep the source PBF authoritative for all original tags and metadata. Never discard untagged nodes needed to build ways. Use bounded transactions and an explicit cache budget.
3. **Geometric way selection stage.** Stream ways, resolve every ordered node reference through the index, and test the actual full line against the closed rectangle. Select relevant intersecting ways, including a road whose endpoints and all vertices are outside but whose segment crosses the box. For polygonal facility/business ways, also test area intersection; a polygon enclosing the box must not be lost. Missing nodes are a geometry error, not permission to interpolate. Save complete original ways and all their referenced nodes, rather than clipping their original geometry.
4. **Relations and reference closure stage.** Collect candidate facility/business multipolygons and resolve their member geometries, including enclosing polygons and holes. PyOsmium area assembly can help, but arbitrary non-area relations require explicit handling. Walk required member references with a documented depth limit and report unresolved members/cycles. Include complete member ways and nodes for selected relations. If closure cannot be completed from the regional source, report an incomplete geometry and do not claim full feature extraction. Preserve original relation IDs and roles. Derived area IDs must not become additional OSM features. [Geometry and area handling](https://docs.osmcode.org/pyosmium/latest/user_manual/03-Working-with-Geometries/)
5. **Output stage.** Write a small reference-complete pilot PBF and a processed feature GeoJSON/JSON. A PyOsmium `BackReferenceWriter` can recover referenced objects from the source; explicitly use **`remove_tags=False`** because its default removes tags from supporting objects. Set relation depth deliberately and validate closure afterward. Keep the wanted-ID index disk-backed where possible and monitor writer memory. [Reference writer API](https://docs.osmcode.org/pyosmium/latest/reference/Data-Writers/)
6. **Report stage.** Record each stage as pending/successful/failed with input hashes, tool versions, parameters and output hashes. Resume only completed stages whose inputs still match. Publish partial artifacts separately if any required stage or reference check fails. No failed run may be labeled a complete inventory.

A simpler node-in-box filter followed by complete-way expansion can miss crossing segments without an interior node. The documented node/reference recipe is therefore useful for reference recovery, but insufficient by itself for this experiment's strict geometry selection. [PyOsmium geometry-filter recipe](https://docs.osmcode.org/pyosmium/latest/cookbooks/Filter-Data-By-Geometry/)

Keep **analysis features** separate from **geometry-support objects** outside the box. Supporting nodes and relation members must retain IDs/tags but must not inflate in-boundary facility or business counts. Deduplicate by `(OSM element type, OSM ID)`, never by ID alone or name alone. Do not union conflicting versions/tags into an invented record; retain conflict evidence and fail or choose an explicitly documented source version.

## Feature selection and preserved attributes

Reuse and record the existing category definitions from `resumable_osm.py` when implementing the PBF classifier. Include roads/pedestrian ways (`highway`), mapped street lamps, recorded lighting on infrastructure, police, hospitals/healthcare, pharmacies, and shops/relevant businesses. Select commercial features **without requiring `opening_hours`**. Document business-tag scope explicitly; do not claim every business is necessarily tagged `shop`.

Retain all available tags, including `highway`, `foot`, `access`, `surface`, `smoothness`, `crossing`, `kerb`, pedestrian infrastructure, `lit`, `sidewalk` and directional variants, `amenity`, `healthcare`, `shop`, `office`, name/address and `opening_hours`. Keep original IDs, ordered node references, relation members, coordinates, versions and edit timestamps where the public source supplies them. Preserve raw PBF plus source provenance. Geofabrik public downloads omit usernames, user IDs and changeset IDs for privacy; do not promise these absent fields. [Geofabrik public metadata policy](https://download.geofabrik.de/asia/india.html)

Category counts may overlap; report the unique inventory separately from memberships, with node/way/relation breakdowns. A pharmacy may belong to multiple classifications. Equivalent node and polygon facilities are potential semantic duplicates, not identical OSM records.

## Offline validation plan

Build small synthetic XML/PBF fixtures before processing the downloaded regional file. Required cases:

- Inside, outside, boundary-following and crossing ways; explicitly test crossing with **no interior vertex** and complete retention of exterior nodes.
- Multipolygon enclosing the box, a hole excluding the box, missing member nodes, nested relations, cycles and configured depth exhaustion.
- Same numeric ID for a node and way, repeated identical records, conflicting versions, node/polygon representations of one facility, and geometry-support objects excluded from feature totals.
- Preservation of full tags, original IDs and relation roles; longitude/latitude ordering; invalid coordinates, degenerate geometries and missing references.
- Shops without opening hours; missing `lit`/sidewalk remain unknown; explicit `lit=no`, `lit=yes` and other recorded values remain distinct.
- Truncated PBF, incorrect download size/hash, interrupted stage, changed input hash, invalid range resume and partial outputs never marked complete.

Validate actual outputs for unique typed IDs; valid finite geographic coordinates; reference closure; usable geometries; counts by category/type; lighting and sidewalk completeness on relevant ways; opening-hours completeness on commercial records; potential facility duplicates; source/timestamp/hash provenance; and all three saved route lengths and 100 m buffers against the requested extent. Define denominators explicitly. Compare typed-ID intersections with the original snapshot, distinguishing changes in boundary, selection and snapshot date. Raw tags and missing values must remain inspectable.

**Checks performed now:** live metadata availability, full provider-polygon containment of the saved bbox, matching saved bbox metadata/hash, interpreter architecture and Windows-wheel availability, disk/RAM feasibility investigation. Offline checks passed for helper compilation, synthetic polygon containment, hole exclusion, outside-boundary exclusion, saved bbox agreement and the evidence flag confirming no PBF download. A filesystem check found no `.pbf` files under this directory. No PBF parsing, reference closure, category counts, full extraction tests or runtime benchmarks have been performed. Those remain prerequisites for calling a future offline extraction successful.

## Commands and approval boundary

Run from `D:\shepath`. This existing new helper performs HEAD requests and downloads only the small provider polygon, saving timestamped evidence:

```powershell
.\backend\.venv\Scripts\python.exe data\ranchi_safety\verify_pbf_source.py
```

Proposed preparation commands, **not executed in this investigation**, with all writes inside the data folder:

```powershell
.\backend\.venv\Scripts\python.exe -m venv data\ranchi_safety\.pbf_venv
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe -m pip install --only-binary=:all: osmium==4.3.1 shapely==2.1.2 pyproj==3.7.2
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe -m pip freeze | Set-Content data\ranchi_safety\pbf_requirements.lock.txt
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe -c "import osmium; print(osmium.index.map_types())"
```

**Before a regional download:** disclose the current size again, request approval, recheck dated URL metadata, and create a new source folder. The following initial-download command is an example **for after approval**, not permission to run it now. It intentionally does not append/resume an unchecked partial file:

```powershell
New-Item -ItemType Directory -Path data\ranchi_safety\pbf_sources\eastern_261008 -ErrorAction Stop
curl.exe --fail --location --connect-timeout 30 --output data\ranchi_safety\pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf.part https://download.geofabrik.de/asia/india/eastern-zone-261008.osm.pbf
Get-Item data\ranchi_safety\pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf.part | Select-Object Length
Get-FileHash data\ranchi_safety\pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf.part -Algorithm SHA256
```

The metadata-only helper preserves timestamps automatically; the future downloader must do so too. Integrity checks and full parser validation must precede promotion of the partial file. The old dated snapshot may eventually expire; if absent, verify the replacement URL and size rather than guessing a date.

If the separate Osmium CLI is already installed, its documented baseline command is:

```powershell
osmium extract --bbox 85.308481,23.335059,85.340000,23.380000 --strategy complete_ways --output data\ranchi_safety\ranchi_complete_ways_baseline.osm.pbf data\ranchi_safety\pbf_sources\eastern_261008\eastern-zone-261008.osm.pbf
```

This is an **optional baseline only**, not the final geometry-aware filter: `complete_ways` completes ways selected through interior nodes and does not guarantee arbitrary relation completeness or every crossing segment. Do not overwrite an existing output. [Osmium extract documentation](https://docs.osmcode.org/osmium/latest/osmium-extract.html)

No command for a full Python extraction is supplied as runnable because that script does not yet exist. Its implementation should follow the staged design and offline tests above. This plan does not launch the full extraction.

## Reliability and limits

Provider coverage and successful local parsing cannot establish that all real streets, lamps, businesses or facilities are mapped. Absent lighting/sidewalk tags mean unknown mapping status; absent facilities do not establish real-world absence or unsafe conditions. An `opening_hours` tag requires separate syntax/time-zone evaluation and still cannot establish current operation by itself. No safety score is proposed.

The region and the original Overpass data are different snapshots. Counts can change through geography, query selection, editing or provider processing; comparisons must disclose all four. The pilot rectangle remains a small Ranchi experiment, not an entire-city inventory. Regional reference gaps and unresolved relation geometries must remain visible in the report.

Attribute derived data to **© OpenStreetMap contributors**, identify Geofabrik as the download provider, retain source/date information, and comply with ODbL requirements for any shared derived database. [OpenStreetMap attribution and license](https://www.openstreetmap.org/copyright)
