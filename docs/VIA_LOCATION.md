> Historical implementation note: the via option has been removed from the app journey and trip summaries. The backend retains support for older clients.

# Route through a chosen location

In live routing, the search screen accepts one optional **Via** place name. Use a specific name and city, then inspect the returned path. Remove the value to return to ordinary alternative-route requests. Mock and saved comparisons remain fixed demonstrations.

The backend trims the optional `via` string (blank/null means absent; maximum 300 characters), geocodes it with the existing candidate selection, checks each leg for implausible same-city matches and sends coordinates in start–via–destination order. A via request omits alternative-route parameters and requests a single continuous route. Failure to geocode the via point returns an error; it does not silently return a direct route.

The provider snaps locations to its routable network. A place-name result does not guarantee a particular entrance or that the route follows an entire named road. This version does not provide point selection, waypoint markers or geocoding candidate selection. Stop time is not included in travel or daylight estimates. The overview and static shared/printable plan retain the requested via name. Evidence is computed for the returned full geometry under the existing coverage checks.

Validation: mocked backend tests cover coordinate order, alternatives, optional normalization, geocoding failure and input length. The frontend journey test covers submission, shared text and removal. No paid or live provider calls are needed for these tests.

Manual check: restart the backend, enter a specific Ranchi via location, request the route, inspect the path and overview, then remove the via location and request alternatives again.
