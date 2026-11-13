import unittest
from unittest.mock import patch
import numpy as np
from scipy.special import expit
import train_live
from train import DESIGN

class LiveTrainingTests(unittest.TestCase):
    def test_constraints_and_symmetry(self):
        w = train_live.fit(DESIGN, np.array([0, 1, 0, 1, 1, 1]))
        self.assertLessEqual(w[0], 0)
        self.assertTrue((w[1:] >= 0).all())
        np.testing.assert_allclose(expit(DESIGN @ w), 1 - expit(-DESIGN @ w))

    def test_holdout_excludes_every_answer_of_submission(self):
        samples = [(1,0,1),(1,0,1),(2,1,0),(2,1,0),(3,2,1),(3,2,0)]
        with patch.object(train_live, 'fit', wraps=train_live.fit) as fit:
            report, _ = train_live.evaluate(samples)
        self.assertEqual([len(call.args[0]) for call in fit.call_args_list], [4,4,4,6])
        for scenario, call in enumerate(fit.call_args_list[:3]):
            self.assertFalse(any(np.array_equal(row, DESIGN[scenario]) for row in call.args[0]))
        self.assertGreaterEqual(report['model']['accuracy'], 0)

if __name__ == '__main__':
    unittest.main()
