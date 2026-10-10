# Ranchi OSM data coverage and usability report

Analysis date: 8 October 2026. This report analyzes the downloaded pilot snapshot
only. No Overpass, routing, geocoding or other network request was made.

## Findings and decision

The extraction contains **1,451 unique OSM objects**: 41 nodes,
1,410 ways and 0 relations. **1,394** of those ways are
highway-tagged objects; the remaining **16** ways represent facilities/businesses.
Road geometry and highway classes can support an initial descriptive comparison
once route matching and corridor coverage are verified. Police and healthcare
records can support provisional mapped-landmark context after manual review.
Lighting, street lamps and business schedules are insufficient for broad claims
about route illumination, activity, opening status or safety.

**Albert Ekka Chowk–Doranda route coverage could not be verified.** No saved
route polyline or authoritative endpoint coordinates were found in the available
project files. The current bbox must not be treated as adequate for that route.

## Source, extent and reproducibility

Input: `outputs/20261008T133610_076939Z/raw_response.json`, corroborated against its
`features.geojson`, `quality_summary.json`, `run_status.json` and exact saved
`query.overpassql`. The offline reprocessing folder is the same extraction, not
an independent sample; neither it nor the HTTP-response copy is counted again.
The failed network run contributes no data.

OSM server base timestamp: **2026-10-08T13:33:00Z**. Raw response SHA-256:
`010156f527f69ca1fee7897349459bc878d9bfd27e7c8a43361ab6dd1cbe1d11`. Original tags, coordinates and OSM type/ID remain unchanged.

Bounding box (south, west, north, east): **23.35, 85.31, 23.38, 85.34**,
WGS84. Approximate dimensions: 3.3 km north–south by 3.0 km east–west, about
10 km². This is a central Ranchi rectangle, not the city or a statistical sample.
The southern cutoff is 23.350°N. Crossing-way geometry outside the box is incidental
and does not establish systematic coverage of an onward corridor to Doranda.
The query selects objects through nodes in the box and retains whole geometry;
enclosing features without a node inside may be missed. No clipping was applied.

Rebuild both requested artifacts entirely offline from the repository root:

```powershell
.\backend\.venv\Scripts\python.exe data/ranchi_safety/analyze_coverage.py
```

`data_coverage_summary.csv` is a long-form table: one row per category/attribute,
with object counts, OSM types, denominators, missing counts/percentages, usability
and source metadata. Repeated category counts across attribute rows are not additive.

## Category counts and overlap

| Category | Unique objects | Nodes | Ways | Relations |
| --- | --- | --- | --- | --- |
| Roads / pedestrian ways | 1394 | 0 | 1394 | 0 |
| Ways with lit=* | 37 | 0 | 37 | 0 |
| Mapped street lamps | 0 | 0 | 0 | 0 |
| Police stations | 6 | 3 | 3 | 0 |
| Hospitals (tagged, not verified) | 36 | 29 | 7 | 0 |
| Pharmacies | 3 | 3 | 0 | 0 |
| Shops / businesses (including retail pharmacies) | 15 | 9 | 6 | 0 |
| Businesses with opening_hours | 12 | 6 | 6 | 0 |

Counts use unique `(OSM type, ID)` keys. A way and a node with the same numeric
ID are different objects. An element matching both amenity and healthcare selectors
is counted once in its category. Category rows deliberately overlap: lit ways
are a subset of road ways, businesses-with-hours are a subset of businesses, and
the three pharmacies also belong to the retail/business category. There are
1503 category memberships but only 1,451 unique
objects; **52 objects** have multiple
memberships. Deduplicating the union recovers exactly the input objects.

For the requested broad retail/business count, this analysis includes the original
commercial taxonomy plus retail pharmacies: **15 objects**, including **12 with
opening_hours**. The original extractor's narrower commercial category has **12**
objects, all with hours. Police/hospitals are not assumed to be businesses.
This is an operational tag grouping, not verification that every object is an
active commercial establishment. Business-type breakdown: {'amenity=pharmacy': 3, 'shop=clothes': 2, 'amenity=bank': 2, 'office=educational_institution': 1, 'shop=supermarket': 1, 'amenity=restaurant': 2, 'amenity=bar': 1, 'amenity=pub': 1, 'shop=mall': 2}.

**Selection bias:** shops, offices, crafts and the listed commercial amenities
were queried only with an `opening_hours` key. The three pharmacies entered via
the separate pharmacy selector. General businesses without hours were not
systematically downloaded. Thus 12/15 (80%) with hours describes this selected
sample only; neither 80% nor the narrower 100% is pilot-wide tagging completeness.
Total businesses in the box and their hours completeness **cannot be estimated**
from this extraction. Healthcare/police coverage is also not a field-verified census.

