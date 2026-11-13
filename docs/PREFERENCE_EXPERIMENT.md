# SHEPATH preference model — final survey export

Evaluated 13 November 2026. The uploaded export contains 40 submissions, rather than the anticipated 38. Of these, 39 answered Yes to the combined adult-eligibility and voluntary-consent question. One submission was excluded.

## Data used

- 39 consenting submissions; all contributed at least one clear choice.
- Six fixed hypothetical walking-route comparisons per submission: 234 possible answers.
- 202 clear Route A/B choices used.
- 14 no-preference, 7 missing and 11 uncertain answers excluded from model fitting and evaluation.
- These are 202 answers from 39 submissions, not 202 independent participants. Unique people cannot be verified from this export.

## Evaluation

Regularized logistic regression, C=1, no intercept, five predefined scenario-contrast features. The specification and questionnaire checks were unchanged from the earlier evaluation. No hyperparameter search was performed.

Leave-one-submission-out cross-validation keeps all answers from the held-out submission out of training. The baseline estimates each scenario's A/B choice frequency using only training submissions, with Beta(1,1) smoothing. Both methods use the same folds and classify probability 0.5 as Route A. Evaluation concerns new submissions answering these same six scenarios, not new real-world routes.

| Metric | Logistic regression | Scenario-frequency baseline |
|---|---:|---:|
| Held-out accuracy | 67.33% (136/202) | 67.33% (136/202) |
| Held-out log loss (lower is better) | 0.63928 | 0.64468 |

Mean per-submission model accuracy: 66.45%. Pooled accuracy weights each usable answer equally; this mean weights each contributing submission equally.

The model matched baseline accuracy and had slightly lower log loss. This small difference does not establish a meaningful or statistically significant advantage. The final coefficient file was fitted on all 202 clear choices after evaluation; its training fit is not the reported held-out score.

## Suggested project-report wording

“The survey received 40 submissions. After excluding one submission that did not provide affirmative consent, 39 submissions supplied 202 clear choices across six hypothetical walking-route comparisons. Logistic regression was evaluated using leave-one-submission-out cross-validation. It achieved 67.3% accuracy, matching a scenario-frequency baseline. Log loss was 0.639 for the model and 0.645 for the baseline. The findings are exploratory and do not establish generalization to real routes or the wider population.”

## Scope and limitations

This is an offline experimental model of stated preferences, not a personal-safety predictor. The export does not establish representative sampling or verified unique participants. Repeated answers within a submission are correlated. The six scenarios cannot identify all real-world tradeoffs or individual preferences. Do not interpret coefficients causally, substitute missing OSM tags for hypothetical attributes, or use this model as a validated live-route ranker.

These results supersede the earlier 26-response results for reporting this export. Differences between the earlier and current scores reflect different datasets and are not a controlled improvement experiment.

## Demo and reproducibility

The frontend route `/preference-lab` shows the six fixed survey scenarios, final-fit probabilities, A/B label swapping, aggregate observed choices, and held-out metrics. The homepage links to it. Inference runs locally in the browser and requires no Render or routing-provider request. No raw responses or respondent-level records are shipped.

`frontend/src/lib/preferenceExperiment.json` contains the frozen coefficients, aggregate counts, scenario design and Python reference probabilities. `preferenceExperiment.ts` calculates the logistic prediction. Frontend tests verify all six probabilities against Python and check A/B reversal. The existing `ml/preferences/train.py` is the training source; its README includes historical eight-response context, while this report records the updated evaluation.

To regenerate from the private full export (do not commit the input or private outputs):

```text
python ml/preferences/train.py --input "Walking Route Preferences and Experiences.csv(2).zip" --output ml/preferences/private_output
```

Updating the dataset requires regenerating the demo coefficients, counts, metrics and reference probabilities together. Final-fit scenario probabilities are not out-of-fold evaluation predictions.

After merging and Cloudflare deployment, open `/preference-lab` from the homepage and check the scenario selector and Swap A and B button. Existing live routing and evidence weighting are unchanged.

Source CSV SHA-256: 17d1a6de72849e25c0bd1680bb827f5da8d7224198032ae58d6276a26d47a6f5
