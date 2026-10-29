# Evidence verification

**Verify this evidence** expands the source snapshot, route ID, geometry SHA-256, evidence identity SHA-256, manifest SHA-256, source PBF SHA-256, buffer and coverage. It is available with completed evidence in the live results, overview and evidence screen. Opening it makes no request. Saved records without their original route geometry can show identifiers but cannot be rechecked.

**Recheck evidence** submits the same route geometry to the existing evidence endpoint using its serial queue, deadline and bounded busy retries. The existing parser validates the returned route ID, exact coordinates, schema, coverage and facility inventory before comparison. No new routing-provider request is made.

The recheck compares all retained parsed evidence fields, including the hashes, counts, segment evidence and facility-hour inventory, regardless of object key order. Arrays retain order. It reports a match, a changed response or a failure, with the completed check time in IST. A failed check is never a match. Repeated clicks are disabled while pending; route/evidence changes or unmounting abort pending checks and discard late results.

This is a consistency check against the same evidence service. The browser does not independently recompute PBF/manifest hashes or prove that mapped records match real street conditions. The evidence identity hashes geometry, analysis settings, schema and source provenance; it is not itself a digest of every result count. Comparing retained fields also catches changed results with unchanged identifiers. Fields stripped by the frontend parser are outside this comparison.

A recheck does not replace displayed evidence or rerank alternatives. If the response changes, the interface explains that the original response remains and asks the user to start a new route search to reload all alternatives together. This avoids silently mixing source versions.

Validation covers matches, changed counts/source/identity/coverage, failures and retry, cancellation on route change, missing geometry and object-order independence. Browser replay exercises success, change and error states and narrow layouts. No backend or dependency changes are required.
