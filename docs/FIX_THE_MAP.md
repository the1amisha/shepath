# Fix the map

The segment evidence panel contains **Fix the map**, a collapsed list of stretches with any positive unknown lighting or sidewalk coverage. It preserves route order and displays ten stretches at a time, with Show more stretches for the rest. Changing evidence resets the list. Small positive percentages below 0.1% are labelled explicitly rather than rounded to zero.

Each stretch shows its distance range and missing nearby tag percentages, plus links to view its area on OpenStreetMap or open iD. A central vertex by coordinate-array index supplies latitude/longitude at zoom 18; this is a point on the supplied stretch, not a distance midpoint, street match or full route overlay. URLs follow the [iD URL parameter documentation](https://github.com/openstreetmap/iD/blob/develop/API.md).

This feature identifies gaps in the historical proximity analysis, not verified missing lights/footpaths or missing tags on a particular OSM road. A known negative tag is documented evidence and is not treated as unknown. Review the current map and correct street before contributing only verifiable observations. Links prefill no tags or edits and never upload changes. OSM may require login to edit. Users must choose and save any changes themselves.

Edits to OSM do not automatically change the pinned SHEPATH snapshot. A dataset refresh is needed. A zero-candidate result means no nearby tag gaps in this analysis, not complete or accurate street mapping. Unsupported/legacy responses without segment evidence do not show this feature.

Tests cover candidate filtering, coordinate order, editor URL, tiny positive unknown shares, no-gap state, pagination and evidence changes. Browser replay checks opening the editor URL in a new tab with an intercepted external target, pagination, narrow layouts and no added route/evidence API requests. It does not log in or make OSM edits. No backend or dependency changes.
