"""Exploratory stated-preference experiment, not a real-route safety model."""
import argparse
from collections import Counter
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import LeaveOneGroupOut

CONSENT = 'Are you aged 18 or above, and do you voluntarily agree to participate?'
FEATURES = ['extra_time_A_in_5_minutes', 'footpath_advantage_A',
            'lighting_advantage_A', 'shops_advantage_A', 'pedestrians_advantage_A']
# Exact question text prevents silently training on a changed survey design.
QUESTIONS = [
    'Choice 1 — During daylight\nRoute A: 10-minute walk; no footpath.\nRoute B: 15-minute walk; continuous usable footpath.',
    'Choice 2 — After dark\nRoute A: 18-minute walk; working streetlights throughout.\nRoute B: 12-minute walk; streetlights on only a few stretches.',
    'Choice 3 — During daylight\nRoute A: 12-minute walk; few other pedestrians.\nRoute B: 17-minute walk; other pedestrians along most stretches.',
    'Choice 4 — After dark\nRoute A: 16-minute walk; open shops along several stretches.\nRoute B: 11-minute walk; no open shops.',
    'Choice 5 — After dark\nRoute A: 13-minute walk; lighting throughout; no footpath.\nRoute B: 13-minute walk; continuous footpath; lighting on only a few stretches.',
    'Choice 6 — During daylight\nRoute A: 14-minute walk; open shops; few pedestrians.\nRoute B: 14-minute walk; no open shops; other pedestrians along most stretches.',
]
DESIGN = np.array([[-1,-1,0,0,0], [1.2,0,1,0,0], [-1,0,0,0,-1],
                   [1,0,0,1,0], [0,-1,1,0,0], [0,0,0,1,-1]], dtype=float)
EXCLUDED = {'': 'missing', 'No preference': 'no_preference',
            'Cannot decide with this information': 'uncertain'}


def normalize(value):
    return ' '.join(value.split())


def read_records(path):
    raw = Path(path).read_bytes()
    if zipfile.is_zipfile(io.BytesIO(raw)):
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = [n for n in archive.namelist() if n.lower().endswith('.csv') and not n.startswith('__MACOSX/')]
            if len(names) != 1:
                raise ValueError('ZIP must contain exactly one CSV')
            if archive.getinfo(names[0]).file_size > 20_000_000:
                raise ValueError('CSV exceeds 20 MB')
            raw = archive.read(names[0])
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    headers = [normalize(h) for h in (reader.fieldnames or [])]
    required = [CONSENT, *QUESTIONS]
    if len(set(headers)) != len(headers) or any(normalize(h) not in headers for h in required):
        raise ValueError('Survey columns do not match the supported six-scenario questionnaire')
    records = [{normalize(k): (v or '').strip() for k, v in row.items() if k is not None} for row in reader]
    return records, hashlib.sha256(raw).hexdigest()


def prepare(records):
    samples, counts = [], Counter()
    for respondent, row in enumerate(records, 1):
        counts['submissions'] += 1
        if row.get(normalize(CONSENT)) != 'Yes':
            counts['excluded_without_consent'] += 1
            continue
        counts['consenting_submissions'] += 1
        for scenario, question in enumerate(QUESTIONS):
            value = row.get(normalize(question), '')
            if value in ('Route A', 'Route B'):
                samples.append((respondent, scenario, int(value == 'Route A')))
                counts['clear_choices'] += 1
            elif value in EXCLUDED:
                counts[EXCLUDED[value]] += 1
            else:
                raise ValueError(f'Unrecognized choice in submission {respondent}, scenario {scenario + 1}')
    return samples, dict(counts)


def fit(x, y):
    # Fixed specification, no hyperparameter selection on this small dataset.
    return LogisticRegression(C=1.0, fit_intercept=False, solver='lbfgs', max_iter=2000).fit(x, y)


def evaluate(samples):
    groups, scenarios, y = np.array(samples, dtype=int).T
    x = DESIGN[scenarios]
    if len(set(groups)) < 3 or len(set(y)) < 2:
        raise ValueError('Need at least three contributing submissions and both choice classes')
    predictions = np.zeros(len(y))
    baseline = np.zeros(len(y))
    folds = []
    for train, test in LeaveOneGroupOut().split(x, y, groups):
        if len(set(y[train])) < 2:
            raise ValueError('A training fold contains only one class; collect more responses')
        model = fit(x[train], y[train])
        predictions[test] = model.predict_proba(x[test])[:, 1]
        # Baseline uses only training respondents for each scenario. Beta(1,1) smoothing.
        for i in test:
            selected = train[scenarios[train] == scenarios[i]]
            baseline[i] = (y[selected].sum() + 1) / (len(selected) + 2)
        folds.append({'held_out_submission': int(groups[test[0]]), 'choices': len(test),
                      'accuracy': float(accuracy_score(y[test], predictions[test] >= .5))})
    def metrics(prob):
        return {'accuracy': float(accuracy_score(y, prob >= .5)),
                'log_loss': float(log_loss(y, prob, labels=[0, 1]))}
    final = fit(x, y)
    return {'evaluation': 'leave-one-submission-out; same six scenarios',
            'contributing_submissions': len(set(groups)), 'scenario_count': len(set(scenarios)),
            'model': metrics(predictions), 'scenario_baseline': metrics(baseline),
            'mean_respondent_accuracy': float(np.mean([f['accuracy'] for f in folds])),
            'folds': folds}, final.coef_[0].tolist()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, help='Local Google Forms CSV or CSV ZIP')
    parser.add_argument('--output', default='ml/preferences/private_output')
    args = parser.parse_args()
    records, source_hash = read_records(args.input)
    samples, counts = prepare(records)
    if not samples:
        raise ValueError('No clear choices with consent')
    report, coefficients = evaluate(samples)
    report.update({'counts': counts, 'source_csv_sha256': source_hash,
                   'limitations': ['Exploratory small-sample stated preferences, not safety predictions.',
                     'Submission IDs are not verified unique people. Duplicate people cannot be detected.',
                     'Evaluation measures held-out submissions on six repeated scenarios, not unseen routes.',
                     'Unmentioned scenario attributes are assumed equal, not observed absent.',
                     'Do not map unknown OSM tags to these scenario attributes or deploy as a route ranker.']})
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    with (output / 'choices.csv').open('w', newline='', encoding='utf-8') as stream:
        writer = csv.writer(stream)
        writer.writerow(['submission_id', 'scenario_id', *FEATURES, 'chose_A'])
        for group, scenario, label in samples:
            writer.writerow([group, scenario+1, *DESIGN[scenario], label])
    (output / 'evaluation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    (output / 'model.json').write_text(json.dumps({'experimental_only': True, 'features': FEATURES,
        'coefficients': coefficients, 'intercept': 0, 'C': 1.0,
        'prediction': 'sigmoid(dot(coefficients, A_minus_B_features))',
        'source_csv_sha256': source_hash}, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'folds'}, indent=2))


if __name__ == '__main__':
    main()