## Missing fields and relevant denominators

Missing means absent key or blank/whitespace value. Percentages use the unique
object count of the named category, not the whole city or the whole extraction.
Zero-size categories yield **N/A**, not 0% completeness. Geometry missing means
no usable geometry by the extractor's structural checks. A filled name or address
does not prove correctness; any address component is a weaker condition than a
complete address. `phone_any` accepts phone/contact:phone/contact:mobile;
`check_date_any` accepts check_date or check_date:opening_hours.

| Category | Attribute | Missing / denominator | Missing % |
| --- | --- | --- | --- |
| Roads / pedestrian ways | name | 1246 / 1394 | 89.38% |
| Roads / pedestrian ways | usable_geometry | 0 / 1394 | 0.00% |
| Ways with lit=* | name | 24 / 37 | 64.86% |
| Ways with lit=* | usable_geometry | 0 / 37 | 0.00% |
| Mapped street lamps | name | 0 / 0 | N/A |
| Mapped street lamps | usable_geometry | 0 / 0 | N/A |
| Police stations | name | 0 / 6 | 0.00% |
| Police stations | opening_hours | 5 / 6 | 83.33% |
| Police stations | phone_any | 5 / 6 | 83.33% |
| Police stations | address_any | 5 / 6 | 83.33% |
| Police stations | check_date_any | 6 / 6 | 100.00% |
| Hospitals (tagged, not verified) | name | 0 / 36 | 0.00% |
| Hospitals (tagged, not verified) | opening_hours | 35 / 36 | 97.22% |
| Hospitals (tagged, not verified) | phone_any | 35 / 36 | 97.22% |
| Hospitals (tagged, not verified) | address_any | 7 / 36 | 19.44% |
| Hospitals (tagged, not verified) | check_date_any | 36 / 36 | 100.00% |
| Hospitals (tagged, not verified) | emergency | 35 / 36 | 97.22% |
| Pharmacies | name | 0 / 3 | 0.00% |
| Pharmacies | opening_hours | 3 / 3 | 100.00% |
| Pharmacies | phone_any | 3 / 3 | 100.00% |
| Pharmacies | address_any | 3 / 3 | 100.00% |
| Pharmacies | check_date_any | 3 / 3 | 100.00% |
| Shops / businesses (including retail pharmacies) | name | 0 / 15 | 0.00% |
| Shops / businesses (including retail pharmacies) | opening_hours | 3 / 15 | 20.00% |
| Shops / businesses (including retail pharmacies) | phone_any | 12 / 15 | 80.00% |
| Shops / businesses (including retail pharmacies) | address_any | 3 / 15 | 20.00% |
| Shops / businesses (including retail pharmacies) | check_date_any | 15 / 15 | 100.00% |
| Businesses with opening_hours | name | 0 / 12 | 0.00% |
| Businesses with opening_hours | opening_hours | 0 / 12 | 0.00% |
| Businesses with opening_hours | phone_any | 9 / 12 | 75.00% |
| Businesses with opening_hours | address_any | 0 / 12 | 0.00% |
| Businesses with opening_hours | check_date_any | 12 / 12 | 100.00% |

Road-specific fields (roads do not ordinarily require opening hours):

| Road attribute | Present | Missing / blank | Missing % |
| --- | --- | --- | --- |
| name | 148 | 1246 | 89.38% |
| lit | 37 | 1357 | 97.35% |
| surface | 193 | 1201 | 86.15% |
| sidewalk_any | 36 | 1358 | 97.42% |
| foot | 4 | 1390 | 99.71% |
| access | 5 | 1389 | 99.64% |

`sidewalk_any` accepts sidewalk, sidewalk:left, sidewalk:right or sidewalk:both.
A present key, including `sidewalk=no`, is recorded information, not a sidewalk
availability assertion. Missing `foot` or `access` does not mean walking is
prohibited or permitted; defaults, road class and local rules need later review.
Missing `surface` does not establish poor surface conditions.

## Road geometry, pedestrian relevance and lighting

| Highway value | Way objects |
| --- | --- |
| residential | 1125 |
| secondary | 68 |
| service | 68 |
| tertiary | 38 |
| primary | 25 |
| path | 22 |
| unclassified | 21 |
| living_street | 9 |
| footway | 7 |
| primary_link | 4 |
| steps | 3 |
| secondary_link | 2 |
| rest_area | 1 |
| pedestrian | 1 |

