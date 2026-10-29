# Plain-language route summaries

The live route comparison and overview include a **Route summary** for the selected route. It describes estimated distance/time, mapped business and healthcare counts, the longest stretch without a nearby mapped facility, and differences from another route. **Compare with** selects the alternative; it does not change the selected route, map or ranking. The choice persists into the overview and resets for a new route request.

## Deterministic rules

`frontend/src/lib/routing/routeSummary.ts` builds text directly from the current route and validated evidence state. It performs no model calls, network requests or new geographic analysis.

- Route names retain the routing provider's original order, even when evidence weights reorder the cards.
- The default comparison is the fastest other returned route. Ties retain provider order. Evidence availability does not influence this choice, avoiding selective comparison of only well-mapped alternatives.
- Travel-time differences use unrounded duration seconds. Exact equality is described as equal estimated time; a nonzero difference below a minute is reported as less than one minute. Larger times are rounded to minutes. Distance and gap lengths are approximate: metres below 1 km and one decimal kilometre above it. A positive gap below a metre is never described as zero.
- Counts describe business and healthcare OSM records whose geometry intersects the route's 100 m buffer. Differences use exact integer counts and name the alternative explicitly. Categories are not summed, and counts do not establish operation or access.
- The longest gap comes from the existing segment-evidence analysis. A measured zero gap is described as nearby mapped records along the whole route; an absent segment response is described as unavailable. Missing tags/records are never converted into zero counts.
- The expandable **Missing information and source** section retains route-length missing-tag percentages and the source snapshot. Nearby tags do not verify conditions on the walked street.

## Eligibility and failure handling

The summary consumes responses after the existing exact-coordinate/coverage parser and journey-isolated hook. It additionally checks route ID, available status, full buffer coverage, non-null context and the expected buffer. Loading, failure, unsupported coverage and mismatched responses show travel estimates with an explicit evidence limitation.

Mapped count comparisons require available evidence for both routes and equal manifest hash, source PBF hash, snapshot timestamp and buffer. Different sources or missing alternative evidence suppress count comparisons; they do not hide provider travel estimates. Older responses lacking segment evidence can still provide valid counts, but not a gap estimate. Mock routes never receive these live summaries.

The text reports estimates and historical mapped evidence, not a recommendation or personal-safety assessment. Departure-time details remain in their existing panel; changing departure does not change these geographic counts or gap lengths.

## Validation

Tests cover direction/size of count and time differences, ties, sub-minute values, singular/zero counts, missing vs zero gaps, legacy responses, queued/failed/unsupported/mismatched evidence, differing sources, comparator selection, stable route names and mock exclusion. A journey test verifies selection/comparison updates and overview persistence without additional requests. Browser replay checks the saved Ranchi alternatives and narrow layouts. No backend or dependency changes are required.
