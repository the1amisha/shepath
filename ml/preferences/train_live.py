"""Exploratory constrained survey weights for a hybrid real-route recommender.

Cross-validation evaluates survey choices only. Geographic feature mapping and
missing-input bounds are engineering rules, not learned or validated on routes.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from scipy.optimize import minimize
from scipy.special import expit
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import LeaveOneGroupOut
from train import DESIGN, FEATURES, prepare, read_records


def fit(x, y):
    def objective(w):
        z = x @ w
        return float(np.logaddexp(0, z).sum() - y @ z + .5 * (w @ w)), x.T @ (expit(z) - y) + w
    result = minimize(objective, np.zeros(5), jac=True, method='L-BFGS-B',
                      bounds=[(None, 0)] + [(0, None)] * 4,
                      options={'maxiter': 2000, 'ftol': 1e-12})
    if not result.success or not np.isfinite(result.x).all():
        raise ValueError('Constrained model did not converge')
    return result.x


def evaluate(samples):
    groups, scenarios, y = np.array(samples, dtype=int).T
    x = DESIGN[scenarios]
    if len(set(groups)) < 3 or len(set(y)) < 2:
        raise ValueError('Need at least three submissions and both classes')
    predictions, baseline = np.zeros(len(y)), np.zeros(len(y))
    for training, test in LeaveOneGroupOut().split(x, y, groups):
        if len(set(y[training])) < 2:
            raise ValueError('Training fold has only one class')
        predictions[test] = expit(x[test] @ fit(x[training], y[training]))
        for i in test:
            selected = training[scenarios[training] == scenarios[i]]
            baseline[i] = (y[selected].sum() + 1) / (len(selected) + 2)
    def metrics(p):
        return {'accuracy': float(accuracy_score(y, p >= .5)), 'log_loss': float(log_loss(y, p, labels=[0, 1]))}
    return {'model': metrics(predictions), 'baseline': metrics(baseline)}, fit(x, y)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    records, source = read_records(args.input)
    samples, counts = prepare(records)
    evaluation, coefficients = evaluate(samples)
    artifact = {
        'version': 'survey-constrained-v1', 'features': FEATURES,
        'coefficients': coefficients.tolist(), 'counts': counts,
        'source_csv_sha256': source, 'evaluation': evaluation,
        'reference_probabilities': expit(DESIGN @ coefficients).tolist(),
        'scope': 'Exploratory survey-trained weights with hand-designed mapped proxies; not validated on real routes.',
        'constraints': 'Time <= 0, attribute coefficients >= 0, C=1, no intercept.',
        'evaluation_scope': 'Leave-one-submission-out on the same six scenarios. Constraints were chosen after inspecting the original fit, so this is not an untouched final test.'}
    Path(args.output).write_text(json.dumps(artifact, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'coefficients': artifact['coefficients'], 'evaluation': evaluation}))


if __name__ == '__main__':
    main()
