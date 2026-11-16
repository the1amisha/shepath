# Simulation-based route-rating ML

This is a working supervised-learning prototype with **synthetic training labels**. It does not predict measured harassment, crime, collisions, or verified safety in Ranchi. Generated inputs must never be described as collected observations. The survey preference model is a separate experiment and supplies neither this model's labels nor its test data.

## Reproduce

From the repository root, in a separate Python environment:

```sh
python -m pip install -r ml/simulation/requirements.txt
python ml/simulation/train.py
python -m unittest discover -s ml/simulation -p 'test_*.py'
```

Training writes `frontend/src/lib/simulationModel.json` and `evaluation.json`. No private records, geographic artifacts, routing calls, paid service, or server ML runtime are required. The generator and seed reproduce all training/test examples; the combined numeric dataset hash is in the artifact. Do not replace actual survey responses with generated responses.

## Data and target

Seed 20261116 generates 1,000 hypothetical environments for training; seed 20261117 generates 250 different test environments. Each has four time-of-day variants (night fractions 0, 0.25, 0.75, 1). Splitting environments before time expansion keeps variants of a training environment out of the test set.

Four independently sampled uniform [0,1] inputs represent hypothetical footpath provision (f), lighting (l), business activity (s), and pedestrian activity (p). The fifth input n is night fraction. The deliberately invented rating target is:

```
clip(10 + 30*f + 12*l + 15*s + 10*p + 13*l*n
     + 8*s*p - 18*n*(1-l) + Normal(0, 2), 0, 100)
```

The coefficient choices encode a scenario designer's assumptions. They are not learned evidence about the city. A 64-tree gradient boosting regressor (depth 3, learning rate 0.1) learns from these targets. Browser predictions traverse exported fitted trees; the browser does not execute the target formula. This establishes a functioning ML pipeline, not independent evidence for the assumptions.

## Evaluation and interpretation

The committed run uses 4,000 training and 1,000 test examples. Held-out synthetic MAE is 2.65/100 and RMSE 3.36, against constant-training-mean baseline MAE 11.05. These are synthetic regression errors, **not safety accuracy, confidence levels, or probabilities of avoiding harm**. No model selection used the held-out environments. Tests check Python/browser parity and reproducible generation. The simulation has not been externally validated.

## Real-route integration

Enable **Simulation-based ML routes** or choose **Try simulation-based ML routes** on the welcome page. Routing still supplies actual walking geometry, distance, and duration. The app estimates the night fraction using its existing central-Ranchi solar approximation. The highest model score among routes within the extra-time limit appears first and is selected automatically until the user makes a manual choice. One returned/eligible route is not called a model winner. One-decimal score ties are ordered by walking time.

Unknown route attributes are generated deterministically from ~500m spatial cells, using equal-distance polyline samples (50m target, capped at 200). IDs, provider return order, refreshes, or model scores do not seed these values. Shared cells share values. **These cells are a synthetic scenario overlay, not a real Ranchi conditions dataset.** There is no claim that the generated conditions match a street.

Once every alternative has comparable full-buffer mapped evidence, the existing guarded evidence adapter supplies each attribute's missing-input range [low, high]. Each resolved input is `low + (high-low)*generated_value`. Observed positive/negative proxy fractions are preserved; only the unknown fraction is generated. Bounds are checked before use. Until comparable evidence is available (including failures, coverage gaps, and snapshot mismatches), all four environmental inputs are generated and labelled accordingly. Generated fractions are averaged equally for the coverage display. This is data provenance coverage, not prediction confidence. The night fraction is reported separately.

Nearby OSM tags and opening schedules are imperfect proxies, not the route-wide conditions represented by synthetic training examples. Combining them is another unvalidated assumption. Scores can update when evidence arrives. Each card shows its resolved inputs, generated fraction, and source; the actual evidence store and map evidence panels remain unchanged. Manual yes/no descriptions, if previously supplied, retain their unverified source labels.

The short reason compares the prediction with each single input replaced by 0.5 and reports the largest absolute change. It is local model sensitivity, not causation or an assertion that a facility exists. Simulation mode remains visible in results, overview, and report. Turning it off returns to the existing survey-preference comparison.

## Presentation wording

“SHEPATH automatically ranks real walking-route alternatives using a gradient-boosted model trained on synthetic environmental scenarios. We evaluate whether the model learns those scenarios and show which route inputs are generated. Real-world safety validation is future work.”

Do not present this as a field-validated safest-route model, invented data as observed Ranchi data, or the MAE as safety prediction accuracy. A future real-world model needs a defined outcome, appropriate independently collected labels, location/time-separated evaluation, and missing-data treatment validated against that target.
