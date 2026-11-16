"""Reproducible synthetic-rating experiment. No observed safety labels."""
import hashlib
import json
from pathlib import Path
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

FEATURES = ['footpath', 'lighting', 'shops', 'pedestrians', 'night_fraction']
SEED = 20261116

def dataset(seed, environments):
    rng = np.random.default_rng(seed)
    conditions = rng.uniform(0, 1, (environments, 4))
    x = np.column_stack([np.repeat(conditions, 4, axis=0), np.tile([0, .25, .75, 1], environments)])
    f, l, s, p, n = x.T
    # Explicit hypothetical assumptions, NOT fitted to Ranchi incidents or survey ratings.
    y = np.clip(10 + 30*f + 12*l + 15*s + 10*p + 13*l*n
                + 8*s*p - 18*n*(1-l) + rng.normal(0, 2, len(x)), 0, 100)
    return x, y

def fit():
    train_x, train_y = dataset(SEED, 1000)
    test_x, test_y = dataset(SEED + 1, 250)
    model = GradientBoostingRegressor(n_estimators=64, max_depth=3, learning_rate=.1,
                                      loss='squared_error', random_state=SEED)
    model.fit(train_x, train_y)
    predicted = model.predict(test_x)
    metrics = {
        'synthetic_test_mae': float(mean_absolute_error(test_y, predicted)),
        'synthetic_test_rmse': float(mean_squared_error(test_y, predicted)**.5),
        'constant_baseline_mae': float(mean_absolute_error(test_y, np.full(len(test_y), train_y.mean()))),
    }
    trees = []
    for estimator in model.estimators_[:, 0]:
        t = estimator.tree_
        trees.append(dict(left=t.children_left.tolist(), right=t.children_right.tolist(),
                          feature=t.feature.tolist(), threshold=t.threshold.tolist(),
                          value=t.value[:, 0, 0].tolist()))
    vectors = np.vstack([test_x[:8], np.zeros(5), np.ones(5), [.8,.1,.6,.4,0], [.8,.1,.6,.4,1]])
    artifact = dict(schema=1, name='Synthetic route-rating regressor',
                    label_source='Hypothetical generated ratings; not measured safety',
                    features=FEATURES, seed=SEED, train_rows=len(train_y), test_rows=len(test_y),
                    split='Disjoint generated environments: 1000 training / 250 test, four time variants each',
                    sklearn_version=__import__('sklearn').__version__,
                    dataset_sha256=hashlib.sha256(np.vstack([np.column_stack([train_x,train_y]),
                                                           np.column_stack([test_x,test_y])]).tobytes()).hexdigest(),
                    initial=float(model.init_.constant_[0,0]), learning_rate=model.learning_rate,
                    metrics=metrics, trees=trees,
                    test_vectors=[dict(inputs=x.tolist(), prediction=float(y)) for x,y in zip(vectors,model.predict(vectors))])
    return model, artifact

if __name__ == '__main__':
    _, artifact = fit()
    root = Path(__file__).resolve().parents[2]
    (root/'frontend/src/lib/simulationModel.json').write_text(json.dumps(artifact, separators=(',', ':'))+'\n')
    (Path(__file__).parent/'evaluation.json').write_text(json.dumps({k:v for k,v in artifact.items() if k not in ['trees','test_vectors']}, indent=2)+'\n')
    print(json.dumps(artifact['metrics'], indent=2))
