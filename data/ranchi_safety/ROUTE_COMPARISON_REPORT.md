# Phase 5B — Evidence-aware route comparison

**The dataset supports preference-based comparisons of measured distance and mapped context. It cannot support a credible personal-safety recommendation.** Results below describe fit to explicit preferences, not a safety score, operating status or facility accessibility.

## Method and normalization

Distance is measured geodesically from the saved route polylines. Context counts are normalized to OSM records per geodesic route kilometre; raw counts remain visible. Preference comparisons use route-length proximity percentages rather than raw counts, so a longer route does not gain preference merely from a larger corridor. Coverage percentages retain their projected-route-length denominators from Phase 5A. Longer or differently shaped routes still sample different areas; normalization does not remove mapping-density bias.

Ordered preferences compare the first group with unequal measurements. A group must show robust dominance across duplicate scenarios: no worse on every selected dimension and strictly better on at least one. Exact equality proceeds to the next priority. Missing values or a support trade-off stop the comparison as incomparable; later preferences do not manufacture a tie-break. A separate Pareto profile shows trade-offs across all dimensions. Routes within a preference front are ID-sorted only for reproducibility, not ranked against one another. No features are summed into a score.

Mapped support contains business, healthcare and police proximity as separate dimensions. Counts/density and hospital/pharmacy subtype coverage are descriptive, preventing correlated measures from receiving additive credit. Shared OSM IDs are audited. With only three routes, no statistical correlation estimate or learned weighting is justified.

## Transparent measurement comparison

| Dimension | Route 1 | Route 2 | Route 3 | Measured preference leader |
|---|---:|---:|---:|---|
| Geodesic walking polyline distance (m), lower preferred | 5336.8 | 5245.3 | 6596.8 | 2 |
| shops_and_businesses — raw records | 19 | 54 | 23 | Descriptive only |
| shops_and_businesses — records/km | 3.56 | 10.295 | 3.487 | Descriptive only |
| shops_and_businesses — route proximity (%) | 17.143 | 50.205 | 18.439 | 2 |
| healthcare_facilities — raw records | 4 | 9 | 6 | Descriptive only |
| healthcare_facilities — records/km | 0.75 | 1.716 | 0.91 | Descriptive only |
| healthcare_facilities — route proximity (%) | 5.981 | 18.618 | 9.831 | 2 |
| police_stations — raw records | 0 | 1 | 0 | Descriptive only |
| police_stations — records/km | 0.0 | 0.191 | 0.0 | Descriptive only |
| police_stations — route proximity (%) | 0.0 | 2.673 | 0.0 | 2 |
| pedestrian_infrastructure — raw records | 11 | 11 | 16 | Descriptive only |
| pedestrian_infrastructure — records/km | 2.061 | 2.097 | 2.425 | Descriptive only |
| pedestrian_infrastructure — route proximity (%) | 21.736 | 18.707 | 29.396 | 3 |
| roads_and_pedestrian_ways — raw records | 219 | 239 | 306 | Descriptive only |
| roads_and_pedestrian_ways — records/km | 41.036 | 45.565 | 46.386 | Descriptive only |
| roads_and_pedestrian_ways — route proximity (%) | 100.0 | 100.0 | 100.0 | Descriptive only |
| hospitals — raw records | 1 | 2 | 1 | Descriptive only |
| hospitals — records/km | 0.187 | 0.381 | 0.152 | Descriptive only |
| hospitals — route proximity (%) | 4.156 | 7.66 | 3.362 | Descriptive only |
| pharmacies — raw records | 1 | 3 | 1 | Descriptive only |
| pharmacies — records/km | 0.187 | 0.572 | 0.152 | Descriptive only |
| pharmacies — route proximity (%) | 1.594 | 8.496 | 1.29 | Descriptive only |

## User-selectable preference results

- **distance_first** (shorter_distance, mapped_support, pedestrian_infrastructure): preference fronts {2} → {1} → {3}.
- **pedestrian_first** (pedestrian_infrastructure, shorter_distance, mapped_support): preference fronts {3} → {1} → {2}.
- **support_first** (mapped_support, shorter_distance, pedestrian_infrastructure): preference fronts {2} → {3} → {1}.
- **pareto_tradeoffs** (shorter_distance, mapped_support, pedestrian_infrastructure): preference fronts {1, 2, 3}.
- **custom** (pedestrian_infrastructure, shorter_distance, mapped_support): preference fronts {3} → {1} → {2}.

Route 2 is 91.5 m shorter than Route 1 and leads the measured business, healthcare and police proximity dimensions. Route 3 leads pedestrian-infrastructure proximity but is 1351.6 m longer than Route 2. Route 1 has greater pedestrian-infrastructure proximity than Route 2 with a smaller distance increase than Route 3. All three remain nondominated when distance, support and infrastructure are considered together. These statements apply to this snapshot and these preferences only.