The combined 1,394-way category includes 22 paths, 7 footways, 3 steps and
1 pedestrian way (**33 explicitly pedestrian/path-class objects**), and many
general roads. Paths are not automatically pedestrian-only. There is also a
`rest_area` way, illustrating that a highway-key filter is broader than a
traversable road-edge inventory. OSM way segmentation is arbitrary; counts are
not street counts, route lengths, pedestrian accessibility or network completeness.
No routing graph, connectivity audit or permission evaluation was performed.

Lighting: **37/1,394 = 2.65%** have a `lit` key; values are {'yes': 33, 'no': 4}.
The remaining **1,357/1,394 = 97.35%** are **unknown**. This denominator is object
count, not road length. It is not a route's lighting coverage. There are **zero
mapped street lamps** in this extraction. Neither unknown lit tags nor zero mapped
lamps indicates unlit or unsafe conditions. Recorded `yes`/`no` are unverified
mapping claims; functionality, timing, brightness and continuity are unknown.

## Coordinate integrity, duplicates and reliability

* Raw records: 1,451; unique type/ID records: 1,451;
  extra duplicate records: 0.
* Coordinate occurrences checked: 13,820; globally invalid: 0;
  objects without usable geometry: 0.
* Coordinate occurrences outside bbox: 1,225 (8.86%);
  objects with at least one outside point: 171. These occurrences are not
  deduplicated geographic locations and include full crossing geometry.
* All exported original elements matched raw records. Original category counts
  and coordinate statistics matched the earlier quality summary.

These checks establish structural usability, not positional accuracy or existence.
Nodes are points; closed facility ways are exported as LineStrings, not validated
facility polygons or entrances. No relations were returned, so relation geometry
handling cannot be evaluated using this real sample. Multiple IDs may describe
one establishment: the two Kotwali-named police ways are candidates for manual
entity review, not proven duplicates. Unique IDs do not establish unique facilities.

Hospital-tagged records particularly need semantic review. Examples retained in
the source include `node/8917241838` named "Veterinary Hospital", `node/4246041123`
named "PEARL SKIN CLINIC", and `node/7012150017` whose `addr:district` is
"East Singhbhum" despite geometry selected in the Ranchi box. These are review
flags, not automatic exclusions or proof of wrong coordinates. A hospital tag
does not establish human emergency care; only 1
of 36 has a nonblank emergency tag. Hospital source-tag distribution:
{'not recorded': 10, 'OpenGovernmentData': 15, 'Local Knowledge': 11}. Government-import or local-knowledge provenance is not
independent validation. No phone numbers, emergency capabilities or entrances
were verified.

Last-edit years from OSM metadata:

| OSM last-edit year | Objects |
| --- | --- |
| 2014 | 5 |
| 2015 | 236 |
| 2016 | 14 |
| 2017 | 6 |
| 2018 | 1 |
| 2019 | 2 |
| 2020 | 1 |
| 2021 | 776 |
| 2022 | 86 |
| 2023 | 47 |
| 2024 | 31 |
| 2025 | 127 |
| 2026 | 119 |

Last edit means some aspect of an object changed; it is not the date each tag was
observed or the facility checked. The server timestamp is likewise not field
verification. Sparse check-date tags cannot certify the present state of features.

## Recorded business schedules and usability

| Business OSM ID | Name | Recorded opening_hours |
| --- | --- | --- |
| node/4246041124 | UNISEX FASHION TATTOO | 11 TO 08 |
| node/4249972573 | HDFC Bank | no. |
| node/4249989621 | PARAM COMPUTER CENTRE | 08:00-18:00 |
| node/8386621352 | Max | Mo-Su 10:00-21:30 |
| node/10017490118 | HDFC Bank | Mo-Sa 10:30-15:30 |
| node/13131397287 | Reliance Centro | Mo-Su 10:00-21:00 |
| way/516991071 | The Best | Mo-Su 11:30-22:30 |
| way/902963272 | Barbeque Nation | Mo-Su 12:00-23:30 |
| way/902970563 | Mocha Cafe & Bar | Mo-Su 12:00-23:00 |
| way/902973431 | Dhunki | Mo-Su 11:30-23:30 |
| way/1370049529 | Mall of Ranchi | 11:00-23:30 |
| way/1430467796 | R.Ali's Grand Mall | Mo-Su 10:00-22:00 |

