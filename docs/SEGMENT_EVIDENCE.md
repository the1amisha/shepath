# Evidence along a route

The live route evidence response includes `route_context.segment_evidence` when the full route buffer is covered by the verified Ranchi dataset. Older saved responses without this field remain supported. An unsupported route still returns `route_context: null`; the interface does not invent segment evidence.

## What the interface shows

- **Show segment evidence** colors the selected route by nearby business/healthcare coverage. Gray means none, purple partial and blue continuous. These are evidence categories, not safety ratings.
- **Where along the route?** shows the longest gap with no mapped business or healthcare geometry within 100 m, plus the share of route length without nearby usable lighting and sidewalk tags.
- An expandable ordered list gives the distance range, facility counts and missing-tag percentages for every stretch. This provides the same information without requiring map interaction or color perception.

Counts are unique OSM objects within each stretch's buffer. Objects can appear in several stretches and categories, so counts must not be summed. Current operation, access, real-world completeness and conditions on the walked street remain unverified. A usable `lit=no` or `sidewalk=no` is recorded evidence, not a missing tag or proof of a positive condition.

## Geometry and interpretation

The existing route is densified and projected to EPSG:32645. It is divided into roughly 150 m stretches, distributing the length evenly to keep stretches within 100–200 m. A route shorter than 100 m has one shorter stretch. At most 2,000 stretches are accepted, in addition to the existing input and densification limits.

Full feature geometries, rather than centroids, are buffered by the configured radius. Overlapping buffers are unioned. Each ordered route edge is intersected with the union and converted to distance intervals along the journey. This preserves repeated traversal and avoids counting overlapping facility buffers twice. Gaps are measured from these intervals, not rounded to segment boundaries; reported precision is subject to the existing projection and polygonal-buffer approximation.

The longest facility gap uses businesses and healthcare together. Missing lighting and sidewalk evidence means no nearby road object with a usable tag within the buffer. It is **not** the fraction of the exact walked street with missing tags: street matching has not been performed. Existing tag-classification rules are reused, including recorded negative values.

Segment coordinates are returned in latitude/longitude order for Leaflet. Their route response must pass the existing route-ID and ordered-coordinate checks. The client additionally checks segment ordering, numeric ranges and distance continuity. The segment method version, target length and implementation hash participate in the evidence provenance/identity.

## Validation and local review

Synthetic geometry tests cover empty inventories, short routes, partition lengths, exact gap boundaries, overlapping facilities, repeated traversal, tangent contacts and known negative tags. Frontend tests cover response validation, textual evidence and overlay removal when route selection changes.

The three tracked dynamic-response fixtures were replayed using their embedded source features as explicit test datasets. Counts and route-level missing-tag percentages matched the historical results within numerical tolerance. This replay is not a fresh verification of the complete production manifest or a live provider call.

After checking out this feature branch, restart the backend so the new analysis module is loaded. Plan a walking journey, wait for evidence, choose **Show segment evidence**, then switch routes and inspect **Where along the route?**. Review on the Windows setup before merging.

Run the focused geographic tests from the repository root with the project interpreter and `data/ranchi_safety` on the Python module path:

```sh
python -m unittest discover -s data/ranchi_safety -p test_segment_evidence.py -v
```

Frontend checks are documented in [CONTRIBUTING.md](../CONTRIBUTING.md). No geographic artifacts or historical validation outputs need to be regenerated for this feature.
