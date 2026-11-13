# Experimental ML recommendations on real walking routes

The results page now offers **Use ML recommendations**. It compares the actual returned route IDs and geometries, highlights a clear pick, and moves that card to the top. **Choose ML pick** selects that same route in the map, summary and subsequent journey screens. Selection never changes merely because evidence finishes loading. Manual evidence weighting resumes when ML mode is switched off.

## What is learned, and what is designed

`ml/preferences/train_live.py` fits a separate constrained logistic regression model to the existing private survey export: 40 submissions, 39 consenting, 202 clear answers. It minimizes summed logistic loss plus L2/2 (C=1), with no intercept. Time is constrained nonpositive and the four attribute coefficients nonnegative. These are explicit product assumptions introduced after inspecting the original unconstrained fit, not discoveries from the data. There is no hyperparameter search or claimed independent final test.

Final coefficients, in order: time 0; footpath 0.82278836; lighting 1.16702075; shops 0.80400234; pedestrians 0.19026148. The model learns no time penalty under these constraints. A user-selected maximum extra time beyond the fastest returned route (default five minutes) is therefore a separate eligibility rule. It is not an ML estimate.

Leave-one-submission-out evaluation holds all answers from a submission out together. Accuracy is 67.33% (136/202), equal to the scenario-frequency baseline. Model log loss is 0.63849 versus baseline 0.64468. These evaluate the same six hypothetical scenarios only. They do **not** establish recommendation accuracy on real routes, generalizability, calibration, safety or causal effects.

The original `/preference-lab` model and its reported results remain unchanged. The new artifact is `frontend/src/lib/livePreferenceModel.json`, with source CSV hash, coefficients, counts, metrics and Python reference probabilities. No respondent rows are published.

## Transfer to routes

This is a hybrid: the learned attribute coefficients weight hand-designed geographic proxies. The survey did not train on these mapped inputs; the transfer is experimental.

| Survey attribute | Automatic proxy | Unknown handling |
| --- | --- | --- |
| Usable continuous footpath | Fraction of nearby road objects with conservative positive sidewalk presence tags | Missing, separate, mixed/conflicting tags and surface-only tags remain unknown; presence does not establish usability or continuity |
| Working lighting throughout | Fraction of nearby road objects with lit=yes versus lit=no | Other/missing values remain unknown; tags do not verify working lights or the walked street |
| Open shops along route | Fraction of mapped businesses with supported schedules indicating open at departure | Missing/unsupported hours stay unknown; zero mapped businesses is wholly unknown, not physical absence |
| Other pedestrians | No automatic observation | Entirely unknown unless the user describes it |

Each proxy has a lower and upper value. With Y positive, N negative and T total mapped objects, the range is [Y/T, 1-N/T]. T=0 or invalid counts gives [0,1]. These fractions refer only to the mapped inventory; unknown real-world completeness is not captured by the bounds. Scores sum each bound times its learned attribute coefficient, divide by the sum of attribute coefficients, and multiply by 100. They are **fit indices**, not logistic choice probabilities, confidence intervals, or safety scores.

A route is picked only if its lower score strictly exceeds every other eligible route's upper score. Ties and overlaps preserve provider order. A single eligible route is not called an ML winner. Every returned route needs successful full-buffer coverage and matching provenance before comparison, including routes outside the time budget. Old backend responses without the new optional sidewalk field work, with that attribute left unknown. No street matching or new geographic extraction is performed.

Users may optionally provide yes/no descriptions of the actual routes. These override the corresponding proxy and are labelled user-reported, not verified. Descriptions remain in component memory only, are scoped to exact route geometry/duration/departure, and clear on a new route request. Changing departure time returns to automatic/unknown values for that time. Descriptions are never sent to the API or persisted.

## Reproduce and test

From the repository root, with `ml/preferences/requirements.txt` installed (SciPy is a scikit-learn dependency):

```sh
python ml/preferences/train_live.py --input /path/to/private-survey.zip --output frontend/src/lib/livePreferenceModel.json
python -m unittest discover -s ml/preferences -p 'test_*.py'
```

Do not commit the private survey. If the learned time coefficient becomes nonzero in a future fit, the current runtime deliberately refuses it; implement and evaluate a compatible duration mapping before changing this contract.

Deploy frontend and backend from the same revision to enable the optional sidewalk presence proxy. Backend restart clears its process-local evidence cache. No paid API or additional provider calls are added; inference runs in the browser after the existing evidence requests.

For a demo, use a journey that returns multiple routes. Explain missing inputs honestly; do not enter invented route observations just to produce a pick. Validate actual route choices and map-to-street correspondence in a future field study before claiming real-world recommendation performance.
