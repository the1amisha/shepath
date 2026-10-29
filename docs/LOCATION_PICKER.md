# Selecting start and destination

Live search supports typed places, **Choose on map**, and **Use my location as start**. On the map choose **Set start** or **Set destination**, then click a point. Keyboard users can focus the map, pan with arrow keys and use **Use map centre**. A and B identify selected start and destination. The map initially centres on Ranchi; selected points can be outside it, but historical evidence retains its bounded coverage gate.

Selected map/GPS coordinates are sent as optional `originPoint` and `destinationPoint` arrays in latitude–longitude order. Each selected endpoint bypasses name geocoding; an unselected endpoint uses the existing lookup. Editing a name or choosing a destination shortcut discards its stored point. The provider may snap a selected point to its routable network. Returned route geometry remains the evidence input.

Browser geolocation is user initiated, uses one reading with a 15-second timeout, and displays the reported accuracy. There is no location watch or live tracking. Denial, cancellation and late responses are handled. Geolocation requires browser permission and a supported secure context (localhost works for development). Map tiles come from OpenStreetMap; selected coordinates are sent for routing when the route request is made. No new service or API key is required.

This change does not add Google Maps or place-name autocomplete. Selected points use coordinate labels in the overview and shared plan. A geocoding suggestion picker can be added separately.

Validation includes selected-point bypass, malformed coordinate rejection, stale point clearing after edits, location cancellation/denial and browser map interaction. External routing is mocked in automated tests.
