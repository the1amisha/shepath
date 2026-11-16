# Hybrid route suitability

Automatic comparison orders eligible routes by a 0–100 suitability score.
Default weights come from the existing constrained survey logistic regression.
Changing a priority is a user rule, not retraining. The model's zero time
coefficient remains unchanged; the extra-time limit controls eligibility.

For each attribute, the existing evidence adapter supplies a lower and upper
value. The score is 100 times the weighted mean of their midpoints. Unknown
inputs span 0–1 and therefore contribute a neutral 0.5. This imputation rule is
designed, not learned. Weighted input coverage is 100 minus the weighted range
width in score points. It is not statistical confidence. Entirely unknown active
inputs receive no score; known negative inputs can receive zero.

Eligible routes appear before routes outside the time limit. Scores sort
descending; ties use walking time then distance. A unique highest eligible
score is highlighted. Partial-input scores are labelled provisional. Selection
stops following automatic ordering once the user chooses a route.

Existing identity, full-buffer, evidence readiness and shared-provenance guards
remain in force. If a route fails those checks, the comparison falls back to
walking time until comparable evidence is available. Single-route journeys are
not scored by this comparison. Historical tags are proxies, not proof of actual
lighting, usable footpaths, activity or personal safety. The score is neither a
safety probability nor validated real-route performance.

Presentation demo uses the same scoring function with explicitly synthetic
inputs. It makes no routing requests and does not inject synthetic observations
into the live journey. Its missing-data switch demonstrates honest fallback.
There is no new training, survey data publication, paid API or hosting change.
