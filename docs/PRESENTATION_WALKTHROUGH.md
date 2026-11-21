# SHEPATH presentation walkthrough

## Opening (20 seconds)

“SHEPATH compares walking routes using preferences learned from survey choices. It combines those learned weights with available map evidence and explains the result.”

## Demonstration (3–4 minutes)

1. Plan a walk from Albert Ekka Chowk, Ranchi to Ranchi Railway Station, Ranchi. Wait for all route evidence checks.
2. Show the route comparison and map. Explain that route numbers retain their identity even when the order changes. The app automatically computes preference scores and selects the highest calculated fit.
3. If “Similar matches” appears, say: “The missing information could change which route wins. The app still shows its calculated top match and lets us choose the fastest route.” Do not describe this as an API error or a safety ranking.
4. Open “Why this recommendation?” briefly. Show known inputs and one actual map comparison. Shops on the map do not prove that shops are open.
5. Open “Personalise comparison” → “Adjust ranking priorities”. Change a priority and explain that these are user-adjusted weights. The order may remain unchanged; do not promise that every slider movement changes the winner. Reset learned weights afterward.
6. Open “How the ML works”. Show 39 consenting submissions and 202 clear choices. The 67.3% accuracy equals the baseline; log loss is slightly lower. These are exploratory survey results, not real-route safety accuracy.
7. Select a route, show nearby-place details and the route overview. Close technical sections after showing them.

## Backup plan

Open “Saved Ranchi Pilot Comparison” before presenting and confirm it loads. It is a separate historical Albert Ekka Chowk → Doranda comparison; it is not the live station journey or an offline ML replay. It needs the backend but does not request new directions from the routing provider. A routing error now offers a shortcut to it.

If internet or backend access fails completely, use screenshots or a screen recording captured beforehand and identify them as recorded results. Never present saved results as fresh live responses.

## Questions to prepare

- **Where is the ML?** Constrained logistic regression learns attribute weights from route-choice responses. Route comparison applies those weights to mapped proxies. The weighted midpoint route score itself is a product rule, not a predicted safety probability.
- **Why not always recommend the safest route?** Training labels describe choices, not observed safety outcomes. Street coverage is incomplete; the app exposes that uncertainty.
- **How was it evaluated?** Each survey submission was held out in turn on the same six scenarios. Constraints were selected after inspecting an earlier fit, so evaluation is exploratory.
- **What about Geoapify?** The inspected responses were OSM-derived place details and did not supply the missing hours or street conditions. Integration was deferred instead of duplicating the same evidence.
- **What is next?** More independently sourced street observations and evaluation on new journeys and respondents.