The literal values `11 TO 08` and `no.` require manual review before schedule
parsing. The other strings were not validated by an opening-hours parser either.
Tag presence is not syntactic validity or current operation. No timezone/holiday
evaluation was performed and **no record is classified as currently open**.
The hospital and police records with `24/7` are separate facility-hour observations,
not additions to the commercial count. Do not use the selected business sample
as evidence of footfall, surveillance, active frontage or route safety.

## Route-level suitability

| Category | Practical use | Current constraint |
| --- | --- | --- |
| Road / pedestrian ways | Geometry matching, highway-class context; surface where tagged | Corridor coverage, matching and walking permissions unverified; names and pedestrian detail sparse |
| lit-tagged ways | Display explicit yes/no/unknown observations on matched segments | 97.35% unknown by way count; insufficient for broad lighting comparisons |
| Street lamps | None from this snapshot | Zero records; physical lamps may still exist |
| Police stations | Provisional mapped police landmarks near a route | Six records; entity duplicates, entrances, accessibility and service not verified |
| Hospitals | Provisional mapped healthcare landmarks near a route | 36 tag matches; includes semantic/address review flags; emergency capability largely unknown |
| Pharmacies | Provisional sparse retail-healthcare landmarks | Three records, no hours; cannot establish availability |
| Shops / businesses | Display selected named places as context | Sampling depends on hours; insufficient for density or activity comparisons |
| Businesses with hours | Show raw schedules with provenance after review | Twelve selected records; no current-open classification or complete coverage |

All spatial uses require a route polyline, a documented corridor/nearby-distance
rule and enough sampled area around it. Counts above are bbox totals, not counts
near the SHEPATH test route. Facility proximity can begin as clearly labelled
geometric distance; it is not walkable access, an entrance distance or response time.

## Albert Ekka Chowk to Doranda: coverage status

**Not verified.** A read-only search of the available source, documentation and
data files found no saved endpoint coordinates or route geometry for this route.
The downloaded OSM features are not a routed polyline. No route was regenerated
and no geocoding was called. Place names alone cannot establish bbox containment.

To establish adequacy later, reuse/export the actual routed polyline and test
the entire line and a chosen analysis buffer against the bbox, report the fraction
of route length inside it, and inspect out-of-bounds sections. Checking only
endpoints or incidental crossing ways is insufficient. A rectangle containing
all route vertices contains its straight polyline segments; buffer adequacy needs
its own containment test. Until then, full-route comparisons should not claim
complete observation coverage. An expanded data experiment may be needed after
this check, but no further extraction was attempted here.

## Three practical features for a first explainable comparison prototype

1. **Road class and pedestrian-way context along matched route segments.**
   Highway tags and geometry have the strongest structural coverage. Describe
   the mapped class, steps and any recorded surface/foot/access details, with
   explicit unknowns. Do not infer accessibility or safety from class alone.
2. **Proximity to named mapped support landmarks.** Start with police and manually
   reviewed human healthcare facilities, retain category and OSM identity, merge
   only verified duplicate representations, and label distance as geometric
   unless walkable access is established. Present useful context without implying
   emergency capability, guaranteed help or a safe route.
3. **Explicit lighting observations plus unknown coverage.** Match the 37 tagged
   ways, preserve their yes/no tags and show unknown segments. Once routes are
   available, calculate coverage by matched route length with a disclosed matching
   rule; do not substitute these bbox-wide object percentages. This is an
   explainable evidence display, with insufficient coverage to rank routes by lighting.

Business activity and current opening status should wait for a less selective
inventory and validated schedules. No safety score, route ranking or ML model
was generated by this analysis.

## Offline validation

Generator checks passed: successful live-source status, raw/export record identity,
original category counts, coordinate statistics and deduplicated category union.
The separate `test_coverage_analysis.py` checks the delivered CSV's type counts,
denominators, percentages, unique category/attribute rows and raw-source hash;
zero-denominator and blank-tag behavior; pharmacy overlap; and report caveats.
All **4 coverage tests** and the **12 existing extraction tests** passed (16 total).
The extraction tests mock API calls; none contacts Overpass.

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s data/ranchi_safety -p 'test_*.py' -v
```

## Attribution and scope

Data: **© OpenStreetMap contributors**, ODbL 1.0. Attribution and licence:
https://www.openstreetmap.org/copyright (retained from the extraction; no live lookup).
The saved query is the authority for selection rules. Results reflect volunteer
mapping and imported tags, with geographic and temporal bias. They describe
this snapshot only, not the whole city or measured safety conditions.

Both requested artifacts and their offline generator are inside
`data/ranchi_safety/`. Routing, frontend, backend and ML code were not modified;
no commit or push was performed.
