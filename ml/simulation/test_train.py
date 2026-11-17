import unittest
import json
from pathlib import Path
import numpy as np
from train import dataset, fit, SEED

class SimulationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model, cls.artifact = fit()

    def test_committed_artifact_matches_training(self):
        committed = json.loads((Path(__file__).resolve().parents[2] / 'frontend/src/lib/simulationModel.json').read_text())
        self.assertEqual(committed, self.artifact)

    def test_split_and_reproducibility(self):
        x, y = dataset(SEED, 1000)
        xx, yy = dataset(SEED, 1000)
        np.testing.assert_array_equal(x, xx)
        np.testing.assert_array_equal(y, yy)
        held, target = dataset(SEED+1, 250)
        self.assertFalse(set(map(tuple, x[:,:4])) & set(map(tuple, held[:,:4])))
        self.assertTrue(np.all((target >= 0) & (target <= 100)))

    def test_export_matches_estimator_and_baseline(self):
        a = self.artifact
        self.assertLess(a['metrics']['synthetic_test_mae'], a['metrics']['constant_baseline_mae'])
        x, _ = dataset(SEED+2, 50)
        def predict(row):
            score = a['initial']
            for tree in a['trees']:
                node = 0
                while tree['left'][node] >= 0:
                    node = tree['left'][node] if np.float32(row[tree['feature'][node]]) <= tree['threshold'][node] else tree['right'][node]
                score += a['learning_rate']*tree['value'][node]
            return score
        np.testing.assert_allclose([predict(row) for row in x], self.model.predict(x), atol=1e-10)

if __name__ == '__main__':
    unittest.main()