Every pairwise result includes the deciding priority, measurement/scenario values and an explanation in `comparison.json`. Custom priority order can change the result. A single first-front candidate is a preference match to mapped measurements, never a verified safest route.

## Duplicate and correlated-feature uncertainty

- heigit-foot-walking-route-1: raw businesses 19; conditional count 19–19; density 3.560–3.560/km; business proximity 17.1433–17.1433%.
- heigit-foot-walking-route-2: raw businesses 54; conditional count 53–54; density 10.104–10.295/km; business proximity 50.2051–50.2051%.
- heigit-foot-walking-route-3: raw businesses 23; conditional count 23–23; density 3.487–3.487/km; business proximity 18.4387–18.4387%.

The four Phase 5A ambiguous pairs remain unmerged. Only the overlapping fuel-station pair affects count sensitivity in these route corridors: Route 2 has 54 records or 53 if the two records represent one entity. The coverage scenarios retain both geometries or either original geometry, rather than invent a replacement footprint. Business-proximity coverage and current preference outcomes remain unchanged under these scenarios; undetected duplicates and incorrect geometries remain possible. The bakery pair, bank administration-office pair and conflicting hospital/pharmacy pair remain documented in the input duplicate review.

Category coverage is not additive: a pharmacy can appear in both business and healthcare evidence, and nearby areas can overlap even without shared IDs. The JSON provides shared-ID lists. No inference about independent opportunities, service capacity or statistical independence is made.

## Data availability — excluded from preference ordering

| Evidence | Route 1 | Route 2 | Route 3 |
|---|---|---|---|
| Usable lighting tags / nearby roads | 7/219 | 7/239 | 12/306 |
| Usable sidewalk-family tags / nearby roads | 7/219 | 7/239 | 11/306 |
| Nonblank opening hours / businesses | 1/19 | 0/54 | 1/23 |

Unknown lighting/sidewalk data is never converted to a negative value or used to order routes. Explicit lit=no remains a recorded tag, not a safety label. Opening-hours strings do not establish current opening, and null missing observations are never substituted with zero. Zero police proximity means no police geometry in that corridor in this snapshot, not verified physical absence. Source integrity and complete geographic buffers do not establish real-world mapping completeness.

## Evidence still needed

- Validated route-to-road matching and pedestrian access/topology before assigning street lighting, sidewalk continuity or crossing conditions to the walked street.
- Current field validation of lighting condition, time-of-day pedestrian activity, facility entrances/accessibility and business operation; resolve ambiguous facility identities.
- Representative, ethically collected and independently validated evidence about relevant real-world outcomes, exposure and temporal conditions before any personal-safety claim. Three routes and mapped proximity alone cannot establish such relationships.
- Evaluation with intended users, uncertainty communication and appropriate expert review before operational safety-related recommendations. No model or training labels are produced here.

## Validation results

**132 offline tests passed in 25.7229 seconds: 0 failures, 0 errors, 0 skipped.** This comprises 20 new comparison tests and all 112 existing tests. Evidence: [test summary](offline_validation_runs/20261010T060454_956030Z/summary.json) and [full test log](offline_validation_runs/20261010T060454_956030Z/tests.log).

New tests cover priority changes, secondary priorities after equality, unresolved support trade-offs, ties, missing observations, excluded lighting/sidewalk missingness, duplicate interval dominance and overlap, count/coverage correlation handling, connected duplicate components, scenario bounds, normalization, input-order independence, invalid values, artifact tampering and deterministic reproduction using the three real routes. The real-data test forbids network connections. Existing test-console API errors are mocked cases, not live requests.

The [structured comparison](route_comparison_runs/20261010T060453_649409Z/comparison.json) retains Phase 5A input checksums, OSM identifiers, source provenance, denominators, duplicate scenarios and pairwise explanations. Snapshot timestamp: 2026-10-08T20:21:06Z. Pedestrian-infrastructure proximity includes the original OSM category scope (such as paths, crossings and barrier/kerb/sidewalk tags); it does not establish continuous, accessible pedestrian provision along the walked street.

No existing source dataset, backend, frontend or ML behavior changed. No network request, extraction, training, commit or push was performed.

## Reproduce offline

Structured output: `route_comparison_runs/20261010T060453_649409Z/comparison.json`. Input snapshot: `route_feature_runs/20261009T170001_897709Z`.

```powershell
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\compare_routes.py
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe data\ranchi_safety\compare_routes.py --priorities pedestrian_infrastructure shorter_distance mapped_support
.\data\ranchi_safety\.pbf_venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p test_route_comparison.py -v
```

Default runs include all three priority profiles and the all-dimensions Pareto profile. `--priorities` adds a custom profile; any distinct subset/order is allowed. `--input-run` selects a verified Phase 5A bundle and `--output` selects a new folder inside data/ranchi_safety. Existing outputs are never overwritten. Canonical results have no clock timestamp; the run manifest records time and hashes separately. Input hashes, tool versions and code hashes make results reproducible. © OpenStreetMap contributors; ODbL 1.0; provider Geofabrik.
