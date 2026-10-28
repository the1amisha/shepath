# Evidence match

Live route cards can be reordered using user-selected evidence weights. Paths, route names, colors and the selected route remain unchanged. The saved pilot comparison retains its separate method. Mock routes are never ranked by evidence.

## Criteria and formula

All controls start at zero (provider order). Each input is a relative weight from 0 to 100; inputs are divided by their sum. Reset or Skip preferences restores zero weights. Changing preferences in the results does not request new routes or evidence.

- **Lighting tag coverage:** 100 minus the segment analysis's route-length percentage without nearby usable lighting tags.
- **Walking infrastructure tag coverage:** 100 minus the equivalent missing sidewalk-tag percentage.
- **Nearby businesses:** mapped business records per projected route kilometre, divided by the largest density among the returned alternatives and multiplied by 100. If all counts are zero, all business values are zero.

The evidence-match index is the sum of criterion values multiplied by normalized weights. Full precision determines ordering; displayed values are rounded. Exact ties keep provider order. Business normalization depends on this set of alternatives, so indices should not be compared between different journeys. The scale is a transparent interface heuristic, not a calibrated model or probability.

Tag coverage measures documentation, including recorded negative values such as `lit=no`. A higher value does not mean more working lights, continuous sidewalks or better walking conditions. Nearby tags can describe other streets within the 100 m corridor. Business counts are historical OSM objects, with unknown operating status, duplicates and real-world completeness. No criterion measures personal safety.

**Street activity remains unavailable.** There are no pedestrian/crowd observations in the current dataset. It is explicitly excluded rather than inferred from business counts. This implementation therefore provides three evidence weights, not the complete originally requested four-condition model.

## Eligibility and missing evidence

Reordering waits for every returned route to have an available, full-buffer-covered response with segment evidence. It checks route IDs and matching manifest, PBF, snapshot timestamp and buffer across the responses. The existing request parser checks exact coordinates before the state reaches the matcher; the hook isolates each journey's evidence. An unavailable, failed, unsupported or legacy response without segments prevents ranking the entire set. Missing routes are not assigned zero or quietly placed last. No missing street condition is imputed.

The displayed unknown lighting and sidewalk percentages remain available in each card's explanation and in the full evidence panel. Weights do not alter geographic evidence, provenance, travel estimates or routing requests.

## Sensitivity

The sensitivity calculation tests whole percentage points from 0 through 100 for one criterion, redistributing the remainder in the other criteria's current ratio. It reports a tested point at which a different route is the unique first-place match. If that ratio is undefined, that criterion is skipped. It does not claim a continuous threshold or that every higher weight gives the same result. If no change is found in this search, no note is displayed. Display rounding does not affect the search.

## Validation

Unit tests cover normalization, reversed orders, ties, zero values, unavailable evidence, identity/source mismatch, length-normalized counts and reproducible sensitivity. A journey test checks reordering, stable route identity, selection and reset without extra network calls. Windows live acceptance remains a separate check; no backend or dependency update is required after the segment-evidence release.
