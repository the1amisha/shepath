# Experimental walking preference model

This trains regularized logistic regression on the six hypothetical A/B choices
in the SHEPATH survey. It predicts stated choice, not personal safety. It is not
connected to production routing. Survey responses and trained outputs stay local.

From the repository root (Python 3.11 or newer):

```cmd
backend\.venv-demo\Scripts\python.exe -m pip install -r ml\preferences\requirements.txt
backend\.venv-demo\Scripts\python.exe ml\preferences\train.py --input "D:\Walking Route Preferences and Experiences.csv.zip"
backend\.venv-demo\Scripts\python.exe -m unittest discover -s ml/preferences -p "test_*.py"
```

Place survey exports outside the repository. The default private_output folder
is ignored by Git and contains choices.csv, evaluation.json and model.json.
No timestamps, free-text journeys or personal details are copied into outputs.
Run the training command with a new complete export to retrain. Do not append
overlapping exports: submission IDs are temporary row numbers, not identities.

Only consenting submissions and exact Route A/B answers become training rows.
Missing, no-preference and uncertain answers are counted separately and excluded.
The importer checks all six question texts, allowing whitespace differences only.
Do not change scenarios or their wording without updating and versioning the design.

Features represent A minus B. Time is in five-minute units. Other values are
scenario contrasts: better footpath, lighting, open shops or pedestrian presence.
A zero means no stated difference; it never asserts that an unmentioned facility
is absent. Lighting contrasts occur after dark in this questionnaire. The design
does not identify a separate general nighttime effect or individual preferences.

The model has no intercept, so swapping A and B reverses the predicted probability.
C=1 is fixed in advance. No tuning is performed on the eight-response sample.
Leave-one-submission-out evaluation keeps each submission entirely out of its
training fold. The baseline is a smoothed per-scenario choice frequency computed
only from the training fold. A probability of 0.5 is scored as A for both methods.
Results include pooled choice accuracy, log loss, and mean submission accuracy.
The final coefficient file is fit on all clear choices after evaluation.

Eight submissions are not enough for reliable performance claims. Multiple
answers from one person are correlated, and repeated submissions by the same
person cannot be detected from this export. Evaluation covers new submissions
answering the same six scenarios, not generalization to unseen real routes.
Do not interpret coefficients as causal effects or probabilities as safety scores.
OSM missing tags are unknown and must not be substituted for scenario features.
Collect more independent responses and evaluate external scenarios before any
real-route ranking integration. No fixed response count guarantees validity.
